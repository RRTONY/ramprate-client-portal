-- RampRate Client Portal schema. Run in the Supabase SQL editor (or as a migration).
-- Before running: in Supabase Auth settings, DISABLE public sign-ups. Users are created by invitation only.

create extension if not exists "pgcrypto";

-- ===== Core tables =====
create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  title text not null,
  email text not null unique,
  phone text,
  linkedin_url text,
  calendly_url text,          -- personal booking link, shows a Book a meeting button on the portal
  is_admin_contact boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'Active',
  health text not null default 'on_track' check (health in ('on_track','needs_attention','at_risk','on_hold')),
  summary text not null default '',
  approach text not null default '',
  expectations text not null default '',
  priorities text[] not null default '{}',
  engagement_owner_id uuid references public.team_members(id) on delete set null,
  spoc_id uuid references public.team_members(id) on delete set null,
  slack_channel text,
  last_updated_at timestamptz not null default now(),
  next_update_due date,
  welcome_note text not null default '',
  phases text[] not null default '{Kickoff,Build,Launch}',
  current_phase int not null default 0,
  created_at timestamptz not null default now()
);

-- role: client = external user tied to one client; staff = RampRate engagement owner/team; admin = full access
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null,
  role text not null default 'client' check (role in ('client','staff','admin')),
  client_id uuid references public.clients(id) on delete set null,
  notify_email boolean not null default true,
  created_at timestamptz not null default now()
);

-- Which clients a staff user may manage
create table public.staff_clients (
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  primary key (user_id, client_id)
);

-- Team shown on a client's portal, with role and what to contact them about
create table public.client_team (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  team_member_id uuid not null references public.team_members(id) on delete cascade,
  engagement_role text not null default '',
  contact_for text not null default '',
  sort_order int not null default 0,
  unique (client_id, team_member_id)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null,
  category text not null default 'Other' check (category in ('NDA','MSA','SOW','Onboarding','Invoice','Report','Other')),
  storage_path text not null unique,
  file_name text not null,
  file_size bigint not null default 0,
  published boolean not null default true,
  is_signed boolean not null default false,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Activity timeline
create table public.updates (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  kind text not null default 'update' check (kind in ('milestone','completed','ongoing','update','change')),
  title text not null,
  body text not null default '',
  occurred_on date not null default current_date,
  published boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Progress tracker: completed / in progress / upcoming / pending (waiting on client) / next step
create table public.progress_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  status text not null default 'upcoming' check (status in ('completed','in_progress','upcoming','pending','next_step')),
  title text not null,
  detail text not null default '',
  due_date date,
  owner_name text,
  updated_at timestamptz not null default now()
);

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  location text,           -- link or place
  agenda text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table public.queries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  subject text not null,
  category text not null default 'General',
  status text not null default 'open' check (status in ('open','answered','closed')),
  created_at timestamptz not null default now()
);

create table public.query_messages (
  id uuid primary key default gen_random_uuid(),
  query_id uuid not null references public.queries(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index on public.documents (client_id);
create index on public.updates (client_id, occurred_on desc);
create index on public.progress_items (client_id);
create index on public.meetings (client_id, starts_at);
create index on public.queries (client_id, created_at desc);
create index on public.query_messages (query_id, created_at);

-- ===== Access helpers (security definer so policies can call them without recursion) =====
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('staff','admin'));
$$;

create or replace function public.can_manage(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or exists (select 1 from staff_clients where user_id = auth.uid() and client_id = cid);
$$;

create or replace function public.can_view(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_manage(cid)
      or exists (select 1 from profiles where id = auth.uid() and role = 'client' and client_id = cid);
$$;

-- ===== Row level security =====
alter table public.team_members enable row level security;
alter table public.clients enable row level security;
alter table public.profiles enable row level security;
alter table public.staff_clients enable row level security;
alter table public.client_team enable row level security;
alter table public.documents enable row level security;
alter table public.updates enable row level security;
alter table public.progress_items enable row level security;
alter table public.meetings enable row level security;
alter table public.queries enable row level security;
alter table public.query_messages enable row level security;

-- team_members: any signed-in user can read the directory; only admins edit
create policy team_read on public.team_members for select to authenticated using (true);
create policy team_admin on public.team_members for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- clients
create policy clients_read on public.clients for select to authenticated using (public.can_view(id));
create policy clients_insert on public.clients for insert to authenticated with check (public.is_admin());
create policy clients_update on public.clients for update to authenticated using (public.can_manage(id)) with check (public.can_manage(id));
create policy clients_delete on public.clients for delete to authenticated using (public.is_admin());

-- profiles: read own row; staff read all (needed for admin user lists); writes only via service role / admins
create policy profiles_self on public.profiles for select to authenticated using (id = auth.uid() or public.is_staff());
-- Names of RampRate staff and of fellow users on the same client are visible (needed to label query threads)
create policy profiles_names on public.profiles for select to authenticated using (
  role in ('staff','admin') or (client_id is not null and public.can_view(client_id))
);
create policy profiles_admin on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy staff_clients_read on public.staff_clients for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy staff_clients_admin on public.staff_clients for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy client_team_read on public.client_team for select to authenticated using (public.can_view(client_id));
create policy client_team_write on public.client_team for all to authenticated using (public.can_manage(client_id)) with check (public.can_manage(client_id));

-- Content tables: clients only see published rows; managers see everything
create policy documents_read on public.documents for select to authenticated using (public.can_manage(client_id) or (published and public.can_view(client_id)));
create policy documents_write on public.documents for all to authenticated using (public.can_manage(client_id)) with check (public.can_manage(client_id));

create policy updates_read on public.updates for select to authenticated using (public.can_manage(client_id) or (published and public.can_view(client_id)));
create policy updates_write on public.updates for all to authenticated using (public.can_manage(client_id)) with check (public.can_manage(client_id));

create policy progress_read on public.progress_items for select to authenticated using (public.can_view(client_id));
create policy progress_write on public.progress_items for all to authenticated using (public.can_manage(client_id)) with check (public.can_manage(client_id));

create policy meetings_read on public.meetings for select to authenticated using (public.can_view(client_id));
create policy meetings_write on public.meetings for all to authenticated using (public.can_manage(client_id)) with check (public.can_manage(client_id));

-- Queries: clients create and read their own client's queries; managers read/update all
create policy queries_read on public.queries for select to authenticated using (public.can_view(client_id));
create policy queries_insert on public.queries for insert to authenticated with check (public.can_view(client_id) and created_by = auth.uid());
create policy queries_update on public.queries for update to authenticated using (public.can_view(client_id)) with check (public.can_view(client_id));

create policy qmsg_read on public.query_messages for select to authenticated using (public.can_view(client_id));
create policy qmsg_insert on public.query_messages for insert to authenticated with check (public.can_view(client_id) and author_id = auth.uid());

-- ===== Storage: private bucket for documents. Path convention: <client_id>/<uuid>-<file name> =====
-- 25 MB cap is enforced by Storage itself, since uploads go straight from the browser.
insert into storage.buckets (id, name, public, file_size_limit) values ('client-documents', 'client-documents', false, 26214400)
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

create policy docs_storage_read on storage.objects for select to authenticated using (
  bucket_id = 'client-documents' and (
    public.can_manage(((storage.foldername(name))[1])::uuid)
    or exists (
      select 1 from public.documents d
      where d.storage_path = storage.objects.name and d.published and public.can_view(d.client_id)
    )
  )
);
create policy docs_storage_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'client-documents' and public.can_manage(((storage.foldername(name))[1])::uuid)
);
create policy docs_storage_delete on storage.objects for delete to authenticated using (
  bucket_id = 'client-documents' and public.can_manage(((storage.foldername(name))[1])::uuid)
);


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
