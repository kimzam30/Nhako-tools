// Mirrors public.tools_feedback into the Notion database "💬 Feedback" (Hakim's Hub / Nhako Tools).
// Fired by the AFTER INSERT trigger tools_feedback_notion_sync; the request body is ignored.
// It syncs every row whose notion_synced_at is null, so a failed run heals on the next insert.
// One-way: Supabase -> Notion. Edit `Status` in Notion to triage; it is not written back.
// Secret needed: NOTION_TOKEN (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected).
import { createClient } from 'npm:@supabase/supabase-js@2';

const NOTION_DATABASE_ID = '88b0cbcb-9b9b-4e2f-9410-a75f46762147';
const NOTION_VERSION = '2022-06-28';
const BATCH = 20;

type Row = {
  id: number;
  created_at: string;
  kind: string;
  tool: string | null;
  rating: number | null;
  message: string;
  contact: string | null;
  role: string | null;
  locale: string | null;
  page: string | null;
  status: string;
};

const text = (value: string) => ({ rich_text: [{ type: 'text', text: { content: value } }] });

function properties(row: Row) {
  const title = row.message.replace(/\s+/g, ' ').trim().slice(0, 100);
  const props: Record<string, unknown> = {
    Message: { title: [{ type: 'text', text: { content: title } }] },
    'Supabase ID': { number: row.id },
    Kind: { select: { name: row.kind } },
    Status: { select: { name: row.status } },
    Received: { date: { start: row.created_at } },
  };
  if (row.tool) props.Tool = text(row.tool);
  if (row.rating != null) props.Rating = { number: row.rating };
  if (row.contact) props.Contact = text(row.contact);
  if (row.role) props.Role = { select: { name: row.role } };
  if (row.locale) props.Locale = { select: { name: row.locale } };
  if (row.page) props.Page = text(row.page);
  return props;
}

// Notion caps a rich-text item at 2000 characters; messages go up to 4000.
function body(message: string) {
  const blocks = [];
  for (let i = 0; i < message.length; i += 2000) {
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: [{ type: 'text', text: { content: message.slice(i, i + 2000) } }] },
    });
  }
  return blocks;
}

async function notion(path: string, init: { method: string; body: unknown }, token: string) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(init.body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Notion ${res.status}: ${json.message ?? JSON.stringify(json)}`);
  return json;
}

Deno.serve(async () => {
  const token = Deno.env.get('NOTION_TOKEN');
  if (!token) return Response.json({ error: 'NOTION_TOKEN secret is not set' }, { status: 500 });

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data, error } = await db
    .from('tools_feedback')
    .select('id, created_at, kind, tool, rating, message, contact, role, locale, page, status')
    .is('notion_synced_at', null)
    .order('id')
    .limit(BATCH);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const synced: number[] = [];
  const failed: { id: number; error: string }[] = [];
  for (const row of (data ?? []) as Row[]) {
    try {
      // A previous run may have created the page and died before stamping the row.
      const existing = await notion(
        `/databases/${NOTION_DATABASE_ID}/query`,
        { method: 'POST', body: { filter: { property: 'Supabase ID', number: { equals: row.id } }, page_size: 1 } },
        token,
      );
      if (existing.results.length === 0) {
        await notion(
          '/pages',
          {
            method: 'POST',
            body: {
              parent: { database_id: NOTION_DATABASE_ID },
              properties: properties(row),
              children: body(row.message),
            },
          },
          token,
        );
      }
      const { error: stamp } = await db
        .from('tools_feedback')
        .update({ notion_synced_at: new Date().toISOString() })
        .eq('id', row.id);
      if (stamp) throw new Error(stamp.message);
      synced.push(row.id);
    } catch (e) {
      failed.push({ id: row.id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return Response.json({ synced, failed }, { status: failed.length ? 502 : 200 });
});
