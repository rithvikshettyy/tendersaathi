-- TenderSaathi: tenders (with computed results), chat history, usage events and an analytics view.
-- Applied to the Supabase project. Every table is row-level-secured to the signed-in user.
create table public.tenders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ext_id text not null,
  title text not null default '',
  link text not null default '',
  snippet text not null default '',
  source text not null default '',
  kind text not null default '',
  org text not null default '',
  category text not null default '',
  deadline text not null default '',
  found_at timestamptz,
  demo boolean not null default false,
  analysis jsonb,
  intel jsonb,
  checklist jsonb not null default '{}'::jsonb,
  readiness_score integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, ext_id)
);
create index tenders_user_found_idx on public.tenders (user_id, found_at desc);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  lang text not null default 'en',
  sources text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index chat_messages_user_idx on public.chat_messages (user_id, created_at);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index events_user_idx on public.events (user_id, created_at desc);
create index events_type_idx on public.events (type, created_at desc);

alter table public.tenders enable row level security;
alter table public.chat_messages enable row level security;
alter table public.events enable row level security;

create policy "tenders_select_own" on public.tenders for select to authenticated using ((select auth.uid()) = user_id);
create policy "tenders_insert_own" on public.tenders for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "tenders_update_own" on public.tenders for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "tenders_delete_own" on public.tenders for delete to authenticated using ((select auth.uid()) = user_id);
create policy "chat_select_own" on public.chat_messages for select to authenticated using ((select auth.uid()) = user_id);
create policy "chat_insert_own" on public.chat_messages for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "chat_delete_own" on public.chat_messages for delete to authenticated using ((select auth.uid()) = user_id);
create policy "events_select_own" on public.events for select to authenticated using ((select auth.uid()) = user_id);
create policy "events_insert_own" on public.events for insert to authenticated with check ((select auth.uid()) = user_id);

create trigger tenders_touch before update on public.tenders for each row execute function public.touch_updated_at();

create view public.user_analytics with (security_invoker = true) as
select
  p.id as user_id,
  p.company_name,
  (select count(*) from public.tenders t where t.user_id = p.id and not t.demo) as tenders_live,
  (select count(*) from public.tenders t where t.user_id = p.id and t.demo) as tenders_sample,
  (select count(*) from public.tenders t where t.user_id = p.id and t.analysis is not null) as pdfs_analysed,
  (select count(*) from public.tenders t where t.user_id = p.id and t.analysis->>'verdict' = 'Well aligned') as well_aligned,
  (select count(*) from public.tenders t where t.user_id = p.id and t.analysis->>'verdict' = 'Partially aligned') as partially_aligned,
  (select count(*) from public.tenders t where t.user_id = p.id and t.analysis->>'verdict' = 'Not aligned') as not_aligned,
  (select round(avg((t.analysis->>'scope_match_pct')::numeric)) from public.tenders t where t.user_id = p.id and t.analysis is not null) as avg_scope_match,
  (select count(*) from public.tenders t where t.user_id = p.id and t.intel is not null) as risk_checked,
  (select count(*) from public.tenders t where t.user_id = p.id and t.intel->>'risk_level' = 'High') as high_risk_buyers,
  (select round(avg(t.readiness_score)) from public.tenders t where t.user_id = p.id and t.readiness_score is not null) as avg_bid_readiness,
  (select count(*) from public.chat_messages c where c.user_id = p.id and c.role = 'user') as chat_questions,
  (select count(*) from public.events e where e.user_id = p.id) as total_events,
  (select max(e.created_at) from public.events e where e.user_id = p.id) as last_active
from public.profiles p;
