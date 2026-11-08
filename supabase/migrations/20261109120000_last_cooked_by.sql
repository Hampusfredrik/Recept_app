-- Vem i köket som senast lagade receptet.
alter table public.recipes
  add column if not exists last_cooked_by uuid references auth.users(id) on delete set null;
