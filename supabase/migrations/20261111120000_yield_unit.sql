-- Recept kan räknas i portioner eller i antal (t.ex. 12 st bullar).
alter table public.recipes
  add column if not exists yield_unit text not null default 'portion' check (yield_unit in ('portion', 'st'));
