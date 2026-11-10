-- Mirror every new tools_feedback row into Notion (Hakim's Hub / Nhako Tools / Feedback).
-- An AFTER INSERT trigger pings the notion-feedback-sync Edge Function through pg_net.
-- The function reads rows where notion_synced_at is null, so it also retries earlier failures.
-- The ping must never block or fail a visitor's insert, hence the exception handler.
create extension if not exists pg_net with schema extensions;

-- Not in the anon insert grant, so visitors cannot set it.
alter table public.tools_feedback add column notion_synced_at timestamptz;

create or replace function public.tools_feedback_notion_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform net.http_post(
    url := 'https://iznnnsiojfcbncrdqzyh.supabase.co/functions/v1/notion-feedback-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      -- Legacy anon key (public by design); the function ignores the body and uses its own service role.
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6bm5uc2lvamZjYm5jcmRxenloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NDk0NzcsImV4cCI6MjA5OTMyNTQ3N30.xgOIgiB3mX6nWL7oqb8_m-whuOVnwbAUprTjOXLMlto'
    ),
    body := '{}'::jsonb
  );
  return new;
exception when others then
  return new;
end;
$$;

revoke all on function public.tools_feedback_notion_sync() from public, anon, authenticated;

create trigger tools_feedback_notion_sync
  after insert on public.tools_feedback
  for each row execute function public.tools_feedback_notion_sync();
