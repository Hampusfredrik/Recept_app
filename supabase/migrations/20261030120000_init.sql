-- Receptappen: tabeller, RLS, realtime och lagring.
-- Alla hushållsdata bär household_id så att RLS och realtime-filter blir enkla.

create extension if not exists pgcrypto;

-- ───────────────────────── Hushåll ─────────────────────────
create table public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Vårt kök',
  invite_code text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
  created_at  timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index household_members_user_idx on public.household_members(user_id);

-- security definer så att policyn på household_members inte rekurserar.
create or replace function public.is_household_member(hid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = hid and user_id = auth.uid()
  );
$$;

-- ───────────────────────── Recept ─────────────────────────
create table public.recipes (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households(id) on delete cascade,
  name           text not null,
  effort         smallint not null check (effort between 1 and 5),
  portions       int not null default 4 check (portions between 1 and 100),
  source_type    text not null check (source_type in ('web', 'book')),
  url            text,
  domain         text,
  fetched_at     timestamptz,
  book_title     text,
  page           text check (page is null or page ~ '^\d{1,4}$'),
  image_url      text,
  created_at     timestamptz not null default now(),
  last_cooked_on date
);
create index recipes_household_idx on public.recipes(household_id);

create table public.recipe_ingredients (
  id               bigint generated always as identity primary key,
  household_id     uuid not null references public.households(id) on delete cascade,
  recipe_id        uuid not null references public.recipes(id) on delete cascade,
  position         int not null,
  amount           numeric,
  unit             text not null default '',
  name             text not null,
  grams            numeric,            -- manuell vikt; går före enhetsomräkning
  lv_food_id       int,
  lv_food_name     text,
  match_confidence text check (match_confidence in ('sure', 'unsure'))
);
create index recipe_ingredients_recipe_idx on public.recipe_ingredients(recipe_id);
create index recipe_ingredients_household_idx on public.recipe_ingredients(household_id);

create table public.recipe_steps (
  id             bigint generated always as identity primary key,
  household_id   uuid not null references public.households(id) on delete cascade,
  recipe_id      uuid not null references public.recipes(id) on delete cascade,
  position       int not null,
  text           text not null,
  ingredient_ids bigint[]             -- null = gissas utifrån stegtexten
);
create index recipe_steps_recipe_idx on public.recipe_steps(recipe_id);
create index recipe_steps_household_idx on public.recipe_steps(household_id);

create table public.tags (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null,
  tone         text not null default 'accent' check (tone in ('accent', 'sage', 'sand', 'clay')),
  created_at   timestamptz not null default now()
);
create unique index tags_household_name_idx on public.tags(household_id, lower(name));

create table public.recipe_tags (
  household_id uuid not null references public.households(id) on delete cascade,
  recipe_id    uuid not null references public.recipes(id) on delete cascade,
  tag_id       uuid not null references public.tags(id) on delete cascade,
  primary key (recipe_id, tag_id)
);
create index recipe_tags_household_idx on public.recipe_tags(household_id);

create table public.notes (
  recipe_id    uuid primary key references public.recipes(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  text         text not null default '',
  updated_at   timestamptz not null default now(),
  updated_by   uuid default auth.uid() references auth.users(id) on delete set null
);
create index notes_household_idx on public.notes(household_id);

create table public.checked_items (
  household_id  uuid not null references public.households(id) on delete cascade,
  recipe_id     uuid not null references public.recipes(id) on delete cascade,
  ingredient_id bigint not null references public.recipe_ingredients(id) on delete cascade,
  primary key (recipe_id, ingredient_id)
);
create index checked_items_household_idx on public.checked_items(household_id);

create table public.week_plan (
  household_id uuid not null references public.households(id) on delete cascade,
  date         date not null,
  recipe_id    uuid not null references public.recipes(id) on delete cascade,
  primary key (household_id, date)
);

create table public.pantry_items (
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null,
  created_at   timestamptz not null default now(),
  primary key (household_id, name)
);

-- ───────────── Livsmedelsverket-cache (global, skrivs bara av edge function) ─────────────
create table public.lv_foods (
  id         int primary key,           -- Livsmedelsverkets livsmedelsnummer
  name       text not null,
  per_100g   jsonb,                     -- null tills näringsvärden hämtats
  fetched_at timestamptz
);
create index lv_foods_name_idx on public.lv_foods using btree (lower(name));

-- Gram per enhet för ett visst livsmedel (t.ex. 1 st gul lök). Fylls på som data.
create table public.unit_weights (
  lv_food_id int not null references public.lv_foods(id) on delete cascade,
  unit       text not null,
  grams      numeric not null check (grams > 0),
  source     text,                      -- varifrån vikten kommer
  primary key (lv_food_id, unit)
);

-- ───────────────────────── RLS ─────────────────────────
alter table public.households         enable row level security;
alter table public.household_members  enable row level security;
alter table public.recipes            enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.recipe_steps       enable row level security;
alter table public.tags               enable row level security;
alter table public.recipe_tags        enable row level security;
alter table public.notes              enable row level security;
alter table public.checked_items      enable row level security;
alter table public.week_plan          enable row level security;
alter table public.pantry_items       enable row level security;
alter table public.lv_foods           enable row level security;
alter table public.unit_weights       enable row level security;

create policy "medlemmar läser sitt hushåll" on public.households
  for select to authenticated using (public.is_household_member(id));
create policy "medlemmar byter namn på sitt hushåll" on public.households
  for update to authenticated using (public.is_household_member(id)) with check (public.is_household_member(id));
-- Hushåll skapas och gås med i via funktionerna nedan, inte med direkta inserts.

create policy "medlemmar ser varandra" on public.household_members
  for select to authenticated using (public.is_household_member(household_id));
create policy "man kan lämna ett hushåll" on public.household_members
  for delete to authenticated using (user_id = auth.uid());

-- Samma policy för alla tabeller med household_id.
do $$
declare t text;
begin
  foreach t in array array['recipes','recipe_ingredients','recipe_steps','tags','recipe_tags',
                           'notes','checked_items','week_plan','pantry_items']
  loop
    execute format(
      'create policy "medlemmar läser och skriver" on public.%I for all to authenticated
         using (public.is_household_member(household_id))
         with check (public.is_household_member(household_id))', t);
  end loop;
end $$;

create policy "inloggade läser livsmedel" on public.lv_foods
  for select to authenticated using (true);
create policy "inloggade läser enhetsvikter" on public.unit_weights
  for select to authenticated using (true);

-- Barnrader måste höra till samma hushåll som receptet.
create or replace function public.check_recipe_household()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.recipes r where r.id = new.recipe_id and r.household_id = new.household_id) then
    raise exception 'Receptet tillhör inte hushållet';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['recipe_ingredients','recipe_steps','recipe_tags','notes','checked_items','week_plan']
  loop
    execute format('create trigger %I before insert or update on public.%I
                    for each row execute function public.check_recipe_household()', t || '_household_chk', t);
  end loop;
end $$;

create or replace function public.check_tag_household()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.tags g where g.id = new.tag_id and g.household_id = new.household_id) then
    raise exception 'Taggen tillhör inte hushållet';
  end if;
  return new;
end $$;
create trigger recipe_tags_tag_chk before insert or update on public.recipe_tags
  for each row execute function public.check_tag_household();

-- ───────────────────────── Funktioner för hushåll ─────────────────────────
create or replace function public.create_household(p_name text default 'Vårt kök')
returns public.households
language plpgsql security definer set search_path = public
as $$
declare h public.households;
begin
  if auth.uid() is null then raise exception 'Inte inloggad'; end if;
  insert into public.households(name) values (coalesce(nullif(trim(p_name), ''), 'Vårt kök')) returning * into h;
  insert into public.household_members(household_id, user_id) values (h.id, auth.uid());
  insert into public.tags(household_id, name, tone) values
    (h.id, 'Fisk', 'sage'), (h.id, 'Soppa', 'accent'), (h.id, 'Pasta', 'sand'), (h.id, 'Vegetarisk', 'clay');
  return h;
end $$;

create or replace function public.join_household(p_code text)
returns public.households
language plpgsql security definer set search_path = public
as $$
declare h public.households;
begin
  if auth.uid() is null then raise exception 'Inte inloggad'; end if;
  select * into h from public.households where invite_code = upper(trim(p_code));
  if not found then raise exception 'Okänd inbjudningskod'; end if;
  insert into public.household_members(household_id, user_id) values (h.id, auth.uid())
    on conflict do nothing;
  return h;
end $$;

create or replace function public.rotate_invite_code(p_household uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare c text;
begin
  if not public.is_household_member(p_household) then raise exception 'Ingen behörighet'; end if;
  update public.households set invite_code = upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8))
    where id = p_household returning invite_code into c;
  return c;
end $$;

revoke all on function public.create_household(text) from public, anon;
revoke all on function public.join_household(text) from public, anon;
revoke all on function public.rotate_invite_code(uuid) from public, anon;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.join_household(text) to authenticated;
grant execute on function public.rotate_invite_code(uuid) to authenticated;

-- ───────────────────────── Realtime ─────────────────────────
-- Klienten lyssnar på ändringar och hämtar om hushållets data.
alter publication supabase_realtime add table
  public.recipes, public.recipe_ingredients, public.recipe_steps, public.tags, public.recipe_tags,
  public.notes, public.checked_items, public.week_plan, public.pantry_items;

-- ───────────────────────── Lagring för bilder ─────────────────────────
-- Sökväg: <household_id>/<filnamn>
insert into storage.buckets (id, name, public) values ('recipe-images', 'recipe-images', true)
  on conflict (id) do nothing;

create policy "medlemmar laddar upp bilder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'recipe-images' and public.is_household_member(((storage.foldername(name))[1])::uuid));
create policy "medlemmar ändrar bilder" on storage.objects
  for update to authenticated
  using (bucket_id = 'recipe-images' and public.is_household_member(((storage.foldername(name))[1])::uuid));
create policy "medlemmar tar bort bilder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'recipe-images' and public.is_household_member(((storage.foldername(name))[1])::uuid));
