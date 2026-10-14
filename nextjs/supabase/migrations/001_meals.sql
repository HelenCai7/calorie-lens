-- 用户保存的每一餐记录。每个用户只能读写自己的记录（Row Level Security）。
create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  eaten_at timestamptz not null default now(),
  total_calories integer not null check (total_calories >= 0),
  total_grams integer not null check (total_grams >= 0),
  foods jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists meals_user_eaten_at_idx on public.meals (user_id, eaten_at desc);

alter table public.meals enable row level security;

drop policy if exists "meals_select_own" on public.meals;
create policy "meals_select_own" on public.meals
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "meals_insert_own" on public.meals;
create policy "meals_insert_own" on public.meals
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "meals_delete_own" on public.meals;
create policy "meals_delete_own" on public.meals
  for delete to authenticated
  using ((select auth.uid()) = user_id);
