-- Run in Supabase SQL Editor if the old phone-verification.sql was installed.
-- Removes only the signup phone gate; preserves existing accounts and records.
begin;
drop trigger if exists require_cadet_signup_phone on auth.users;
drop function if exists public.require_signup_phone_verification();
commit;
