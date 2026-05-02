-- culturego schema bootstrap
-- Run on the existing Supabase project to set up the kyoyogo (culturego) data model.

create schema if not exists culturego;
grant usage on schema culturego to authenticated;

-- ── tags ──────────────────────────────────────────────────────────────
create table culturego.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tags_name_length check (char_length(name) between 1 and 30)
);

create unique index tags_user_name_unique
  on culturego.tags (user_id, lower(name));
create index tags_user_order_idx
  on culturego.tags (user_id, display_order);

alter table culturego.tags enable row level security;

create policy "tags_select_own" on culturego.tags
  for select to authenticated
  using (auth.uid() = user_id);
create policy "tags_insert_own" on culturego.tags
  for insert to authenticated
  with check (auth.uid() = user_id);
create policy "tags_update_own" on culturego.tags
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "tags_delete_own" on culturego.tags
  for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on culturego.tags to authenticated;

-- ── updated_at trigger ────────────────────────────────────────────────
create or replace function culturego.set_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger tags_set_updated_at
  before update on culturego.tags
  for each row execute function culturego.set_updated_at();
