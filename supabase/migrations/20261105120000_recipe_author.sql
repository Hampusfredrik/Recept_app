-- Vem som lade in receptet, och vad personerna i köket heter.

alter table public.recipes
  add column if not exists created_by uuid default auth.uid() references auth.users(id) on delete set null;

alter table public.household_members
  add column if not exists display_name text check (display_name is null or char_length(display_name) <= 40);

-- Var och en får ändra sitt eget namn (bara den egna raden).
drop policy if exists "man byter sitt eget namn" on public.household_members;
create policy "man byter sitt eget namn" on public.household_members
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Medlemslistan ska uppdateras direkt hos den andra när ett namn ändras.
do $$
begin
  alter publication supabase_realtime add table public.household_members;
exception when duplicate_object then null;
end $$;
