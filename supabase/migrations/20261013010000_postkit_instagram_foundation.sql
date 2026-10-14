-- PostKit Instagram foundation
-- Apply with Supabase CLI after linking the intended project.
-- Tokens are intentionally isolated from client-readable tables.

create extension if not exists pgcrypto;

create type public.workspace_role as enum ('owner', 'admin', 'editor', 'viewer');
create type public.instagram_connection_status as enum ('pending', 'connected', 'expired', 'revoked', 'error');
create type public.media_status as enum ('uploaded', 'processing', 'ready', 'failed', 'archived');
create type public.post_status as enum (
  'draft', 'scheduled', 'processing', 'published', 'failed', 'paused', 'cancelled', 'needs_review'
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  owner_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  timezone text not null default 'America/Bahia',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace
      and wm.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.workspaces w
    where w.id = target_workspace
      and w.owner_id = (select auth.uid())
  );
$$;

create or replace function public.has_workspace_role(
  target_workspace uuid,
  allowed_roles public.workspace_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspaces w
    where w.id = target_workspace
      and w.owner_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace
      and wm.user_id = (select auth.uid())
      and wm.role = any(allowed_roles)
  );
$$;

create table public.instagram_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  instagram_user_id text not null,
  username text not null,
  display_name text,
  connection_status public.instagram_connection_status not null default 'pending',
  account_type text,
  scopes text[] not null default '{}',
  token_expires_at timestamptz,
  last_verified_at timestamptz,
  last_error_code text,
  last_error_message text,
  connected_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, instagram_user_id),
  unique (id, workspace_id)
);

-- OAuth access/refresh tokens must only be read or written by trusted server code.
-- There are deliberately no client-facing RLS policies for this table.
create table public.instagram_tokens (
  account_id uuid primary key references public.instagram_accounts(id) on delete cascade,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text,
  encryption_key_version text,
  token_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  uploaded_by uuid references auth.users(id) on delete set null,
  original_filename text not null,
  storage_path text not null,
  mime_type text not null check (mime_type in ('video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/png')),
  size_bytes bigint not null check (size_bytes > 0),
  duration_seconds numeric(10,2),
  width integer,
  height integer,
  checksum_sha256 text,
  status public.media_status not null default 'uploaded',
  processing_error text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, storage_path),
  unique (id, workspace_id)
);

create table public.caption_sets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  captions text[] not null default '{}',
  rotation_enabled boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);

create table public.hashtag_groups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  hashtags text[] not null default '{}',
  rotation_enabled boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);

create table public.publishing_schedules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  instagram_account_id uuid not null,
  name text not null default 'Programação padrão',
  timezone text not null default 'America/Bahia',
  daily_limit integer not null default 3 check (daily_limit between 1 and 100),
  minimum_interval_minutes integer not null default 120 check (minimum_interval_minutes >= 1),
  time_slots time[] not null default array['09:00'::time, '13:00'::time, '18:00'::time],
  enabled boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (instagram_account_id, workspace_id)
    references public.instagram_accounts(id, workspace_id) on delete cascade,
  unique (id, workspace_id)
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  instagram_account_id uuid not null,
  media_asset_id uuid not null,
  schedule_id uuid,
  status public.post_status not null default 'draft',
  content_type text not null default 'reel' check (content_type in ('reel', 'image', 'carousel', 'story')),
  caption text not null default '',
  hashtags text[] not null default '{}',
  scheduled_at timestamptz,
  timezone text not null default 'America/Bahia',
  published_at timestamptz,
  meta_media_id text,
  permalink text,
  idempotency_key uuid not null default gen_random_uuid(),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz,
  last_error_code text,
  last_error_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (instagram_account_id, workspace_id)
    references public.instagram_accounts(id, workspace_id) on delete cascade,
  foreign key (media_asset_id, workspace_id)
    references public.media_assets(id, workspace_id) on delete restrict,
  foreign key (schedule_id, workspace_id)
    references public.publishing_schedules(id, workspace_id) on delete set null,
  unique (idempotency_key),
  unique (id, workspace_id)
);

create table public.publish_attempts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  post_id uuid not null,
  attempt_number integer not null check (attempt_number > 0),
  status text not null check (status in ('started', 'processing', 'succeeded', 'failed', 'ambiguous')),
  meta_container_id text,
  meta_media_id text,
  request_id text,
  error_code text,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (post_id, workspace_id)
    references public.posts(id, workspace_id) on delete cascade,
  unique (post_id, attempt_number)
);

create table public.publish_logs (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  post_id uuid,
  level text not null check (level in ('info', 'warning', 'error')),
  event text not null,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (post_id, workspace_id)
    references public.posts(id, workspace_id) on delete cascade
);

create table public.post_metrics_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  post_id uuid not null,
  captured_at timestamptz not null default now(),
  views bigint,
  reach bigint,
  likes bigint,
  comments bigint,
  shares bigint,
  saves bigint,
  raw_metrics jsonb not null default '{}'::jsonb,
  foreign key (post_id, workspace_id)
    references public.posts(id, workspace_id) on delete cascade,
  unique (post_id, captured_at)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  post_id uuid,
  type text not null,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (post_id, workspace_id)
    references public.posts(id, workspace_id) on delete cascade
);

create index instagram_accounts_workspace_idx on public.instagram_accounts(workspace_id);
create index media_assets_workspace_created_idx on public.media_assets(workspace_id, created_at desc);
create index posts_due_idx on public.posts(status, scheduled_at) where status in ('scheduled', 'needs_review');
create index posts_workspace_status_idx on public.posts(workspace_id, status, scheduled_at);
create index publish_attempts_post_idx on public.publish_attempts(post_id, attempt_number desc);
create index publish_logs_workspace_created_idx on public.publish_logs(workspace_id, created_at desc);
create index metrics_post_captured_idx on public.post_metrics_snapshots(post_id, captured_at desc);
create index notifications_user_unread_idx on public.notifications(user_id, created_at desc) where read_at is null;

-- RLS is enabled on every table. Workspace-scoped policies use security-definer helpers
-- to avoid recursive policies on workspace_members.
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.instagram_accounts enable row level security;
alter table public.instagram_tokens enable row level security;
alter table public.media_assets enable row level security;
alter table public.caption_sets enable row level security;
alter table public.hashtag_groups enable row level security;
alter table public.publishing_schedules enable row level security;
alter table public.posts enable row level security;
alter table public.publish_attempts enable row level security;
alter table public.publish_logs enable row level security;
alter table public.post_metrics_snapshots enable row level security;
alter table public.notifications enable row level security;

create policy "workspace members can read workspaces"
on public.workspaces for select to authenticated
using (public.is_workspace_member(id));

create policy "authenticated users can create their own workspace"
on public.workspaces for insert to authenticated
with check (owner_id = (select auth.uid()));

create policy "workspace owners can update workspace"
on public.workspaces for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "members can read workspace membership"
on public.workspace_members for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "owners and admins can manage workspace membership"
on public.workspace_members for all to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]));

create policy "members can read Instagram accounts"
on public.instagram_accounts for select to authenticated
using (public.is_workspace_member(workspace_id));
create policy "editors can manage Instagram accounts"
on public.instagram_accounts for all to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]));

-- No policies for instagram_tokens: authenticated clients cannot access OAuth secrets.
create policy "members can read media assets"
on public.media_assets for select to authenticated
using (public.is_workspace_member(workspace_id));
create policy "editors can manage media assets"
on public.media_assets for all to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]));

create policy "members can read caption sets"
on public.caption_sets for select to authenticated
using (public.is_workspace_member(workspace_id));
create policy "editors can manage caption sets"
on public.caption_sets for all to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]));

create policy "members can read hashtag groups"
on public.hashtag_groups for select to authenticated
using (public.is_workspace_member(workspace_id));
create policy "editors can manage hashtag groups"
on public.hashtag_groups for all to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]));

create policy "members can read schedules"
on public.publishing_schedules for select to authenticated
using (public.is_workspace_member(workspace_id));
create policy "editors can manage schedules"
on public.publishing_schedules for all to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]));

create policy "members can read posts"
on public.posts for select to authenticated
using (public.is_workspace_member(workspace_id));
create policy "editors can manage posts"
on public.posts for all to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]));

create policy "members can read publish attempts"
on public.publish_attempts for select to authenticated
using (public.is_workspace_member(workspace_id));
create policy "members can read publish logs"
on public.publish_logs for select to authenticated
using (public.is_workspace_member(workspace_id));
create policy "members can read metrics"
on public.post_metrics_snapshots for select to authenticated
using (public.is_workspace_member(workspace_id));
create policy "users can read their notifications"
on public.notifications for select to authenticated
using (public.is_workspace_member(workspace_id) and (user_id is null or user_id = (select auth.uid())));
create policy "users can mark their notifications read"
on public.notifications for update to authenticated
using (user_id = (select auth.uid()) and public.is_workspace_member(workspace_id))
with check (user_id = (select auth.uid()) and public.is_workspace_member(workspace_id));

create trigger workspaces_set_updated_at before update on public.workspaces
for each row execute function public.set_updated_at();
create trigger instagram_accounts_set_updated_at before update on public.instagram_accounts
for each row execute function public.set_updated_at();
create trigger instagram_tokens_set_updated_at before update on public.instagram_tokens
for each row execute function public.set_updated_at();
create trigger media_assets_set_updated_at before update on public.media_assets
for each row execute function public.set_updated_at();
create trigger caption_sets_set_updated_at before update on public.caption_sets
for each row execute function public.set_updated_at();
create trigger hashtag_groups_set_updated_at before update on public.hashtag_groups
for each row execute function public.set_updated_at();
create trigger publishing_schedules_set_updated_at before update on public.publishing_schedules
for each row execute function public.set_updated_at();
create trigger posts_set_updated_at before update on public.posts
for each row execute function public.set_updated_at();

-- Storage bucket and object policies are intentionally documented separately because
-- bucket creation is environment-specific and must be verified before enabling uploads.
