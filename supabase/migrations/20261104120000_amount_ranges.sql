-- Mängd som intervall, t.ex. "1-2 msk": amount = 1, amount_max = 2.
alter table public.recipe_ingredients
  add column if not exists amount_max numeric;
