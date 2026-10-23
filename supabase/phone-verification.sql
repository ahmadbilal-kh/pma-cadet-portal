begin;

-- Exactly 10 national digits; country calling code is stored separately in E.164.
create or replace function public.cadet_phone_is_valid(p_country text,p_phone text)
returns boolean language sql immutable set search_path='' as $$
  select coalesce((select p_phone ~ ('^\+' || dial || '[0-9]{10}$') from
    (values ('PK','92'),('AF','93'),('AU','61'),('BD','880'),('CA','1'),('CN','86'),('DE','49'),('IN','91'),('MY','60'),('NZ','64'),('OM','968'),('QA','974'),('SA','966'),('TR','90'),('AE','971'),('GB','44'),('US','1')) codes(country,dial)
    where country=p_country),false);
$$;
-- Run BEFORE the updated signup form is used. Existing accounts are preserved.
-- SMS codes are managed by Twilio Verify; this table stores only challenge proofs.
create extension if not exists pgcrypto with schema extensions;
create table if not exists public.phone_verifications (
  id uuid primary key,
  secret_hash text not null,
  country text,
  phone text not null check (phone ~ '^\+[1-9][0-9]{6,14}$'),
  email text not null,
  purpose text not null check (purpose = 'registration'),
  user_id uuid references auth.users(id) on delete cascade deferrable initially deferred,
  twilio_sid text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes',
  verified_at timestamptz,
  consumed_at timestamptz,
  attempts integer not null default 0
);
alter table public.phone_verifications add column if not exists country text;
drop function if exists public.issue_phone_challenge(uuid,text,text,text,text,uuid);
alter table public.phone_verifications drop constraint if exists phone_verifications_purpose_check;
alter table public.phone_verifications add constraint phone_verifications_purpose_check check (purpose = 'registration') not valid;
alter table public.phone_verifications enable row level security;
revoke all on public.phone_verifications from public, anon, authenticated;
grant all on public.phone_verifications to service_role;
create index if not exists phone_verifications_phone_created_idx on public.phone_verifications(phone,created_at desc);
create index if not exists phone_verifications_user_phone_idx on public.phone_verifications(user_id,phone) where verified_at is not null;

create or replace function public.issue_phone_challenge(p_id uuid,p_hash text,p_phone text,p_email text,p_purpose text,p_user_id uuid,p_country text)
returns public.phone_verifications language plpgsql security definer set search_path = '' as $$
declare result public.phone_verifications;
begin
  if not public.cadet_phone_is_valid(p_country,p_phone) then raise exception 'Enter exactly 10 digits without the country code.'; end if;
  if p_purpose <> 'registration' or p_purpose is null or p_hash !~ '^[0-9a-f]{64}$'
    or p_email is null or char_length(p_email) > 254 then raise exception 'Invalid verification request.'; end if;
  -- Serialize the shared budget and per-number limits to prevent concurrent bypass.
  perform pg_catalog.pg_advisory_xact_lock(926471);
  if exists(select 1 from public.phone_verifications where phone = p_phone and created_at > now() - interval '60 seconds') then
    raise exception 'Wait 60 seconds before requesting another SMS code.';
  end if;
  if (select count(*) from public.phone_verifications where phone = p_phone and created_at > now() - interval '15 minutes') >= 3 then
    raise exception 'Too many codes requested for this number. Try again later.';
  end if;
  if (select count(*) from public.phone_verifications where created_at > now() - interval '1 hour') >= 100 then
    raise exception 'SMS sending limit reached. Please try again later.';
  end if;
  insert into public.phone_verifications(id,secret_hash,phone,email,purpose,user_id,country)
  values(p_id,p_hash,p_phone,lower(trim(p_email)),p_purpose,p_user_id,p_country) returning * into result;
  return result;
end;
$$;

create or replace function public.take_phone_verification_attempt(p_id uuid,p_hash text,p_email text,p_purpose text,p_user_id uuid)
returns public.phone_verifications language plpgsql security definer set search_path = '' as $$
declare result public.phone_verifications;
begin
  update public.phone_verifications set attempts = attempts + 1
  where id = p_id and secret_hash = p_hash and email = lower(trim(p_email)) and purpose = p_purpose
    and user_id is not distinct from p_user_id and consumed_at is null
    and expires_at > now() and attempts < 5 and twilio_sid is not null
  returning * into result;
  if result.id is null then raise exception 'Code expired or too many attempts. Request a new code.'; end if;
  return result;
end;
$$;

-- Signup now uses email/password without a mobile verification requirement.
drop trigger if exists require_cadet_signup_phone on auth.users;
drop function if exists public.require_signup_phone_verification();

revoke all on function public.issue_phone_challenge(uuid,text,text,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.issue_phone_challenge(uuid,text,text,text,text,uuid,text) to service_role;
revoke all on function public.take_phone_verification_attempt(uuid,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.take_phone_verification_attempt(uuid,text,text,text,uuid) to service_role;


-- Remove the earlier profile editing RPC; existing phone records are not exposed by the app.
drop function if exists public.save_profile_phone(uuid,text,text);

commit;
