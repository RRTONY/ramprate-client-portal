-- Run once on databases set up before this change. Safe to run twice.
-- 1. Two-step sign-in is removed for everyone: a password alone gives staff and admins their rights.
-- 2. Accounts created by an admin start on a shared starting password and get no rights until the
--    person chooses their own (profiles.must_change_password).

alter table public.profiles add column if not exists must_change_password boolean not null default false;

-- Accounts still on the starting password get no rights until the person chooses their own,
-- even straight from the API.
create or replace function public.password_ok() returns boolean
language sql stable security definer set search_path = public as $$
  select not coalesce((select must_change_password from profiles where id = auth.uid()), false);
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin') and public.password_ok();
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('staff','admin')) and public.password_ok();
$$;

create or replace function public.can_manage(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or (public.password_ok() and exists (select 1 from staff_clients where user_id = auth.uid() and client_id = cid));
$$;

create or replace function public.can_view(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_manage(cid)
      or (public.password_ok() and exists (select 1 from profiles where id = auth.uid() and role = 'client' and client_id = cid));
$$;

drop function if exists public.has_mfa();
