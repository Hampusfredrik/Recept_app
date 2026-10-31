-- Favoritrecept (delas av alla i köket) och avbockade varor i veckans inköpslista.

alter table public.recipes
  add column if not exists is_favorite boolean not null default false;

create table if not exists public.shopping_checks (
  household_id uuid not null references public.households(id) on delete cascade,
  week_start   date not null,            -- måndagen i veckan
  item_key     text not null,
  created_at   timestamptz not null default now(),
  primary key (household_id, week_start, item_key)
);

alter table public.shopping_checks enable row level security;

create policy "medlemmar läser och skriver" on public.shopping_checks
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

grant select, insert, update, delete on public.shopping_checks to authenticated;
grant all on public.shopping_checks to service_role;
