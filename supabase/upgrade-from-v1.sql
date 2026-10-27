-- Run this ONLY if you already ran the first version of schema.sql.
alter table public.team_members add column if not exists calendly_url text;
alter table public.clients add column if not exists last_updated_at timestamptz not null default now();
alter table public.clients add column if not exists next_update_due date;
alter table public.clients add column if not exists phases text[] not null default '{Kickoff,Build,Launch}';
alter table public.clients add column if not exists current_phase int not null default 0;
alter table public.documents add column if not exists is_signed boolean not null default false;
alter table public.clients add column if not exists welcome_note text not null default '';
alter table public.profiles add column if not exists notify_email boolean not null default true;
-- ===== Audit log (append only: no update or delete policies exist, so nobody can edit history) =====
create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_email text,
  actor_role text,
  action text not null,            -- e.g. document.download, update.create, client.update, auth.login
  entity text,
  entity_id text,
  client_id uuid references public.clients(id) on delete set null,
  detail jsonb not null default '{}'::jsonb
);
create index on public.audit_log (client_id, at desc);
create index on public.audit_log (at desc);
alter table public.audit_log enable row level security;
create policy audit_insert on public.audit_log for insert to authenticated with check (actor_id = auth.uid());
create policy audit_read on public.audit_log for select to authenticated using (
  public.is_admin() or (client_id is not null and public.can_manage(client_id))
);

-- ===== Client-made content is protected =====
-- Staff and admins can reply to and resolve a query, but can never change what the client wrote.
-- Messages have no update or delete policy at all. Queries may only change their status.
create or replace function public.queries_guard() returns trigger
language plpgsql as $$
begin
  if new.subject is distinct from old.subject
     or new.category is distinct from old.category
     or new.created_by is distinct from old.created_by
     or new.client_id is distinct from old.client_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Only the status of a query can be changed';
  end if;
  return new;
end $$;
create trigger queries_guard_trg before update on public.queries
for each row execute function public.queries_guard();

-- Lets a signed-in user change ONLY their own email preference (no general self-update on profiles,
-- so nobody can change their own role).
create or replace function public.set_my_notify(v boolean) returns void
language sql security definer set search_path = public as $$
  update profiles set notify_email = v where id = auth.uid();
$$;
