-- TenderSaathi: one company profile per signed-in user. Applied to the Supabase project.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  company_name text not null default '',
  gstin text not null default '',
  udyam text not null default '',
  state text not null default '',
  city text not null default '',
  size text not null default 'micro' check (size in ('micro','small','medium','large')),
  turnover_cr numeric(12,2) not null default 0,
  years integer not null default 0,
  certifications text not null default '',
  products text not null default '',
  services text not null default '',
  women_owned boolean not null default false,
  startup boolean not null default false,
  categories text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- A signed-in user can read and change only their own row.
create policy "profiles_select_own" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
