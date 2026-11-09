-- Assisted Stories are reminders. The automatic Instagram worker never reads this table.
create table public.instagram_story_reminders (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  instagram_account_id uuid not null,
  storage_path text not null unique,
  filename text not null check (char_length(filename) between 1 and 255),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'video/mp4', 'video/quicktime', 'video/webm')),
  link_url text not null check (char_length(link_url) <= 2048 and link_url ~* '^https://[^[:space:]]+$'),
  link_title text not null check (char_length(btrim(link_title)) between 1 and 60),
  sticker_x smallint not null check (sticker_x between 15 and 85),
  sticker_y smallint not null check (sticker_y between 10 and 90),
  scheduled_at timestamptz not null,
  state text not null default 'pending' check (state in ('pending', 'done', 'cancelled')),
  created_at timestamptz not null default now(),
  foreign key (instagram_account_id, workspace_id)
    references public.instagram_accounts(id, workspace_id) on delete cascade,
  check (storage_path = workspace_id::text || '/' || id::text || '/' || filename),
  check (filename ~ '^[A-Za-z0-9_.-]+$')
);

create index instagram_story_reminders_workspace_schedule
  on public.instagram_story_reminders (workspace_id, scheduled_at, id);

alter table public.instagram_story_reminders enable row level security;

revoke all on public.instagram_story_reminders from public, anon, authenticated;
grant select, insert on public.instagram_story_reminders to authenticated;
grant update (state) on public.instagram_story_reminders to authenticated;

create policy "members can read Story reminders"
on public.instagram_story_reminders for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "editors can schedule Story reminders"
on public.instagram_story_reminders for insert to authenticated
with check (
  state = 'pending' and scheduled_at > now()
  and public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[])
  and exists (
    select 1 from public.instagram_accounts a
    where a.id = instagram_account_id and a.workspace_id = instagram_story_reminders.workspace_id
      and a.connection_status = 'connected'
  )
  and exists (
    select 1 from storage.objects o
    where o.bucket_id = 'postkit-media' and o.name = storage_path
  )
);

create policy "editors can resolve pending Story reminders"
on public.instagram_story_reminders for update to authenticated
using (
  state = 'pending'
  and public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[])
)
with check (
  state in ('done', 'cancelled')
  and public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[])
);
