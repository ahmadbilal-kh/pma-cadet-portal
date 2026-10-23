-- Run after issb-bookings.sql. Preserves existing bookings.
begin;
create table if not exists public.issb_interview_attempts (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  booking_id uuid not null,
  status text not null default 'connecting' check (status in ('connecting','active','completed','failed','interrupted')),
  reason text,
  provider_call_id text,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
create index if not exists issb_attempts_account_created on public.issb_interview_attempts(user_id, created_at desc);
alter table public.issb_interview_attempts enable row level security;
revoke all on public.issb_interview_attempts from anon, authenticated;
grant select (id,user_id,booking_id,status,reason,created_at,ended_at) on public.issb_interview_attempts to authenticated;
grant all on public.issb_interview_attempts to service_role;
drop policy if exists "Read own AI interview attempts" on public.issb_interview_attempts;
create policy "Read own AI interview attempts" on public.issb_interview_attempts for select to authenticated using ((select auth.uid()) = user_id);

-- Only the authenticated Edge Function may reserve paid AI calls.
create or replace function public.reserve_issb_ai_attempt(p_user_id uuid, p_booking_id uuid, p_attempt_id uuid)
returns public.issb_interview_attempts language plpgsql security definer set search_path = '' as $$
declare attempt public.issb_interview_attempts;
begin
  perform 1 from auth.users where id = p_user_id for no key update;
  if not found then raise exception 'Please log in again.'; end if;
  if not exists(select 1 from public.issb_bookings where user_id = p_user_id and id = p_booking_id and status in ('scheduled','started')) then
    raise exception 'Schedule an interview before joining.';
  end if;
  update public.issb_interview_attempts set status='interrupted', reason='connection_lost', ended_at=now()
    where user_id=p_user_id and status in ('connecting','active') and created_at < now()-interval '15 minutes';
  if exists(select 1 from public.issb_interview_attempts where user_id=p_user_id and status in ('connecting','active')) then
    raise exception 'An interview is already open. Close it before trying again.';
  end if;
  if exists(select 1 from public.issb_interview_attempts where user_id=p_user_id and ended_at > now()-interval '1 minute') then
    raise exception 'Please wait one minute before trying again.';
  end if;
  if (select count(*) from public.issb_interview_attempts where user_id=p_user_id and created_at > now()-interval '1 hour') >= 3 then
    raise exception 'You have reached three attempts this hour. Please try again later.';
  end if;
  insert into public.issb_interview_attempts(id,user_id,booking_id) values(p_attempt_id,p_user_id,p_booking_id) returning * into attempt;
  return attempt;
end;
$$;

create or replace function public.activate_issb_ai_attempt(p_user_id uuid, p_attempt_id uuid, p_call_id text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare attempt public.issb_interview_attempts;
begin
  select * into attempt from public.issb_interview_attempts where id=p_attempt_id and user_id=p_user_id for update;
  if not found or attempt.status <> 'connecting' then return false; end if;
  update public.issb_bookings set status='started' where user_id=p_user_id and id=attempt.booking_id and status in ('scheduled','started');
  if not found then return false; end if;
  update public.issb_interview_attempts set status='active', provider_call_id=p_call_id where id=attempt.id;
  return true;
end;
$$;

-- Terminal results are immutable. Failed attempts cannot later become completed.
create or replace function public.finish_issb_ai_attempt(p_user_id uuid, p_attempt_id uuid, p_outcome text, p_reason text, p_booking_id uuid)
returns public.issb_interview_attempts language plpgsql security definer set search_path = '' as $$
declare attempt public.issb_interview_attempts;
begin
  if p_outcome not in ('completed','failed','interrupted') or p_outcome is null then raise exception 'Invalid interview outcome.'; end if;
  perform 1 from auth.users where id=p_user_id for no key update;
  select * into attempt from public.issb_interview_attempts where id=p_attempt_id and user_id=p_user_id for update;
  if not found then
    -- Fullscreen exit may arrive before the in-flight connection reservation.
    if p_outcome='completed' or not exists(select 1 from public.issb_bookings where user_id=p_user_id and id=p_booking_id) then
      raise exception 'Interview attempt not found.';
    end if;
    insert into public.issb_interview_attempts(id,user_id,booking_id,status,reason,ended_at)
      values(p_attempt_id,p_user_id,p_booking_id,p_outcome,left(p_reason,80),now()) returning * into attempt;
    return attempt;
  end if;
  if attempt.status in ('completed','failed','interrupted') then return attempt; end if;
  if p_outcome='completed' and attempt.status <> 'active' then raise exception 'Connect to the interviewer before finishing.'; end if;
  update public.issb_interview_attempts set status=p_outcome, reason=left(p_reason,80), ended_at=now() where id=attempt.id returning * into attempt;
  update public.issb_bookings set status=case when p_outcome='completed' then 'completed' else 'scheduled' end where user_id=p_user_id and id=attempt.booking_id;
  return attempt;
end;
$$;
revoke all on function public.reserve_issb_ai_attempt(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.finish_issb_ai_attempt(uuid,uuid,text,text,uuid) from public, anon, authenticated;
revoke all on function public.activate_issb_ai_attempt(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.reserve_issb_ai_attempt(uuid,uuid,uuid) to service_role;
grant execute on function public.finish_issb_ai_attempt(uuid,uuid,text,text,uuid) to service_role;
grant execute on function public.activate_issb_ai_attempt(uuid,uuid,text) to service_role;
commit;
