/**
 * Build e2e/fixtures/photo.heic: a 160 x 120 still, pink left half, blue
 * right half, wrapped in a minimal HEIF container.
 *
 * Run by hand, not from the test suite: it needs ffmpeg with libx265 on the
 * PATH. Nothing here can write HEIC otherwise, and HEIC to JPG is the one
 * tool with no other way to be tested. The output is committed.
 *
 *   ffmpeg -i src.png -c:v libx265 -pix_fmt yuv420p -frames:v 1 -f hevc still.h265
 *   node scripts/make-heic-fixture.mjs still.h265 e2e/fixtures/photo.heic 160 120
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [, , input, output, wArg, hArg] = process.argv;
const W = Number(wArg), H = Number(hArg);
const annexb = readFileSync(input);

/** Split an Annex B stream into NAL payloads (start codes removed). */
function nals(buf) {
  const starts = [];
  for (let i = 0; i + 2 < buf.length; i++) {
    if (buf[i] === 0 && buf[i + 1] === 0 && buf[i + 2] === 1) starts.push([i + 3, i > 0 && buf[i - 1] === 0 ? i - 1 : i]);
  }
  const out = [];
  for (let k = 0; k < starts.length; k++) {
    const from = starts[k][0];
    const to = k + 1 < starts.length ? starts[k + 1][1] : buf.length;
    out.push(buf.subarray(from, to));
  }
  return out;
}

const units = nals(annexb);
const byType = new Map();
for (const n of units) {
  const type = (n[0] >> 1) & 0x3f;
  if (!byType.has(type)) byType.set(type, []);
  byType.get(type).push(n);
}
const vps = byType.get(32)?.[0], sps = byType.get(33)?.[0], pps = byType.get(34)?.[0];
const slices = units.filter((n) => { const t = (n[0] >> 1) & 0x3f; return t <= 31; });
if (!vps || !sps || !pps || slices.length === 0) throw new Error(`missing NALs: vps=${!!vps} sps=${!!sps} pps=${!!pps} slices=${slices.length}`);

const u8 = (...v) => Buffer.from(v);
const u16 = (v) => { const b = Buffer.alloc(2); b.writeUInt16BE(v); return b; };
const u32 = (v) => { const b = Buffer.alloc(4); b.writeUInt32BE(v); return b; };
const str = (s) => Buffer.from(s, 'latin1');
const box = (type, ...parts) => {
  const body = Buffer.concat(parts);
  return Buffer.concat([u32(body.length + 8), str(type), body]);
};
const full = (type, version, flags, ...parts) => box(type, u8(version, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255), ...parts);

/** hvcC decoder configuration record, the parts a decoder actually reads. */
function hvcC() {
  const p = sps.subarray(2); // skip the 2-byte NAL header: profile_tier_level follows sps_* bits
  // general_profile_space..general_level_idc live at a fixed offset once
  // sps_video_parameter_set_id(4) sps_max_sub_layers_minus1(3) sps_temporal_id_nesting(1)
  // have been consumed: that is exactly one byte.
  const ptl = p.subarray(1, 1 + 12); // 12 bytes of profile_tier_level for max_sub_layers_minus1 = 0
  const arr = (type, list) => Buffer.concat([
    u8(0x80 | type), u16(list.length),
    ...list.flatMap((n) => [u16(n.length), n]),
  ]);
  return box('hvcC', Buffer.concat([
    u8(1),                       // configurationVersion
    ptl.subarray(0, 1),          // general_profile_space/tier/idc
    ptl.subarray(1, 5),          // general_profile_compatibility_flags
    ptl.subarray(5, 11),         // general_constraint_indicator_flags
    ptl.subarray(11, 12),        // general_level_idc
    u16(0xf000),                 // min_spatial_segmentation_idc
    u8(0xfc),                    // parallelismType
    u8(0xfc),                    // chromaFormat (420)
    u8(0xf8),                    // bitDepthLumaMinus8 = 0
    u8(0xf8),                    // bitDepthChromaMinus8 = 0
    u16(0),                      // avgFrameRate
    u8(0x0f),                    // constantFrameRate/numTemporalLayers/temporalIdNested/lengthSizeMinusOne=3
    u8(3),                       // numOfArrays
    arr(32, [vps]), arr(33, [sps]), arr(34, [pps]),
  ]));
}

const mdat = Buffer.concat(slices.flatMap((s) => [u32(s.length), s]));

const ipco = box('ipco', hvcC(), full('ispe', 0, 0, u32(W), u32(H)));
const ipma = full('ipma', 0, 0, u32(1), Buffer.concat([u16(1), u8(2), u8(0x80 | 1), u8(2)]));
const iprp = box('iprp', ipco, ipma);
const hdlr = full('hdlr', 0, 0, u32(0), str('pict'), u32(0), u32(0), u32(0), u8(0));
const pitm = full('pitm', 0, 0, u16(1));
const infe = full('infe', 2, 0, u16(1), u16(0), str('hvc1'), str('image\0'));
const iinf = full('iinf', 0, 0, u16(1), infe);

/** iloc carries an absolute file offset, so it is written twice: once to
 *  measure the layout, then again with the offset the measurement gives. */
function build(offset) {
  const iloc = full('iloc', 0, 0,
    u8(0x44), u8(0x00),          // offset_size 4, length_size 4, base_offset_size 0
    u16(1),                      // item_count
    u16(1), u16(0), u16(1),      // item_ID, data_reference_index, extent_count
    u32(offset), u32(mdat.length));
  const meta = full('meta', 0, 0, hdlr, pitm, iloc, iinf, iprp);
  const ftyp = box('ftyp', str('heic'), u32(0), str('mif1'), str('heic'));
  return Buffer.concat([ftyp, meta, box('mdat', mdat)]);
}
const probe = build(0);
writeFileSync(output, build(probe.length - mdat.length));
console.log(`wrote ${output} (${probe.length} bytes, ${W}x${H}, ${slices.length} slice NAL)`);
