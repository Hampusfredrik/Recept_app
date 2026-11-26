-- Ingredienser som kryssas i ett recept läggs i inköpslistan, kopplade till receptet så att
-- mängden följer valt antal portioner. Veckans recept kan få eget antal portioner per dag.

alter table public.shopping_extras
  add column if not exists recipe_id uuid references public.recipes(id) on delete cascade,
  add column if not exists ingredient_id bigint references public.recipe_ingredients(id) on delete cascade,
  add column if not exists portions int check (portions is null or portions between 1 and 100);

create unique index if not exists shopping_extras_ingredient_idx
  on public.shopping_extras(household_id, ingredient_id) where ingredient_id is not null;

alter table public.week_plan
  add column if not exists portions int check (portions is null or portions between 1 and 100);
