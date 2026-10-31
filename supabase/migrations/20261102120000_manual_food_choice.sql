-- Markerar livsmedel som användaren själv valt för en ingrediens.
-- Sådana val matchas aldrig om automatiskt.
alter table public.recipe_ingredients
  add column if not exists lv_manual boolean not null default false;
