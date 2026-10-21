-- Optional Phase 1 user profile table.
-- Supabase Authentication manages password hashes, sessions and email verification.
-- Run in Supabase Dashboard > SQL Editor (once).
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles for select to authenticated
using ((select auth.uid()) = id);

drop policy if exists "Users can edit own profile" on public.profiles;
create policy "Users can edit own profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Step 2: account-owned PRACTICE summaries (client-reported, not verified exam scores).
create table if not exists public.practice_attempts (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('verbal','nonverbal','academic')),
  correct integer not null check (correct between 0 and 85),
  incorrect integer not null check (incorrect between 0 and 85),
  unanswered integer not null check (unanswered between 0 and 85),
  passed boolean not null,
  reason text not null check (reason in ('passed','complete','time','tab','interrupt','early')),
  finished_at timestamptz not null,
  duration_ms integer not null check (duration_ms between 0 and 1800000),
  check (correct + incorrect + unanswered = 85)
);
alter table public.practice_attempts enable row level security;
drop policy if exists "Read own practice attempts" on public.practice_attempts;
create policy "Read own practice attempts" on public.practice_attempts for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Insert own practice attempts" on public.practice_attempts;
create policy "Insert own practice attempts" on public.practice_attempts for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Update own practice attempts" on public.practice_attempts;
create policy "Update own practice attempts" on public.practice_attempts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create index if not exists practice_attempts_user_finished_idx
on public.practice_attempts (user_id, finished_at desc, id);
