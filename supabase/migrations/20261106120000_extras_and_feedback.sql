-- Egna varor i inköpslistan (oberoende av recepten) och förslag på ändringar i appen.

create table if not exists public.shopping_extras (
  id           bigint generated always as identity primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 120),
  checked      boolean not null default false,
  created_by   uuid default auth.uid() references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists shopping_extras_household_idx on public.shopping_extras(household_id);

create table if not exists public.feedback (
  id           bigint generated always as identity primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  text         text not null check (char_length(text) between 1 and 2000),
  created_by   uuid default auth.uid() references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  done_at      timestamptz
);
create index if not exists feedback_household_idx on public.feedback(household_id);

alter table public.shopping_extras enable row level security;
alter table public.feedback enable row level security;

drop policy if exists "medlemmar läser och skriver" on public.shopping_extras;
create policy "medlemmar läser och skriver" on public.shopping_extras
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists "medlemmar läser och skriver" on public.feedback;
create policy "medlemmar läser och skriver" on public.feedback
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

grant select, insert, update, delete on public.shopping_extras, public.feedback to authenticated;
grant all on public.shopping_extras, public.feedback to service_role;
grant usage, select on all sequences in schema public to authenticated;

-- Ändringar syns direkt hos den andra i köket.
do $$
begin
  alter publication supabase_realtime add table public.shopping_extras;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.feedback;
exception when duplicate_object then null;
end $$;
