-- Run once on databases set up before 2026-10-29. Safe to run twice.
-- Staff and admin rights now need a session that passed two-step sign-in (aal2), so a password
-- alone never opens client data, even straight from the API. Clients are not affected.

create or replace function public.has_mfa() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin') and public.has_mfa();
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('staff','admin')) and public.has_mfa();
$$;

create or replace function public.can_manage(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or (public.has_mfa() and exists (select 1 from staff_clients where user_id = auth.uid() and client_id = cid));
$$;
