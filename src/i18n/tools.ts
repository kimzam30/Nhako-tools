import type { Locale } from './paths';
import type { Category, OptionSpec, ToolMeta, ToolVariant } from '../tools/types';
import { CATEGORY_LABEL, toolId } from '../tools/types';
import { groupLabel as groupLabelEn, GROUPS } from '../tools/groups';

/**
 * Bahasa Melayu text for the registry.
 *
 * The registry stays the single source of truth for WHAT a tool is (routes,
 * options, defaults); this file only supplies the words. i18n.test.ts fails
 * if a tool, option, choice or variant is missing a translation, so adding a
 * tool without its Malay text breaks the build rather than showing English
 * on a /ms page.
 */

interface OptionText {
  label: string;
  help?: string;
  placeholder?: string;
  choices?: Record<string, string>;
}

export interface ToolText {
  name: string;
  seoTitle?: string;
  blurb: string;
  description: string;
  /** Added to the English keywords, so search works in either language. */
  keywords: string[];
  about?: string;
  limits?: string[];
  options?: Record<string, OptionText>;
  variants?: Record<string, Pick<ToolVariant, 'name' | 'blurb' | 'description' | 'about'>>;
}

const CATEGORY_MS: Record<Category, string> = {
  pdf: 'PDF',
  media: 'Media',
  image: 'Imej',
  calc: 'Kalkulator',
  dev: 'Pembangun',
};

export const categoryLabel = (category: Category, locale: Locale): string =>
  locale === 'ms' ? CATEGORY_MS[category] : CATEGORY_LABEL[category];

/** Malay job-group labels, keyed '<category>/<group>'. English lives in
 *  src/tools/groups.ts, beside CATEGORY_LABEL. i18n.test.ts fails on a group
 *  defined there and missing here, and on a key here that names no real
 *  group, so the two files cannot drift apart. */
const GROUP_MS: Record<string, string> = {
  'pdf/organise': 'Susun halaman',
  'pdf/create': 'Buat PDF',
  'pdf/extract': 'Tukar dan ekstrak',
  'pdf/mark-up': 'Sunting dan tandatangan',
  'pdf/shrink': 'Kecilkan saiz fail',
  'pdf/secure': 'Kata laluan dan kebenaran',
  'image/shrink': 'Kecilkan saiz fail',
  'image/convert': 'Tukar format',
  'image/transform': 'Ubah saiz, potong dan putar',
  'image/edit': 'Sunting foto',
  'image/clean': 'Ekstrak dan bersihkan',
  'image/create': 'Hasilkan',
  'dev/text': 'Teks dan kod',
  'dev/encode': 'Enkod dan hash',
  'dev/generate': 'Jana',
};

export const groupLabel = (category: Category, id: string, locale: Locale): string =>
  (locale === 'ms' ? GROUP_MS[`${category}/${id}`] : undefined) ?? groupLabelEn(category, id);

const noUpload = 'Tiada muat naik, tiada akaun, tiada tera air.';

export const MS_GROUPS = GROUP_MS;
export const ALL_GROUPS = GROUPS;

export const MS: Record<string, ToolText> = {
  // ─── PDF ──────────────────────────────────────────────────────────────────
  'pdf/merge': {
    name: 'Gabung PDF',
    blurb: 'Satukan beberapa PDF menjadi satu fail.',
    description: 'Gabungkan fail PDF dalam pelayar anda. Tiada muat naik, tiada had saiz fail, tiada akaun. Lepaskan fail dan PDF gabungan siap serta-merta.',
    keywords: ['gabung', 'cantum', 'satukan', 'gabung pdf', 'cantum pdf'],
    about: 'Fail digabungkan mengikut susunan anda melepaskannya, dan setiap halaman kekal pada saiz dan kualiti asal. Tiada apa-apa dikod semula, jadi hasilnya tanpa kehilangan kualiti.',
    limits: ['PDF yang disulitkan atau dilindungi kata laluan perlu dibuka kuncinya dahulu.', 'Gabungan yang sangat besar dihadkan oleh memori peranti anda, bukan had muat naik.'],
  },
  'pdf/split': {
    name: 'Pisah PDF',
    blurb: 'Keluarkan setiap halaman menjadi PDF berasingan.',
    description: 'Pisahkan PDF kepada halaman tunggal dalam pelayar anda. Hasilnya dalam ZIP, tanpa muat naik dan tanpa had halaman.',
    keywords: ['pisah', 'asingkan', 'pecah', 'keluarkan halaman', 'pisah pdf'],
    about: 'Setiap halaman yang dipilih menjadi PDF sendiri, dihimpunkan dalam ZIP. Halaman disalin, bukan dilukis semula, jadi kualitinya tidak terjejas.',
    limits: ['Hasil sentiasa dalam ZIP, walaupun untuk satu halaman.'],
    options: {
      range: { label: 'Halaman', placeholder: 'semua, atau 1-5, 8, 11-13', help: 'Biarkan kosong untuk memisahkan setiap halaman.' },
    },
  },
  'pdf/compress': {
    name: 'Mampat PDF',
    blurb: 'Kecilkan PDF, atau capai saiz yang tepat.',
    description: 'Mampatkan PDF dalam pelayar anda, atau kecilkan di bawah had tepat seperti 500 KB untuk portal muat naik. Tiada muat naik, tiada akaun.',
    keywords: ['mampat', 'kecilkan', 'kurangkan saiz', 'mampat pdf', 'kecilkan pdf', 'bawah 500kb', 'bawah 1mb', 'had saiz'],
    about: 'Dengan saiz sasaran, fail dipadatkan semula tanpa kehilangan kualiti dahulu; jika itu sudah di bawah had, teks kekal boleh dipilih. Jika tidak, setiap halaman dikod semula sebagai imej pada kualiti dan resolusi tertinggi yang masih muat. Tanpa sasaran, mod Tanpa Kehilangan memadatkan struktur fail (penjimatan kecil) dan mod Kuat menukar setiap halaman kepada imej (penjimatan besar).',
    limits: ['Mencapai sasaran yang kecil biasanya bermaksud halaman ditukar kepada imej, jadi teks tidak lagi boleh dipilih atau dicari.', 'Halaman tidak pernah dilukis di bawah kira-kira 45 dpi. Jika dokumen tidak dapat dimuatkan dan kekal boleh dibaca, alat ini memberitahu anda dan tidak menyerahkan fail yang tidak boleh dibaca. Memisahkannya dahulu biasanya membantu.', 'Mod Tanpa Kehilangan selalunya hanya menjimatkan beberapa peratus. Itulah had sebenar pemampatan struktur.'],
    options: {
      target: {
        label: 'Saiz sasaran',
        help: 'Untuk portal muat naik yang ada had saiz. Mencuba tanpa kehilangan kualiti dahulu, supaya teks kekal boleh dipilih apabila itu sudah cukup.',
        choices: { '0': 'Tiada, pilih mod', '100': 'Bawah 100 KB', '200': 'Bawah 200 KB', '500': 'Bawah 500 KB', '1000': 'Bawah 1 MB', '2000': 'Bawah 2 MB', '5000': 'Bawah 5 MB' },
      },
      mode: {
        label: 'Mod',
        help: 'Mod Kuat mengekod semula setiap halaman sebagai imej. Jauh lebih kecil, tetapi teks tidak lagi boleh dipilih atau dicari.',
        choices: { lossless: 'Tanpa kehilangan (teks boleh dipilih)', strong: 'Kuat (halaman menjadi imej)' },
      },
      quality: { label: 'Kualiti imej', help: 'Mod Kuat sahaja.' },
    },
    variants: {
      '100kb': { name: 'Mampat PDF ke 100 KB', blurb: 'Kecilkan PDF di bawah 100 KB.', description: `Mampatkan PDF di bawah 100 KB dalam pelayar anda, untuk portal yang mempunyai had muat naik ketat. ${noUpload}` },
      '200kb': { name: 'Mampat PDF ke 200 KB', blurb: 'Kecilkan PDF di bawah 200 KB.', description: `Mampatkan PDF di bawah 200 KB dalam pelayar anda, untuk borang dan portal yang ada had muat naik. ${noUpload}` },
      '500kb': { name: 'Mampat PDF ke 500 KB', blurb: 'Kecilkan PDF di bawah 500 KB.', description: `Mampatkan PDF di bawah 500 KB dalam pelayar anda, had yang digunakan banyak portal permohonan. ${noUpload}` },
      '1mb': { name: 'Mampat PDF ke 1 MB', blurb: 'Kecilkan PDF di bawah 1 MB.', description: `Mampatkan PDF di bawah 1 MB dalam pelayar anda, biasanya dengan teks masih boleh dipilih. ${noUpload}` },
      '2mb': { name: 'Mampat PDF ke 2 MB', blurb: 'Kecilkan PDF di bawah 2 MB.', description: `Mampatkan PDF di bawah 2 MB dalam pelayar anda untuk e-mel dan portal muat naik. ${noUpload}` },
    },
  },
  'pdf/to-image': {
    name: 'PDF ke JPG',
    blurb: 'Tukar setiap halaman kepada imej resolusi tinggi.',
    description: 'Tukar halaman PDF kepada JPG atau PNG dalam pelayar anda. Resolusi tinggi, tiada muat naik, tiada tera air.',
    keywords: ['pdf ke jpg', 'pdf ke png', 'pdf ke gambar', 'tukar pdf', 'pdf kepada imej'],
    about: 'Setiap halaman dilukis pada resolusi yang dipilih dan dieksport sebagai imej, dihimpunkan dalam ZIP.',
    limits: ['Resolusi tinggi pada dokumen panjang menggunakan banyak memori.'],
    options: {
      format: { label: 'Format', choices: { jpg: 'JPG', png: 'PNG' } },
      scale: { label: 'Resolusi', choices: { '1': '72 dpi, skrin', '2': '144 dpi, lalai', '3': '216 dpi, cetakan' } },
    },
  },
  'pdf/to-text': {
    name: 'PDF ke teks',
    blurb: 'Keluarkan teks mentah daripada PDF.',
    description: 'Keluarkan teks daripada PDF dalam pelayar anda. Tiada muat naik, tiada akaun, tiada had aksara.',
    keywords: ['pdf ke teks', 'salin teks', 'ekstrak teks', 'ambil teks'],
    about: 'Mengeluarkan lapisan teks terbenam daripada dokumen, halaman demi halaman.',
    limits: ['PDF imbasan tiada lapisan teks, jadi alat ini tidak memulangkan apa-apa untuknya. OCR tidak disertakan.', 'Susun atur berbilang lajur yang kompleks mungkin keluar tidak mengikut susunan bacaan.'],
  },
  'pdf/rotate': {
    name: 'Putar PDF',
    blurb: 'Putar halaman dan betulkan orientasi.',
    description: 'Putar halaman PDF dalam pelayar anda. Betulkan imbasan yang senget atau terbalik tanpa memuat naik fail.',
    keywords: ['putar', 'pusing', 'orientasi', 'terbalik', 'senget', 'putar pdf'],
    about: 'Putaran dikenakan pada metadata halaman, jadi tiada apa-apa dilukis semula dan kualiti tidak terjejas.',
    limits: ['Putaran dalam gandaan 90°. Sudut lain memerlukan halaman ditukar kepada imej.'],
    options: {
      angle: { label: 'Putar sebanyak', choices: { '90': '90° ikut jam', '180': '180°', '270': '90° lawan jam' } },
      range: { label: 'Halaman', placeholder: 'semua, atau 1-5, 8', help: 'Biarkan kosong untuk memutar setiap halaman.' },
    },
  },
  'pdf/watermark': {
    name: 'Tera air PDF',
    blurb: 'Cop teks merentasi setiap halaman.',
    description: 'Tambah tera air teks pada PDF dalam pelayar anda. Tetapkan teks, saiz, sudut dan kelegapan. Tiada apa-apa dimuat naik.',
    keywords: ['tera air', 'cop', 'draf', 'sulit', 'watermark pdf'],
    about: 'Teks dilukis sekali pada setiap halaman, di tengah. Ia berada di atas kandungan sedia ada.',
    limits: ['Tera air teks sahaja. Tera air imej tidak disokong.', 'Aksara Latin sahaja. Cop menggunakan fon PDF terbina dalam, yang tidak boleh melukis Cyril, Yunani, CJK atau emoji.', 'Tera air bukan keselamatan: sesiapa yang ada alat yang betul boleh membuangnya.'],
    options: {
      text: { label: 'Teks', placeholder: 'DRAF' },
      size: { label: 'Saiz' },
      opacity: { label: 'Kelegapan' },
      angle: { label: 'Sudut' },
    },
  },

  'pdf/jpg-to-pdf': {
    name: 'JPG ke PDF',
    blurb: 'Jadikan gambar dan imbasan satu PDF.',
    description: 'Tukar JPG, PNG dan imej lain kepada PDF dalam pelayar anda, satu halaman setiap imej. JPG dan PNG dimasukkan tanpa dimampat semula. Tiada muat naik.',
    keywords: ['jpg ke pdf', 'gambar ke pdf', 'png ke pdf', 'tukar gambar ke pdf', 'imbasan'],
    about: 'Setiap imej menjadi satu halaman, mengikut susunan anda melepaskannya. JPG dan PNG dimasukkan seadanya, jadi PDF kelihatan sama seperti asal. Gambar telefon yang hanya dipusingkan oleh tag EXIF diluruskan dahulu, kerana PDF mengabaikan tag itu.',
    limits: ['Imej diletakkan mengikut susunan ia dilepaskan. Susun semula halaman selepas itu dengan Susun PDF.', 'Format yang tidak boleh disimpan terus dalam PDF (WebP, GIF, BMP) ditukar kepada JPG berkualiti tinggi.'],
    options: {
      page: { label: 'Saiz halaman', choices: { a4: 'A4', letter: 'US Letter', fit: 'Sama seperti imej' } },
      orientation: { label: 'Orientasi', choices: { auto: 'Ikut setiap imej', portrait: 'Potret', landscape: 'Landskap' } },
      margin: { label: 'Jidar', choices: { '0': 'Tiada', '10': '10 mm', '20': '20 mm' } },
    },
  },
  'pdf/organize': {
    name: 'Susun PDF',
    blurb: 'Susun semula, putar dan buang halaman.',
    description: 'Susun semula, putar dan buang halaman PDF dengan menyeret lakaran kecil dalam pelayar anda. Gabungkan beberapa PDF sekali gus. Tiada muat naik.',
    keywords: ['susun pdf', 'susun semula halaman', 'buang halaman', 'padam halaman', 'alih halaman'],
    about: 'Setiap halaman dipaparkan sebagai lakaran kecil. Seret untuk menyusun semula, atau guna butang pada setiap halaman; putar atau buang halaman; tambah lebih banyak PDF dan ia disambung di hujung. Halaman disalin, bukan dilukis semula, jadi kualitinya tidak terjejas.',
    limits: ['PDF yang dilindungi kata laluan perlu dibuka kuncinya dahulu.', 'Dokumen yang sangat panjang mengambil sedikit masa untuk melukis setiap lakaran kecil.'],
  },
  'pdf/sign': {
    name: 'Tandatangan PDF',
    blurb: 'Lukis atau taip tandatangan dan letakkannya.',
    description: 'Tandatangan PDF dalam pelayar anda: lukis, taip atau muat masuk tandatangan, letakkan pada mana-mana halaman, dan simpan. Tandatangan anda kekal pada peranti anda.',
    keywords: ['tandatangan', 'tandatangan pdf', 'tanda tangan', 'e-tandatangan', 'sign pdf'],
    about: 'Lukis dengan tetikus, jari atau stilus, taip nama anda dalam fon tulisan tangan, atau guna gambar tandatangan anda. Klik pada halaman untuk meletakkannya, kemudian seret dan ubah saiz. Tandatangan dicop ke dalam halaman apabila anda menyimpan.',
    limits: ['Ini tandatangan visual, seperti menandatangani salinan bercetak. Ia bukan tandatangan digital berasaskan sijil, jadi ia tidak membuktikan siapa yang menandatangan.', 'PDF yang dilindungi kata laluan perlu dibuka kuncinya dahulu.'],
  },
  'pdf/page-numbers': {
    name: 'Tambah nombor halaman',
    blurb: 'Nomborkan setiap halaman, dalam gaya yang anda perlukan.',
    description: 'Tambah nombor halaman pada PDF dalam pelayar anda. Pilih kedudukan, gaya dan nombor permulaan, dan langkau halaman kulit. Tiada muat naik.',
    keywords: ['nombor halaman', 'nomborkan halaman', 'penomboran', 'muka surat'],
    about: 'Nombor dilukis 10 mm dari tepi setiap halaman seperti yang dipaparkan, jadi halaman yang diimbas secara mengiring tetap mendapat nombor yang tegak di penjuru yang betul.',
    limits: ['Digit dan teks Latin sahaja, dalam fon Helvetica.', 'Nombor dilukis di atas halaman. Jika penjuru itu sudah ada kandungan, ia akan bertindih.'],
    options: {
      position: { label: 'Kedudukan', choices: { 'bottom-center': 'Bawah tengah', 'bottom-right': 'Bawah kanan', 'bottom-left': 'Bawah kiri', 'top-center': 'Atas tengah', 'top-right': 'Atas kanan', 'top-left': 'Atas kiri' } },
      style: { label: 'Gaya', choices: { n: '1', 'n-of-total': '1 / 10', 'page-n': 'Halaman 1', 'page-n-of-total': 'Halaman 1 daripada 10' } },
      start: { label: 'Mula dari' },
      size: { label: 'Saiz' },
      skipFirst: { label: 'Langkau halaman pertama', help: 'Untuk halaman kulit. Penomboran bermula pada halaman 2.' },
    },
  },
  'pdf/crop': {
    name: 'Potong PDF',
    blurb: 'Potong jidar setiap halaman.',
    description: 'Potong halaman PDF dalam pelayar anda dengan membuang jidar dari mana-mana sisi. Tanpa kehilangan kualiti, tiada apa-apa dilukis semula atau dimuat naik.',
    keywords: ['potong pdf', 'crop pdf', 'buang jidar', 'jidar'],
    about: 'Mengubah kawasan kelihatan setiap halaman (kotak potongnya). Tiada apa-apa dilukis semula, jadi teks kekal tajam dan boleh dipilih. Jidar diukur pada halaman seperti yang anda lihat, termasuk halaman yang disimpan secara mengiring.',
    limits: ['Memotong menyembunyikan kandungan; ia tidak memadamnya. Kawasan yang dipotong masih ada dalam fail, dan sesetengah penyunting boleh memaparkannya semula. Jangan bergantung pada pemotongan untuk membuang maklumat sulit.'],
    options: {
      top: { label: 'Atas' }, bottom: { label: 'Bawah' }, left: { label: 'Kiri' }, right: { label: 'Kanan' },
      range: { label: 'Halaman', placeholder: 'semua, atau 1-5, 8', help: 'Biarkan kosong untuk memotong setiap halaman.' },
    },
  },
  'pdf/protect': {
    name: 'Lindungi PDF',
    blurb: 'Kunci PDF dengan kata laluan.',
    description: 'Lindungi PDF dengan kata laluan dan penyulitan AES-256 dalam pelayar anda, dan sekat pencetakan atau penyalinan jika perlu. Kata laluan kekal pada peranti anda.',
    keywords: ['lindungi pdf', 'kata laluan pdf', 'kunci pdf', 'sulitkan pdf'],
    about: 'Menyulitkan seluruh fail dengan AES-256 menggunakan qpdf, alat PDF sumber terbuka yang standard, yang dijalankan dalam pelayar anda. Kata laluan digunakan pada halaman ini sahaja.',
    limits: ['Kata laluan yang dilupakan tidak boleh dipulihkan, oleh kami atau sesiapa. Simpan di tempat yang selamat.', 'Sekatan cetak dan salin dipatuhi oleh pembaca PDF utama, tetapi ia permintaan, bukan jaminan: sesetengah alat mengabaikannya.', 'Enjin penyulitan (kira-kira 1.3 MB) dimuat turun dari laman ini kali pertama ia dijalankan.'],
    options: {
      password: { label: 'Kata laluan', help: 'Diperlukan untuk membuka fail. Tiada cara untuk memulihkannya jika terlupa.' },
      allowPrint: { label: 'Benarkan mencetak' },
      allowCopy: { label: 'Benarkan menyalin teks' },
      allowEdit: { label: 'Benarkan menyunting' },
    },
  },
  'pdf/to-word': {
    name: 'PDF ke Word',
    blurb: 'Tukar PDF kepada dokumen Word yang boleh disunting.',
    description: 'Tukar PDF kepada dokumen Word (.docx) yang boleh disunting dalam pelayar anda, dengan perenggan, tajuk, tebal dan condong dibina semula. Tiada muat naik, tiada tera air.',
    keywords: ['pdf ke word', 'tukar pdf ke word', 'pdf ke docx', 'sunting pdf'],
    about: 'Membaca teks setiap halaman bersama kedudukan, saiz dan fonnya, membina semula baris menjadi perenggan dan tajuk seperti anda membacanya, dan menulis .docx sebenar dengan tebal, condong, fon dan pemisah halaman. Hasilnya teks yang boleh disunting, bukan gambar halaman.',
    limits: ['Imej, jadual, lajur dan warna tidak dibawa: ini memberi anda teks dan strukturnya, untuk disunting atau digunakan semula. Untuk salinan visual yang tepat, simpan PDF itu.', 'PDF imbasan tiada teks untuk ditukar. Jalankan melalui OCR PDF dahulu.', 'Susun atur luar biasa, seperti teks dalam beberapa lajur atau di sekeliling gambar, mungkin keluar dalam susunan yang salah.'],
  },
  'pdf/office-to-pdf': {
    name: 'Office ke PDF',
    seoTitle: 'Word, Excel, PowerPoint ke PDF dalam talian, percuma, tanpa muat naik | Nhako Tools',
    blurb: 'Word, Excel dan PowerPoint ke PDF.',
    description: 'Tukar fail Word, Excel dan PowerPoint kepada PDF dalam pelayar anda dengan LibreOffice. Penukaran berjalan pada peranti anda, jadi dokumen tidak pernah dimuat naik.',
    keywords: ['word ke pdf', 'excel ke pdf', 'powerpoint ke pdf', 'tukar ke pdf', 'docx ke pdf'],
    about: 'LibreOffice, suite pejabat sumber terbuka, dikompil untuk berjalan dalam pelayar anda, membuka setiap fail dan mengeksportnya sebagai PDF, sama seperti pada komputer. Beberapa fail sekali gus dipulangkan sebagai ZIP. Enjin dimuat turun dari laman ini kali pertama, kemudian disimpan oleh pelayar anda, jadi penukaran seterusnya bermula serta-merta.',
    limits: ['Penggunaan pertama memuat turun LibreOffice sekali: kira-kira 77 MB, dan ia memerlukan kira-kira 1 GB memori kosong. Pelayar komputer meja atau riba disyorkan; banyak telefon tidak dapat menjalankannya.', 'Susun atur ialah bacaan LibreOffice terhadap fail itu. Biasanya sangat hampir dengan Office, tetapi fon yang ada dalam Office dan tiada dalam LibreOffice digantikan dengan fon serupa, yang boleh mengalihkan pemisah baris.', 'Fail yang dilindungi kata laluan mesti dibuang kata laluannya dahulu.'],
    variants: {
      word: { name: 'Word ke PDF', blurb: 'Tukar fail .docx dan .doc kepada PDF.', description: 'Tukar dokumen Word (.docx, .doc) kepada PDF dalam pelayar anda dengan LibreOffice. Percuma, tanpa muat naik, tanpa tera air, tanpa akaun.' },
      excel: { name: 'Excel ke PDF', blurb: 'Tukar hamparan .xlsx dan .xls kepada PDF.', description: 'Tukar hamparan Excel (.xlsx, .xls, .csv) kepada PDF dalam pelayar anda dengan LibreOffice. Percuma, tanpa muat naik, tanpa tera air, tanpa akaun.' },
      powerpoint: { name: 'PowerPoint ke PDF', blurb: 'Tukar slaid .pptx dan .ppt kepada PDF.', description: 'Tukar persembahan PowerPoint (.pptx, .ppt) kepada PDF dalam pelayar anda dengan LibreOffice. Percuma, tanpa muat naik, tanpa tera air, tanpa akaun.' },
    },
  },
  'pdf/scan': {
    name: 'Imbas ke PDF',
    seoTitle: 'Imbas ke PDF dengan kamera telefon, percuma, tanpa muat naik | Nhako Tools',
    blurb: 'Ambil gambar halaman dan dapatkan PDF yang bersih.',
    description: 'Tukar gambar telefon dokumen kepada PDF yang bersih: halaman dicari, diluruskan dan diputihkan pada peranti anda. Beberapa halaman, A4 atau Letter. Tanpa muat naik, tanpa aplikasi.',
    keywords: ['imbas ke pdf', 'pengimbas', 'imbas dokumen', 'gambar ke pdf', 'imbas guna telefon'],
    about: 'Ambil gambar, atau pilih beberapa, dan setiap halaman dicari dalam gambar, diluruskan seolah-olah diimbas rata, dan dibersihkan: bayang-bayang diangkat menjadi halaman putih, dalam kelabu, hitam putih, atau warna asal. Laraskan penjuru jika halaman tidak ditemui dengan tepat, susun halaman, dan simpan satu PDF.',
    limits: ['Mencari halaman paling berkesan dengan seluruh helaian kelihatan di atas permukaan yang lebih gelap. Di atas meja putih, tetapkan penjuru secara manual.', 'Ini meluruskan halaman yang rata. Tulang buku yang melengkung kekal melengkung.', 'PDF itu ialah gambar halaman. Untuk menjadikan teks boleh dicari juga, jalankan melalui OCR PDF.'],
  },
  'pdf/ocr': {
    name: 'OCR PDF',
    seoTitle: 'OCR PDF dalam talian: jadikan PDF imbasan boleh dicari, percuma | Nhako Tools',
    blurb: 'Jadikan PDF imbasan boleh dicari dan disalin.',
    description: 'Jadikan PDF imbasan boleh dicari dalam pelayar anda: teks dikenal pasti pada peranti anda, dalam Bahasa Melayu atau Inggeris, dan diletakkan tanpa kelihatan pada setiap halaman.',
    keywords: ['ocr', 'ocr pdf', 'pdf boleh cari', 'pdf imbasan', 'salin teks dari imbasan'],
    about: 'Setiap halaman dilukis pada kira-kira 300 dpi dan dibaca oleh Tesseract, yang berjalan dalam pelayar anda, dalam Bahasa Inggeris, Melayu atau kedua-duanya. Perkataan diletakkan di atas halaman asal sebagai teks tidak kelihatan, seperti yang dilakukan pengimbas, jadi halaman kelihatan sama tetapi kini boleh dicari, dipilih dan disalin. Teks yang dikenal pasti turut dipaparkan, sedia untuk disalin.',
    limits: ['Penggunaan pertama memuat turun enjin OCR dan data bahasa sekali, kira-kira 15 MB, dari laman ini.', 'Ketepatan bergantung pada imbasan: halaman yang senget, kabur, beresolusi rendah atau tulisan tangan dibaca dengan buruk.', 'Jadual dan lajur keluar sebagai baris teks biasa dalam salinan, walaupun lapisan tidak kelihatan terletak di atas perkataan yang betul.', 'Dokumen besar mengambil masa: kira-kira beberapa saat setiap halaman.'],
    options: {
      language: { label: 'Bahasa', choices: { 'eng+msa': 'Inggeris dan Melayu', eng: 'Inggeris', msa: 'Melayu' }, help: 'Memilih bahasa halaman sahaja lebih cepat dan tepat sedikit.' },
      skipText: { label: 'Langkau halaman yang sudah ada teks' },
    },
  },
  'pdf/unlock': {
    name: 'Buka Kunci PDF',
    blurb: 'Buang kata laluan yang anda tahu.',
    description: 'Buang kata laluan dan sekatan daripada PDF dalam pelayar anda, menggunakan kata laluan yang anda sudah ada. Tiada apa-apa dimuat naik.',
    keywords: ['buka kunci pdf', 'buang kata laluan', 'nyahsulit pdf'],
    about: 'Menyahsulit fail dengan qpdf, yang dijalankan dalam pelayar anda, dan menyimpan salinan tanpa kata laluan dan tanpa sekatan.',
    limits: ['Ini tidak memecahkan kata laluan. Anda perlukan kata laluan yang membuka fail itu.', 'Buka kunci hanya fail yang anda berhak menggunakannya.'],
    options: {
      password: { label: 'Kata laluan', help: 'Biarkan kosong jika fail dibuka tanpa kata laluan dan anda hanya mahu membuang sekatannya.' },
    },
  },

  // ─── Image ────────────────────────────────────────────────────────────────
  'image/compress': {
    name: 'Mampat imej',
    blurb: 'Kecilkan JPG, PNG dan WebP, atau capai saiz tepat.',
    description: 'Mampatkan imej dalam pelayar anda, atau kecilkan di bawah had tepat seperti 100 KB untuk borang. Ubah kualiti dan lihat saiz berubah. Tiada muat naik.',
    keywords: ['mampat gambar', 'kecilkan gambar', 'kurangkan saiz gambar', 'saiz gambar', 'bawah 100kb', 'bawah 50kb', 'kb', 'had muat naik'],
    about: 'Setiap imej dinyahkod dan dikod semula. Dengan saiz sasaran, alat ini mencari kualiti tertinggi yang masih di bawah had, dan hanya mengecilkan dimensi piksel jika kualiti rendah pun masih terlalu besar. Saiz disasarkan pada 1,000 bait setiap KB, jadi fail lulus walau bagaimana portal mengiranya.',
    limits: ['Pengekodan semula menjejaskan kualiti. Memampatkan imej yang sudah dimampatkan akan menurunkan kualitinya lagi.', 'PNG tidak kehilangan kualiti, jadi mengekalkan PNG jarang menjimatkan apa-apa. Pilih WebP, atau saiz sasaran, untuk benar-benar mengecilkan PNG.', 'Tanpa sasaran, jika pengekodan semula menjadi lebih besar, fail asal dipulangkan tanpa diubah.', 'Ketelusan dikekalkan dalam PNG dan WebP. JPG tiada ketelusan, jadi kawasan lutsinar menjadi putih.'],
    options: {
      target: {
        label: 'Saiz sasaran',
        help: 'Untuk borang dan portal yang ada had saiz. Menurunkan kualiti dahulu dan hanya mengecilkan dimensi jika perlu.',
        choices: { '0': 'Tiada, pilih kualiti', '20': 'Bawah 20 KB', '50': 'Bawah 50 KB', '100': 'Bawah 100 KB', '200': 'Bawah 200 KB', '500': 'Bawah 500 KB', '1000': 'Bawah 1 MB', '2000': 'Bawah 2 MB' },
      },
      quality: { label: 'Kualiti', help: 'Tiada kesan pada PNG, yang tidak kehilangan kualiti.' },
      format: {
        label: 'Output',
        help: 'Kebanyakan portal hanya menerima JPG. Dengan saiz sasaran, PNG menjadi JPG.',
        choices: { auto: 'Kekalkan format asal', webp: 'WebP, biasanya paling kecil', jpeg: 'JPG' },
      },
    },
    variants: {
      '20kb': { name: 'Mampat gambar ke 20 KB', blurb: 'Kecilkan gambar di bawah 20 KB.', description: 'Mampatkan JPG atau gambar di bawah 20 KB dalam pelayar anda, untuk muat naik tandatangan dan gambar yang hadnya sangat kecil. Tiada muat naik.' },
      '50kb': { name: 'Mampat gambar ke 50 KB', blurb: 'Kecilkan gambar di bawah 50 KB.', description: 'Mampatkan JPG atau gambar di bawah 50 KB dalam pelayar anda, untuk borang dalam talian yang hadnya ketat. Tiada muat naik, tiada akaun.' },
      '100kb': { name: 'Mampat gambar ke 100 KB', blurb: 'Kecilkan gambar di bawah 100 KB.', description: 'Mampatkan JPG atau gambar di bawah 100 KB dalam pelayar anda, had yang digunakan banyak borang permohonan. Tiada muat naik, tiada akaun.' },
      '200kb': { name: 'Mampat gambar ke 200 KB', blurb: 'Kecilkan gambar di bawah 200 KB.', description: 'Mampatkan JPG atau gambar di bawah 200 KB dalam pelayar anda untuk borang dan portal. Tiada muat naik, tiada akaun, tiada tera air.' },
      '500kb': { name: 'Mampat gambar ke 500 KB', blurb: 'Kecilkan gambar di bawah 500 KB.', description: 'Mampatkan JPG atau gambar di bawah 500 KB dalam pelayar anda dan kekal tajam. Tiada muat naik, tiada akaun, tiada tera air.' },
      '1mb': { name: 'Mampat gambar ke 1 MB', blurb: 'Kecilkan gambar di bawah 1 MB.', description: 'Mampatkan JPG atau gambar di bawah 1 MB dalam pelayar anda tanpa kehilangan yang ketara. Tiada muat naik, tiada akaun, tiada tera air.' },
      'spa-myresume': {
        name: 'Gambar dan dokumen untuk SPA MyRésumé',
        blurb: 'JPG bawah 1 MB, seperti yang SPA tetapkan.',
        description: 'Kecilkan gambar dan dokumen imbasan di bawah had 1 MB SPA MyRésumé, dalam pelayar anda. Output JPG, tiada muat naik, tiada akaun.',
        about: 'Panduan MyRésumé SPA (PANDUAN_GAMBAR.pdf, disemak 18 September 2026) meminta gambar dan dokumen dalam format .jpg atau .png, setiap satu bawah 1 MB, dan gambar profil 35 mm × 50 mm berlatar belakang putih. Pratetap ini menghasilkan JPG bawah 1 MB. Untuk gambar profil itu sendiri, pembuat gambar pasport ada pratetap SPA.',
      },
    },
  },
  'image/convert': {
    name: 'Tukar imej',
    blurb: 'Tukar antara JPG, PNG, WebP dan AVIF.',
    description: 'Tukar imej antara JPG, PNG, WebP dan AVIF dalam pelayar anda. Penukaran berkelompok tanpa muat naik.',
    keywords: ['tukar gambar', 'png ke jpg', 'jpg ke png', 'tukar format gambar'],
    about: 'Dinyahkod dengan saluran imej pelayar dan dikod semula ke format yang dipilih.',
    limits: ['Pengekodan AVIF bergantung pada sokongan pelayar dan lebih perlahan daripada yang lain.', 'Menukar kepada PNG daripada sumber yang dimampatkan biasanya menjadikan fail lebih besar, bukan lebih kecil.'],
    options: {
      format: { label: 'Tukar kepada', choices: { webp: 'WebP', jpeg: 'JPG', png: 'PNG', avif: 'AVIF' } },
      quality: { label: 'Kualiti', help: 'Diabaikan untuk PNG, yang tidak kehilangan kualiti.' },
    },
  },
  'image/resize': {
    name: 'Ubah saiz imej',
    blurb: 'Skalakan imej kepada dimensi tepat.',
    description: 'Ubah saiz imej dalam pelayar anda. Tetapkan lebar atau tinggi, kekalkan nisbah aspek, dan proses berkelompok tanpa memuat naik.',
    keywords: ['ubah saiz', 'saiz gambar', 'lebar', 'tinggi', 'kecilkan gambar', 'besarkan gambar'],
    about: 'Menskala dengan pensampelan semula berkualiti tinggi pelayar. Menetapkan satu dimensi sahaja mengekalkan nisbah aspek.',
    limits: ['Membesarkan tidak boleh mencipta perincian. Ini pensampelan semula biasa, bukan peningkatan AI.'],
    options: {
      width: { label: 'Lebar', help: '0 untuk dikira daripada tinggi.' },
      height: { label: 'Tinggi', help: '0 untuk dikira daripada lebar.' },
      noUpscale: { label: 'Jangan besarkan', help: 'Biarkan imej yang sudah lebih kecil daripada sasaran.' },
    },
  },
  'image/crop': {
    name: 'Potong imej',
    blurb: 'Potong imej mengikut bentuk atau nisbah.',
    description: 'Potong imej dalam pelayar anda: seret bingkai, pilih nisbah seperti 1:1 atau 16:9, dan simpan dalam format asal. Tiada muat naik, tiada tera air.',
    keywords: ['potong gambar', 'crop gambar', 'segi empat sama', 'nisbah', 'gambar profil'],
    about: 'Seret bingkai atau pemegangnya, atau pilih nisbah tetap. Saiz piksel tepat ditunjukkan semasa anda mengubahnya, dan potongan disimpan dalam format imej itu sendiri.',
    limits: ['Satu imej pada satu masa.', 'JPG dan WebP dikod semula pada kualiti tinggi apabila disimpan; PNG kekal tanpa kehilangan.'],
  },
  'image/rotate': {
    name: 'Putar imej',
    blurb: 'Pusing atau terbalikkan imej.',
    description: 'Putar imej 90 atau 180 darjah, atau terbalikkannya, dalam pelayar anda. Proses beberapa sekali gus. Tiada muat naik, tiada akaun.',
    keywords: ['putar gambar', 'pusing gambar', 'terbalikkan gambar', 'cermin'],
    about: 'Melukis semula setiap imej dalam keadaan dipusing atau dicerminkan dan menyimpannya dalam format asal.',
    limits: ['JPG dan WebP dikod semula pada kualiti tinggi, sedikit kehilangan setiap kali. PNG kekal tanpa kehilangan.'],
    options: {
      action: { label: 'Tindakan', choices: { cw: 'Putar 90° ikut jam', ccw: 'Putar 90° lawan jam', '180': 'Putar 180°', 'flip-h': 'Terbalik mendatar', 'flip-v': 'Terbalik menegak' } },
    },
  },
  'image/watermark': {
    name: 'Tera air imej',
    blurb: 'Cop teks merentasi gambar.',
    description: 'Tambah tera air teks pada imej dalam pelayar anda: berjubin, di tengah atau di penjuru, dengan kelegapan pilihan anda. Proses beberapa sekali gus. Tiada muat naik.',
    keywords: ['tera air gambar', 'watermark gambar', 'hak cipta', 'teks pada gambar'],
    about: 'Melukis teks pada setiap imej dengan garis luar yang samar, supaya ia kekal jelas pada kawasan cerah dan gelap. Susunan berjubin menyukarkan ia dipotong keluar.',
    limits: ['Tera air mengurangkan penggunaan semula; ia tidak dapat menghalangnya. Sesiapa yang bertekad boleh memadamnya.', 'JPG dan WebP dikod semula pada kualiti tinggi.'],
    options: {
      text: { label: 'Teks', placeholder: '© Nama anda' },
      position: { label: 'Kedudukan', choices: { tile: 'Berjubin merentasi imej', center: 'Tengah', 'bottom-right': 'Bawah kanan', 'bottom-left': 'Bawah kiri', 'top-right': 'Atas kanan', 'top-left': 'Atas kiri' } },
      size: { label: 'Saiz' },
      opacity: { label: 'Kelegapan' },
      color: { label: 'Warna', choices: { white: 'Putih', black: 'Hitam', red: 'Merah' } },
    },
  },
  'image/ocr': {
    name: 'Imej ke teks (OCR)',
    seoTitle: 'Imej ke teks (OCR) dalam talian, Melayu dan Inggeris, percuma | Nhako Tools',
    blurb: 'Ambil teks daripada gambar dan tangkapan skrin.',
    description: 'Salin teks daripada gambar, tangkapan skrin dan imbasan dalam pelayar anda dengan OCR, dalam Bahasa Melayu atau Inggeris. Dapatkan teks atau PDF boleh cari.',
    keywords: ['ocr', 'gambar ke teks', 'imej ke teks', 'salin teks dari gambar', 'tangkapan skrin ke teks'],
    about: 'Tesseract, enjin OCR sumber terbuka, berjalan dalam pelayar anda dan membaca setiap imej dalam Bahasa Inggeris, Melayu atau kedua-duanya. Gambar telefon ditegakkan dahulu dan tangkapan skrin kecil dibesarkan, yang kedua-duanya membantu. Anda mendapat teks untuk disalin, dan boleh menyimpannya sebagai .txt atau PDF imej dengan teks yang boleh dicari.',
    limits: ['Penggunaan pertama memuat turun enjin OCR dan data bahasa sekali, kira-kira 15 MB, dari laman ini.', 'Teks bercetak sahaja. Tulisan tangan dibaca dengan buruk atau tidak langsung.', 'Gambar yang lurus, tajam dan terang dibaca jauh lebih baik daripada yang senget atau kabur.', 'Susun atur tidak dikekalkan: lajur dan jadual keluar sebagai baris teks biasa.'],
    options: {
      language: { label: 'Bahasa', choices: { 'eng+msa': 'Inggeris dan Melayu', eng: 'Inggeris', msa: 'Melayu' }, help: 'Memilih bahasa halaman sahaja lebih cepat dan tepat sedikit.' },
      output: { label: 'Simpan sebagai', choices: { text: 'Teks (.txt)', pdf: 'PDF boleh cari' } },
    },
  },
  'image/remove-background': {
    name: 'Buang latar belakang',
    seoTitle: 'Buang latar belakang gambar dalam talian, percuma, tanpa muat naik | Nhako Tools',
    blurb: 'Potong subjek, pada peranti anda.',
    description: 'Buang latar belakang gambar dalam pelayar anda: dapatkan PNG lutsinar, atau subjek atas latar putih. Model AI berjalan pada peranti anda, jadi tiada apa-apa dimuat naik.',
    keywords: ['buang latar belakang', 'padam latar belakang', 'latar lutsinar', 'gambar produk', 'remove bg'],
    about: 'Model segmentasi mencari subjek utama, dan selebihnya dijadikan lutsinar atau diisi putih atau hitam. Terdapat dua model berlesen terbuka: ISNet (Apache-2.0), dilatih pada objek harian, untuk produk dan barang; dan ormbg (Apache-2.0), dilatih pada manusia, yang juga baik untuk haiwan. Kedua-duanya berjalan dalam pelayar anda melalui WebAssembly, jadi gambar tidak pernah meninggalkan peranti anda.',
    limits: ['Penggunaan pertama setiap model memuat turunnya sekali, kira-kira 45 MB, dari Hugging Face: muat turun model, bukan muat naik gambar anda.', 'Tiada model yang sempurna. Model objek mungkin meninggalkan bintik pada rumput atau batu kerikil; model manusia mungkin membuang bahagian objek besar. Semak hasilnya, dan cuba model yang satu lagi jika perlu.', 'Ia mengekalkan subjek paling menonjol. Pemandangan sibuk, seperti rak penuh, mungkin terpotong sebahagiannya.', 'Setiap gambar mengambil kira-kira 10 saat pada komputer riba, lebih lama pada telefon.'],
    options: {
      subject: { label: 'Subjek', choices: { general: 'Objek dan produk', person: 'Manusia dan haiwan' }, help: 'Dua model berbeza, setiap satu dimuat turun sekali apabila pertama kali digunakan. Jika satu meninggalkan cebisan, cuba yang satu lagi.' },
      background: { label: 'Latar belakang', choices: { transparent: 'Lutsinar (PNG)', white: 'Putih (JPG)', black: 'Hitam (JPG)' } },
    },
  },
  'image/heic-to-jpg': {
    name: 'HEIC ke JPG',
    blurb: 'Tukar gambar iPhone kepada JPG.',
    description: 'Tukar gambar HEIC iPhone kepada JPG atau PNG dalam pelayar anda, secara berkelompok. Untuk borang dan portal yang menolak HEIC. Tiada muat naik.',
    keywords: ['heic ke jpg', 'gambar iphone', 'tukar heic', 'heic ke png'],
    about: 'Safari menyahkod HEIC sendiri. Pelayar lain menggunakan libheif, penyahkod HEIC sumber terbuka rujukan, yang dijalankan pada peranti anda dan dimuat turun (kira-kira 1.4 MB) hanya kali pertama ia diperlukan.',
    limits: ['Gerakan Live Photo dan data kedalaman tidak disimpan, hanya imej pegun.', 'Fail HEIC berbilang imej (burst) hanya menukar imej utamanya.'],
    options: {
      format: { label: 'Tukar kepada', choices: { jpeg: 'JPG', png: 'PNG' } },
      quality: { label: 'Kualiti' },
    },
  },
  'image/remove-metadata': {
    name: 'Buang metadata gambar',
    blurb: 'Buang lokasi GPS dan butiran kamera.',
    description: 'Buang data EXIF daripada gambar dalam pelayar anda: lokasi GPS, kamera, tarikh dan banyak lagi, tanpa menyentuh imej itu sendiri. Tiada muat naik.',
    keywords: ['buang exif', 'metadata', 'lokasi gps', 'privasi gambar', 'buang lokasi'],
    about: 'Membuang data EXIF, XMP, IPTC dan komen dengan menyunting struktur fail, jadi gambar itu sendiri kekal sama bait demi bait. Ia memberitahu anda apa yang ditemui dahulu, termasuk sebarang lokasi GPS, yang selalunya alamat rumah. Profil warna dan penanda putaran dikekalkan, jadi gambar masih kelihatan dan menghadap arah yang sama.',
    limits: ['JPG, PNG dan WebP sahaja. Tukar HEIC ke JPG dahulu.', 'Piksel imej tidak diubah, jadi apa-apa yang kelihatan dalam gambar (papan tanda jalan, muka) masih ada.'],
  },
  'image/passport-photo': {
    name: 'Pembuat gambar pasport',
    seoTitle: 'Buat gambar pasport 35×50 mm, latar belakang putih | Nhako Tools',
    blurb: 'Potong gambar 35×50 mm, latar putih, helaian cetak.',
    description: 'Buat gambar pasport atau permohonan 35×50 mm dalam pelayar anda: potong, latar belakang putih, fail digital dan helaian cetak 4R. Tiada muat naik.',
    keywords: ['gambar pasport', 'gambar passport', 'saiz gambar pasport', '35x50', 'latar belakang putih', 'gambar spa', 'gambar permohonan', 'cetak gambar'],
    about: 'Lepaskan gambar, selaraskan muka anda dengan panduan, dan simpan JPG digital serta helaian 4R (4×6 inci) yang sedia dicetak di mana-mana kedai gambar. Latar belakang boleh ditukar kepada putih kosong oleh model segmentasi kecil yang berjalan pada peranti anda.',
    limits: ['Jabatan Imigresen Malaysia mengambil gambar pasport dewasa di kaunter. Gambar bercetak 35×50 mm berlatar putih hanya diminta untuk kanak-kanak bawah 4 tahun.', 'Penukaran latar belakang paling baik dengan garis bentuk yang jelas di hadapan dinding kosong. Hujung rambut yang halus mungkin perlu dicuba lagi dengan pencahayaan lebih baik.', 'Alat ini menyemak saiz dan kedudukan, bukan sama ada pejabat akan menerima riak muka, pencahayaan atau cermin mata anda. Setiap pejabat membuat keputusan akhir.'],
  },

  // ─── Calculators ──────────────────────────────────────────────────────────
  'calc/take-home-pay': {
    name: 'Kalkulator gaji bersih',
    seoTitle: 'Kalkulator gaji bersih 2026: KWSP, PERKESO, SIP, PCB | Nhako Tools',
    blurb: 'Gaji bersih selepas KWSP, PERKESO, SIP dan PCB.',
    description: 'Kira gaji bersih 2026 anda: KWSP, PERKESO termasuk LINDUNG 24 Jam, SIP dan PCB, daripada jadual rasmi. Percuma, tanpa daftar.',
    keywords: ['kalkulator gaji', 'gaji bersih', 'potongan gaji', 'kira gaji', 'caruman kwsp', 'caruman perkeso', 'potongan cukai bulanan', 'slip gaji'],
    about: 'Masukkan gaji bulanan dan maklumat isi rumah anda, dan dapatkan setiap potongan berkanun berserta caruman majikan. KWSP daripada Jadual Ketiga, PERKESO dan SIP daripada jadual PERKESO, dan PCB daripada formula yang diterbitkan LHDN, disemak dengan contoh pengiraan LHDN sendiri hingga ke sen.',
    limits: ['Untuk warganegara dan penduduk tetap Malaysia bawah 60 tahun dengan gaji bulanan yang tetap. Kadar KWSP dan PERKESO berbeza dari umur 60 dan untuk pekerja asing.', 'PCB ialah jumlah bulanan biasa untuk gaji yang sama sepanjang tahun. Bonus, mula bekerja pertengahan tahun atau potongan TP1 mengubahnya, dan sistem gaji majikan anda mempunyai angka muktamad.', 'PCB ialah potongan ke arah cukai pendapatan anda, bukan bil akhir. Borang e-Filing anda menyelesaikan tahun tersebut.'],
  },

  // ─── Media ────────────────────────────────────────────────────────────────
  'media/compress-video': {
    name: 'Mampat video',
    blurb: 'Capai saiz fail sasaran, dalam pelayar anda.',
    description: 'Mampatkan video ke saiz sasaran dalam pelayar anda menggunakan ffmpeg.wasm. Tiada muat naik, tiada had saiz, tiada akaun.',
    keywords: ['mampat video', 'kecilkan video', 'saiz video', 'kurangkan saiz video'],
    about: 'Mengira kadar bit yang diperlukan untuk mencapai saiz sasaran berdasarkan panjang video, kemudian mengekod semula pada kadar bit itu. Audio dikod semula pada kadar bit yang diketahui supaya kiraan saiz benar-benar tepat.',
    limits: ['Berjalan kira-kira pada masa nyata atau lebih perlahan. Video 5 minit mengambil beberapa minit, bukan saat.', 'Pengekodan satu laluan, jadi saiz akhir hampir dengan sasaran tetapi jarang tepat.', 'Perlukan pelayar desktop untuk fail besar; memori telefon adalah kekangan utama.'],
    options: {
      targetMB: { label: 'Saiz sasaran', help: 'Pengekod menyasarkan saiz ini. Jangkakan hasil dalam lingkungan beberapa peratus.' },
      audio: { label: 'Audio', choices: { '128': '128 kbps, lalai', '96': '96 kbps', '64': '64 kbps, fail lebih kecil', none: 'Buang audio' } },
    },
  },
  'media/extract-audio': {
    name: 'Ekstrak audio',
    blurb: 'Keluarkan trek audio daripada video sebagai MP3.',
    description: 'Keluarkan audio daripada video ke MP3 dalam pelayar anda. Tiada muat naik dan tiada had panjang.',
    keywords: ['ekstrak audio', 'video ke mp3', 'ambil audio', 'tukar video ke mp3'],
    about: 'Membuang strim video dan mengekod semula audio ke MP3.',
    limits: ['Pengekodan semula ke MP3 menjejaskan kualiti. Audio sumber sudah dimampatkan, jadi ini generasi kedua.'],
    options: {
      bitrate: { label: 'Kualiti', choices: { '320': '320 kbps', '192': '192 kbps, lalai', '128': '128 kbps' } },
    },
  },
  'media/transcribe': {
    name: 'Audio ke teks',
    seoTitle: 'Audio ke teks dalam talian, Bahasa Melayu dan Inggeris, percuma | Nhako Tools',
    blurb: 'Transkripsi pertuturan Melayu atau Inggeris, pada peranti anda.',
    description: 'Transkripsikan audio dan video kepada teks dalam pelayar anda dengan Whisper, dalam Bahasa Melayu, Inggeris dan bahasa lain. Model berjalan pada peranti anda.',
    keywords: ['transkripsi', 'audio ke teks', 'suara ke teks', 'sari kata', 'transkripsi bahasa melayu', 'rakaman ke teks'],
    about: 'Menjalankan OpenAI Whisper pada peranti anda melalui WebAssembly. Bahasa Inggeris menggunakan model khas Inggeris; Bahasa Melayu dan bahasa lain menggunakan model berbilang bahasa. Model dimuat turun sekali dan disimpan oleh pelayar anda untuk setiap penggunaan seterusnya. Transkrip dipaparkan sedia untuk disalin, dan disimpan sebagai .txt.',
    limits: ['Whisper lebih lemah dalam Bahasa Melayu berbanding Inggeris. Pada 12 ayat Bahasa Melayu yang dibaca dengan jelas daripada set FLEURS Google, Pantas tersilap kira-kira 4 daripada 10 perkataan dan Tepat kira-kira 1 daripada 4. Gunakan Tepat untuk Bahasa Melayu, dan semak hasilnya.', 'Penggunaan pertama setiap model memuat turun pemberatnya sekali, dari 41 MB hingga 250 MB. Selepas itu ia berfungsi tanpa talian.', 'Ketepatan jauh lebih rendah daripada model awan bersaiz penuh, terutamanya dengan loghat, beberapa penutur, campuran bahasa atau bunyi latar.', 'Rakaman panjang adalah perlahan: jangkakan sebahagian besar tempoh audio, dan lebih lama dengan model Tepat.'],
    options: {
      language: { label: 'Bahasa', choices: { en: 'Inggeris', ms: 'Melayu', auto: 'Kesan (bahasa lain)' } },
      quality: { label: 'Model', choices: { fast: 'Pantas, muat turun lebih kecil', accurate: 'Tepat, muat turun lebih besar' }, help: 'Inggeris: 41 MB atau 77 MB. Melayu dan bahasa lain: 77 MB atau 250 MB. Setiap satu dimuat turun sekali.' },
    },
  },

  'media/teleprompter': {
    name: 'Teleprompter',
    seoTitle: 'Teleprompter dalam talian dengan rakaman kamera, percuma | Nhako Tools',
    blurb: 'Baca skrip pada tablet, dan rakam diri anda.',
    description: 'Teleprompter dalam talian percuma untuk tablet: tetapkan kelajuan perkataan seminit, cerminkan untuk rig, kawal dengan pedal atau telefon, dan rakam diri anda.',
    keywords: ['teleprompter', 'skrip', 'autocue', 'rakam video', 'ucapan', 'pembentangan', 'teleprompter ipad', 'teleprompter percuma'],
    about: 'Taip atau import skrip, kemudian bacanya dalam skrin penuh pada kelajuan perkataan seminit yang tetap, dengan garis bacaan tinggi pada skrin supaya mata anda kekal dekat dengan kamera. Tambah bahagian untuk dilompat, isyarat [JEDA] yang menghentikan tatalan, dan serlahan. Kawal dengan ketikan, papan kekunci, pemusing halaman Bluetooth atau pedal kaki, atau telefon anda. Rakam kamera dan mikrofon semasa membaca; rakaman disimpan pada peranti ini.',
    limits: [
      'Rakaman disimpan dalam storan pelayar ini pada peranti ini. Mengosongkan data laman akan memadamnya, jadi muat turun rakaman yang anda mahu simpan.',
      'Alat kawalan telefon memerlukan kedua-dua peranti dalam talian. Ia hanya menghantar tekanan butang melalui geganti yang dikendalikan oleh Supabase, tidak pernah skrip, video atau audio anda.',
      'Ikut suara menggunakan pengecaman pertuturan pelayar anda, yang dalam Chrome dan Edge menghantar suara anda ke Google semasa ia mendengar. Ia dimatikan melainkan anda menghidupkannya.',
      'Rakaman panjang belum diuji pada setiap tablet. Cuba rakaman pendek dahulu pada peranti baharu.',
    ],
  },

  // ─── Developer ────────────────────────────────────────────────────────────
  'dev/json': {
    name: 'Pemformat JSON',
    blurb: 'Format, sahkan dan kecilkan JSON.',
    description: 'Format dan sahkan JSON dalam pelayar anda dengan penyerlahan sintaks. Menunjukkan baris tepat bagi ralat sintaks.',
    keywords: ['format json', 'sahkan json', 'kemas json'],
    about: 'Menghurai dengan penghurai JSON pelayar sendiri, jadi apa yang sah di sini adalah betul-betul apa yang sah dalam kod anda. Ralat melaporkan baris dan lajur.',
    limits: ['JSON ketat sahaja. Tiada komen, tiada koma di hujung, tiada petikan tunggal.'],
    options: {
      indent: { label: 'Inden', choices: { '2': '2 ruang', '4': '4 ruang', tab: 'Tab', '0': 'Kecilkan' } },
      sortKeys: { label: 'Isih kunci' },
    },
  },
  'dev/jwt': {
    name: 'Penyahkod JWT',
    blurb: 'Nyahkod pengepala dan muatan token.',
    description: 'Nyahkod JSON Web Token dalam pelayar anda. Token tidak pernah dihantar ke mana-mana, yang penting kerana token adalah kelayakan log masuk.',
    keywords: ['nyahkod jwt', 'token'],
    about: 'Memisahkan token, menyahkod pengepala dan muatan base64url, dan memaparkan tuntutannya. Tuntutan masa (`exp`, `iat`, `nbf`) dipaparkan sebagai tarikh yang boleh dibaca bersama nilai mentahnya.',
    limits: ['Nyahkod sahaja. Tandatangan tidak disahkan, dan token yang dinyahkod bukan token yang dipercayai.', 'Jangan tampal token produksi ke dalam alat yang memuat naiknya. Alat ini tidak, dan anda boleh mengesahkannya dalam tab rangkaian.'],
  },
  'dev/base64': {
    name: 'Penukar Base64',
    blurb: 'Kod dan nyahkod Base64.',
    description: 'Kod dan nyahkod Base64 dalam pelayar anda, dengan sokongan Unicode penuh dan output selamat untuk URL.',
    keywords: ['kod base64', 'nyahkod base64'],
    about: 'Mengendalikan UTF-8 berbilang bait dengan betul dalam kedua-dua arah, jadi emoji dan tulisan bukan Latin kembali dengan tepat.',
    limits: ['Teks sahaja. Untuk fail, gunakan alat fail.'],
    options: {
      mode: { label: 'Mod', choices: { encode: 'Kod', decode: 'Nyahkod' } },
      urlSafe: { label: 'Abjad selamat URL', help: 'Menggunakan - dan _ bukannya + dan /, dan membuang pad.' },
    },
  },
  'dev/word-count': {
    name: 'Pengira perkataan',
    blurb: 'Kiraan perkataan, aksara dan masa membaca secara langsung.',
    description: 'Kira perkataan, aksara, ayat dan masa membaca semasa anda menaip. Tiada apa-apa dihantar ke mana-mana.',
    keywords: ['kira perkataan', 'bilangan perkataan', 'kira aksara', 'masa membaca'],
    about: 'Kiraan dikemas kini pada setiap ketukan kekunci. Masa membaca menganggap 200 perkataan seminit, masa bercakap 130.',
    limits: ['Kiraan perkataan dipisahkan mengikut ruang, jadi bahasa yang tidak menggunakan ruang antara perkataan akan terkurang kira.'],
  },
  'dev/hash': {
    name: 'Penjana cincangan',
    blurb: 'SHA-1, SHA-256, SHA-384 dan SHA-512.',
    description: 'Jana cincangan SHA dalam pelayar anda menggunakan API Web Crypto asli. Tiada apa-apa dimuat naik.',
    keywords: ['cincangan', 'hash', 'checksum'],
    about: 'Menggunakan pelaksanaan Web Crypto terbina dalam pelayar, primitif yang sama digunakan masa jalan anda.',
    limits: ['MD5 tidak ditawarkan. Web Crypto sengaja meninggalkannya kerana ia tidak selamat untuk kegunaan keselamatan.', 'SHA-1 disertakan untuk menyemak checksum lama sahaja. Jangan gunakannya untuk keselamatan.'],
    options: {
      algo: { label: 'Algoritma', choices: { 'SHA-1': 'SHA-1', 'SHA-256': 'SHA-256', 'SHA-384': 'SHA-384', 'SHA-512': 'SHA-512' } },
    },
  },
  'dev/uuid': {
    name: 'Penjana UUID',
    blurb: 'UUID rawak secara kriptografi.',
    description: 'Jana UUID v4 dalam pelayar anda menggunakan API kripto asli. Penjanaan pukal, tiada muat naik.',
    keywords: ['jana uuid', 'pengecam unik'],
    about: 'Menggunakan `crypto.randomUUID()`, yang diambil daripada CSPRNG platform. Sesuai untuk pengecam sebenar, bukan sekadar pemegang tempat.',
    limits: ['Versi 4 sahaja, yang rawak dan tidak tersusun mengikut masa. Jika anda perlukan id yang boleh diisih, gunakan UUIDv7 atau ULID.'],
    options: {
      count: { label: 'Berapa banyak' },
      uppercase: { label: 'Huruf besar' },
      braces: { label: 'Balut dengan kurungan' },
    },
  },
  'dev/qr': {
    name: 'Penjana kod QR',
    blurb: 'Tukar teks atau URL kepada kod QR.',
    description: 'Jana kod QR dalam pelayar anda dan muat turun sebagai PNG. Tiada muat naik, tiada pautan penjejakan, tiada tarikh luput.',
    keywords: ['kod qr', 'buat qr', 'jana qr'],
    about: 'Kod QR mengekod teks anda secara langsung. Banyak penjana dalam talian mengekod pautan lencongan melalui domain mereka sendiri, jadi kod berhenti berfungsi apabila mereka berhenti. Yang ini tidak.',
    limits: ['Kira-kira 2,900 aksara pada pembetulan ralat terendah, jauh lebih sedikit pada yang tertinggi.'],
    options: {
      size: { label: 'Saiz' },
      ec: { label: 'Pembetulan ralat', help: 'Lebih tinggi lebih tahan kerosakan, tetapi kodnya lebih padat.', choices: { L: 'L (7%)', M: 'M (15%)', Q: 'Q (25%)', H: 'H (30%)' } },
      margin: { label: 'Sempadan zon senyap' },
    },
  },
  'dev/diff': {
    name: 'Banding teks',
    blurb: 'Bandingkan dua blok teks.',
    description: 'Bandingkan dua teks dan lihat dengan tepat apa yang berubah, baris demi baris atau perkataan demi perkataan. Berjalan sepenuhnya dalam pelayar anda.',
    keywords: ['banding teks', 'beza teks', 'perbezaan'],
    about: 'Perbandingan standard antara dua input, dengan tambahan dan pembuangan ditanda dalam baris.',
    limits: ['Teks biasa sahaja. Tiada kesedaran sintaks dan tiada gabungan tiga hala.'],
    options: {
      granularity: { label: 'Banding mengikut', choices: { line: 'Baris', word: 'Perkataan', char: 'Aksara' } },
      ignoreWhitespace: { label: 'Abaikan ruang kosong' },
    },
  },
  'dev/css-shadow': {
    name: 'Penjana bayang CSS',
    blurb: 'Bina box-shadow dengan pratonton langsung.',
    description: 'Jana kod CSS box-shadow dengan peluncur dan pratonton langsung. Salin hasilnya terus ke dalam helaian gaya anda.',
    keywords: ['bayang css', 'box shadow'],
    about: 'Menghasilkan satu deklarasi `box-shadow`. Pratonton menggunakan nilai tepat yang akan anda tampal.',
    limits: ['Satu lapisan bayang. Bayang bertindan lebih meyakinkan, tetapi itu alat lain.'],
    options: {
      x: { label: 'Ofset X' },
      y: { label: 'Ofset Y' },
      blur: { label: 'Kabur' },
      spread: { label: 'Sebaran' },
      opacity: { label: 'Kelegapan' },
      color: { label: 'Warna', placeholder: '#131316' },
      inset: { label: 'Ke dalam' },
    },
  },
};

function localizeOption(spec: OptionSpec, text: OptionText | undefined): OptionSpec {
  if (!text) return spec;
  const out = { ...spec, label: text.label, help: text.help ?? spec.help } as OptionSpec;
  if ('placeholder' in out && text.placeholder) out.placeholder = text.placeholder;
  if (out.kind === 'select' && text.choices) {
    out.choices = out.choices.map((c) => ({ value: c.value, label: text.choices?.[c.value] ?? c.label }));
  }
  return out;
}

/** The tool as a page in `locale` shows it. English returns the tool unchanged. */
export function localizeTool(tool: ToolMeta, locale: Locale): ToolMeta {
  if (locale === 'en') return tool;
  const t = MS[toolId(tool)];
  if (!t) return tool;
  return {
    ...tool,
    name: t.name,
    seoTitle: t.seoTitle,
    blurb: t.blurb,
    description: t.description,
    keywords: [...tool.keywords, ...t.keywords],
    about: t.about ?? tool.about,
    limits: t.limits ?? tool.limits,
    options: tool.options?.map((o) => localizeOption(o, t.options?.[o.key])),
    variants: tool.variants?.map((v) => localizeVariant(tool, v, locale)),
  };
}

export function localizeVariant(tool: ToolMeta, variant: ToolVariant, locale: Locale): ToolVariant {
  if (locale === 'en') return variant;
  const t = MS[toolId(tool)]?.variants?.[variant.slug];
  return t ? { ...variant, ...t } : variant;
}
