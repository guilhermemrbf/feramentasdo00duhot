-- Profile preparation only. Account creation and OAuth stay in Instagram.
create table public.instagram_profile_drafts (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 64),
  handle text not null check (handle ~ '^[a-z0-9._]{1,30}$'),
  bio text not null default '' check (char_length(bio) <= 150),
  product_url text check (
    product_url is null or (char_length(product_url) <= 2048 and product_url ~* '^https://[^[:space:]]+$')
  ),
  photo_path text check (
    photo_path is null
    or photo_path in (
      workspace_id::text || '/' || id::text || '/profile.jpg',
      workspace_id::text || '/' || id::text || '/profile.png'
    )
  ),
  starter_reels uuid[] not null default '{}' check (cardinality(starter_reels) <= 30),
  reels_per_day smallint not null default 3 check (reels_per_day between 1 and 10),
  account_created boolean not null default false,
  instagram_account_id uuid,
  created_at timestamptz not null default now(),
  unique (workspace_id, handle),
  unique (workspace_id, instagram_account_id),
  foreign key (instagram_account_id, workspace_id)
    references public.instagram_accounts(id, workspace_id)
    on delete set null (instagram_account_id),
  check (instagram_account_id is null or account_created)
);

create index instagram_profile_drafts_workspace_created
  on public.instagram_profile_drafts (workspace_id, created_at desc, id desc);

alter table public.instagram_profile_drafts enable row level security;
revoke all on public.instagram_profile_drafts from public, anon, authenticated;
grant select, insert on public.instagram_profile_drafts to authenticated;
grant update (display_name, handle, bio, product_url, photo_path, starter_reels, reels_per_day,
  account_created, instagram_account_id) on public.instagram_profile_drafts to authenticated;

create policy "members can read Instagram profile drafts"
on public.instagram_profile_drafts for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "editors can prepare Instagram profile drafts"
on public.instagram_profile_drafts for insert to authenticated
with check (
  public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[])
  and account_created = false and instagram_account_id is null
);

create policy "editors can update Instagram profile drafts"
on public.instagram_profile_drafts for update to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]))
with check (
  public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[])
  and (
    instagram_account_id is null
    or exists (
      select 1 from public.instagram_accounts a
      where a.id = instagram_account_id and a.workspace_id = instagram_profile_drafts.workspace_id
        and lower(a.username) = instagram_profile_drafts.handle
    )
  )
);
