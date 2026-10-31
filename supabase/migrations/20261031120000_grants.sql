-- Uttryckliga behörigheter för inloggade användare.
-- Nyare Supabase-projekt ger inte alltid tabeller i public automatiskt
-- behörighet för rollerna authenticated/service_role. RLS-policyerna i
-- init-migreringen avgör fortfarande vilka rader var och en får se.

grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete on
  public.households, public.household_members, public.recipes, public.recipe_ingredients,
  public.recipe_steps, public.tags, public.recipe_tags, public.notes, public.checked_items,
  public.week_plan, public.pantry_items
  to authenticated;

grant select on public.lv_foods, public.unit_weights to authenticated;

grant usage, select on all sequences in schema public to authenticated;

-- Edge-funktionen lv-foods skriver till cachen med service_role.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
