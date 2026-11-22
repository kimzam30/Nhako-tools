-- Nhako Tools anonymous task events (src/lib/events.ts).
-- Applied to NhakoEcoDB (iznnnsiojfcbncrdqzyh) on 2026-11-22 as migration "tool_events", at the owner's request.
-- The public can INSERT a row and nothing else: no select, update or delete.
-- There is deliberately no column for an IP address, a user id, a file name or error text.
create table public.tool_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  tool text not null check (char_length(tool) between 1 and 60),
  event text not null check (event in ('run_start','run_ok','run_error','run_cancel','file_added','download')),
  locale text not null check (locale in ('en','ms')),
  device text not null check (device in ('mobile','desktop')),
  files smallint check (files is null or files between 0 and 999),
  size_class text check (size_class is null or size_class in ('<1MB','1-10MB','10-100MB','100MB+')),
  ms integer check (ms is null or ms between 0 and 86400000),
  error text check (error is null or error in ('tool','crash'))
);

comment on table public.tool_events is 'Nhako Tools anonymous task events. Anon may insert only.';

create index tool_events_created_at on public.tool_events (created_at);

alter table public.tool_events enable row level security;

revoke all on public.tool_events from anon, authenticated;
grant insert (tool, event, locale, device, files, size_class, ms, error) on public.tool_events to anon, authenticated;

create policy "anyone can record an event"
  on public.tool_events for insert
  to anon, authenticated
  with check (true);

-- Flood guard: at most 600 events a minute across everyone.
create or replace function public.tool_events_flood_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.tool_events where created_at > now() - interval '1 minute') >= 600 then
    raise exception 'Too many events' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.tool_events_flood_guard() from public, anon, authenticated;

create trigger tool_events_flood_guard
  before insert on public.tool_events
  for each row execute function public.tool_events_flood_guard();

-- Daily rollup for the KPI table: runs, success rate and median time per tool.
create or replace view public.tool_events_daily
with (security_invoker = true) as
select
  date_trunc('day', created_at)::date as day,
  tool,
  locale,
  device,
  count(*) filter (where event = 'run_start') as runs,
  count(*) filter (where event = 'run_ok') as ok,
  count(*) filter (where event = 'run_error' and error = 'tool') as user_errors,
  count(*) filter (where event = 'run_error' and error = 'crash') as crashes,
  round(100.0 * count(*) filter (where event = 'run_ok')
    / nullif(count(*) filter (where event = 'run_start'), 0), 1) as success_pct,
  percentile_cont(0.5) within group (order by ms) filter (where event = 'run_ok') as median_ms
from public.tool_events
group by 1, 2, 3, 4;

revoke all on public.tool_events_daily from anon, authenticated;
