-- Nhako Tools feedback inbox (tools.nhako.com/feedback).
-- Applied to NhakoEcoDB (iznnnsiojfcbncrdqzyh) on 2026-09-25 as migration "tools_feedback".
-- The public can INSERT a row and nothing else: no select, update or delete.
-- Read submissions in the Supabase dashboard (Table editor > tools_feedback),
-- and move `status` through new > read > planned > done / wont as you triage.
create table public.tools_feedback (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('complaint','review','suggestion','bug','tool-request','other')),
  tool text check (tool is null or char_length(tool) <= 60),
  rating smallint check (rating is null or rating between 1 and 5),
  message text not null check (char_length(btrim(message)) between 5 and 4000),
  contact text check (contact is null or char_length(contact) <= 200),
  role text check (role is null or role in ('student','teacher','work','other')),
  locale text check (locale is null or locale in ('en','ms')),
  page text check (page is null or char_length(page) <= 200),
  status text not null default 'new' check (status in ('new','read','planned','done','wont'))
);

comment on table public.tools_feedback is 'Nhako Tools public feedback form. Anon may insert only.';

alter table public.tools_feedback enable row level security;

revoke all on public.tools_feedback from anon, authenticated;
grant insert (kind, tool, rating, message, contact, role, locale, page) on public.tools_feedback to anon, authenticated;

create policy "anyone can send feedback"
  on public.tools_feedback for insert
  to anon, authenticated
  with check (status = 'new');

-- A crude global flood guard: at most 20 submissions a minute across everyone.
create or replace function public.tools_feedback_flood_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.tools_feedback where created_at > now() - interval '1 minute') >= 20 then
    raise exception 'Too much feedback right now, please try again in a minute' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.tools_feedback_flood_guard() from public, anon, authenticated;

create trigger tools_feedback_flood_guard
  before insert on public.tools_feedback
  for each row execute function public.tools_feedback_flood_guard();

create index tools_feedback_created_at_idx on public.tools_feedback (created_at desc);
