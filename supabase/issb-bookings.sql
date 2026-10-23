begin;

-- Run after schema.sql. Phone verification is not required for ISSB. All interview bookings are for independent practice.
create table if not exists public.issb_bookings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  id uuid not null unique default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 80),
  email text not null,
  starts_at timestamptz not null,
  timezone text not null,
  status text not null default 'scheduled' check (status in ('scheduled','started','completed')),
  email_state text not null default 'pending' check (email_state in ('pending','sending','sent')),
  email_attempts integer not null default 0,
  email_claim uuid,
  email_claimed_at timestamptz,
  email_sent_at timestamptz,
  created_at timestamptz not null default now()
);
-- Preserve existing names when upgrading the earlier two-field version.
alter table public.issb_bookings add column if not exists full_name text;
do $$
begin
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='issb_bookings' and column_name='first_name') then
    execute 'update public.issb_bookings set full_name = trim(first_name || '' '' || last_name) where full_name is null';
  end if;
end;
$$;
alter table public.issb_bookings alter column full_name set not null;
alter table public.issb_bookings drop column if exists first_name;
alter table public.issb_bookings drop column if exists last_name;
drop function if exists public.schedule_issb_interview(text,text,text,text,timestamptz,text);
drop function if exists public.schedule_issb_interview(text,text,text,timestamptz,text);
alter table public.issb_bookings drop column if exists country;
alter table public.issb_bookings drop column if exists phone;
alter table public.issb_bookings enable row level security;
revoke all on public.issb_bookings from anon, authenticated;
grant select on public.issb_bookings to authenticated;
drop policy if exists "Read own interview booking" on public.issb_bookings;
create policy "Read own interview booking" on public.issb_bookings
  for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.schedule_issb_interview(
  p_full_name text,
  p_starts_at timestamptz, p_timezone text
) returns public.issb_bookings language plpgsql security definer set search_path = '' as $$
declare
  account_id uuid := auth.uid();
  account_email text;
  booking public.issb_bookings;
begin
  if account_id is null then raise exception 'Please log in again.'; end if;
  select email into account_email from auth.users where id = account_id and email_confirmed_at is not null;
  if account_email is null then raise exception 'Confirm your account email before booking.'; end if;
  if p_full_name is null or char_length(trim(p_full_name)) not between 2 and 80 then raise exception 'Enter your full name (2 to 80 characters).'; end if;
  -- Serialize this account's requests and preserve reminder delivery on duplicate retries.
  perform 1 from auth.users where id = account_id for update;
  select * into booking from public.issb_bookings where user_id = account_id;
  if booking.full_name = trim(p_full_name) and booking.starts_at = p_starts_at
    and booking.timezone = p_timezone and booking.email = lower(account_email) then
    return booking;
  end if;
  if p_starts_at is null or p_starts_at <= now() then raise exception 'Choose a future interview date and time.'; end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then raise exception 'Choose a valid timezone.'; end if;
  if exists(select 1 from public.issb_bookings where user_id = account_id and status = 'started') then
    raise exception 'Complete your current interview before scheduling another.';
  end if;
  insert into public.issb_bookings(user_id,full_name,email,starts_at,timezone)
  values(account_id,trim(p_full_name),lower(account_email),p_starts_at,p_timezone)
  on conflict(user_id) do update set id = gen_random_uuid(), full_name = excluded.full_name, email = excluded.email, starts_at = excluded.starts_at, timezone = excluded.timezone,
    status = 'scheduled', email_state = 'pending', email_attempts = 0, email_claim = null,
    email_claimed_at = null, email_sent_at = null, created_at = now()
  returning * into booking;
  return booking;
end;
$$;

create or replace function public.update_issb_interview_status(p_booking_id uuid, p_status text)
returns public.issb_bookings language plpgsql security definer set search_path = '' as $$
declare booking public.issb_bookings;
begin
  if p_status not in ('started','completed') or p_status is null then raise exception 'Invalid interview status.'; end if;
  update public.issb_bookings set status = p_status
  where user_id = auth.uid() and id = p_booking_id
    and ((p_status = 'started' and status in ('scheduled','started')) or (p_status = 'completed' and status = 'started'))
  returning * into booking;
  if booking.id is null then raise exception 'Your interview is not available at this time.'; end if;
  return booking;
end;
$$;

-- Leases and SKIP LOCKED prevent concurrent cron workers claiming the same reminder.
create or replace function public.claim_issb_reminders()
returns setof public.issb_bookings language sql security definer set search_path = '' as $$
  with due as (
    select user_id from public.issb_bookings
    where status = 'scheduled' and starts_at > now() and starts_at <= now() + interval '15 minutes'
      and email_state <> 'sent' and email_attempts < 5
      and (email_claimed_at is null or email_claimed_at < now() - interval '5 minutes')
    order by starts_at for update skip locked limit 25
  )
  update public.issb_bookings b set email_state = 'sending', email_claim = gen_random_uuid(),
    email_claimed_at = now(), email_attempts = email_attempts + 1
  from due where b.user_id = due.user_id returning b.*;
$$;

revoke all on function public.schedule_issb_interview(text,timestamptz,text) from public, anon;
grant execute on function public.schedule_issb_interview(text,timestamptz,text) to authenticated;
revoke all on function public.update_issb_interview_status(uuid,text) from public, anon;
grant execute on function public.update_issb_interview_status(uuid,text) to authenticated;
revoke all on function public.claim_issb_reminders() from public, anon, authenticated;
grant execute on function public.claim_issb_reminders() to service_role;
grant all on public.issb_bookings to service_role;

commit;
