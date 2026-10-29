-- Run once on databases that ran upgrade-2026-10-29-staff-two-step.sql. Safe to run twice.
-- Makes two-step sign-in optional for staff and admins: a password alone now opens their rights,
-- unless they set up an authenticator, in which case the code is still required.

create or replace function public.has_mfa() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors where user_id = auth.uid() and status = 'verified'
      );
$$;
