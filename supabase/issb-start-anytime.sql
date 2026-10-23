-- Run once in Supabase SQL Editor to update an existing ISSB installation.
-- This preserves bookings, account ownership checks, and reminder delivery records.
begin;

create or replace function public.update_issb_interview_status(p_booking_id uuid, p_status text)
returns public.issb_bookings language plpgsql security definer set search_path = '' as $$
declare booking public.issb_bookings;
begin
  if p_status not in ('started','completed') or p_status is null then raise exception 'Invalid interview status.'; end if;
  update public.issb_bookings set status = p_status
  where user_id = auth.uid() and id = p_booking_id
    and ((p_status = 'started' and status in ('scheduled','started')) or (p_status = 'completed' and status = 'started'))
  returning * into booking;
  if booking.id is null then raise exception 'Your interview is not available. Refresh your schedule and try again.'; end if;
  return booking;
end;
$$;

revoke all on function public.update_issb_interview_status(uuid,text) from public, anon;
grant execute on function public.update_issb_interview_status(uuid,text) to authenticated;

commit;
