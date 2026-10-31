-- Vikter per enhet som köket själv anger, t.ex. "1 st gul lök = 150 g"
-- eller "1 dl kokosmjölk = 98 g". Gäller alla recept i köket med samma livsmedel.
-- Volymenheter sparas omräknade till dl, så att msk, tsk och dl delar samma vikt.

create table if not exists public.household_unit_weights (
  household_id uuid not null references public.households(id) on delete cascade,
  lv_food_id   int not null,
  unit         text not null,            -- 'st', 'dl', 'burk', 'paket', 'kruka' …
  grams        numeric not null check (grams > 0 and grams < 100000),
  updated_at   timestamptz not null default now(),
  primary key (household_id, lv_food_id, unit)
);

alter table public.household_unit_weights enable row level security;

create policy "medlemmar läser och skriver" on public.household_unit_weights
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

grant select, insert, update, delete on public.household_unit_weights to authenticated;
grant all on public.household_unit_weights to service_role;
