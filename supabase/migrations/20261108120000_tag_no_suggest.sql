-- Taggar vars recept inte ska föreslås på startsidan eller komma med när man slumpar (t.ex. Efterrätt).
alter table public.tags add column if not exists no_suggest boolean not null default false;
