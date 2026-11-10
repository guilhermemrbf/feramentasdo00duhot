alter table public.media_assets
  add column import_batch_id uuid,
  add column import_folder text check (char_length(import_folder) <= 255),
  add column import_position integer check (import_position >= 0);

alter table public.posts
  add column cover_asset_id uuid,
  add column first_comment text check (char_length(first_comment) between 1 and 2200),
  add column first_comment_status text check (first_comment_status in ('sending', 'published', 'failed', 'needs_review')),
  add column first_comment_attempted_at timestamptz,
  add constraint reel_cover_same_workspace foreign key (cover_asset_id, workspace_id)
    references public.media_assets(id, workspace_id) on delete restrict;

-- An editor can supply comment text when scheduling. Worker state is server-owned.
create function public.initialize_reel_details()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.first_comment_status := null;
  new.first_comment_attempted_at := null;
  return new;
end;
$$;
create trigger initialize_reel_details before insert on public.posts
for each row execute function public.initialize_reel_details();

create index posts_first_comment_queue_idx on public.posts (published_at)
  where status = 'published' and first_comment is not null and first_comment_status is null;
create index posts_first_comment_sending_idx on public.posts (first_comment_attempted_at)
  where first_comment_status = 'sending';

create function public.claim_instagram_first_comment()
returns table (id uuid, workspace_id uuid, instagram_account_id uuid, meta_media_id text, first_comment text)
language plpgsql security definer set search_path = '' as $$
declare
  target uuid;
begin
  -- An interrupted request could already have reached Meta. Do not send it again.
  update public.posts p set first_comment_status = 'needs_review'
  where p.first_comment_status = 'sending'
    and p.first_comment_attempted_at < now() - interval '2 minutes';

  select p.id into target from public.posts p
  where p.status = 'published' and p.content_type = 'reel'
    and p.meta_media_id is not null and p.first_comment is not null
    and p.first_comment_status is null
  order by p.published_at, p.id limit 1 for update skip locked;
  if not found then return; end if;

  return query update public.posts p
  set first_comment_status = 'sending', first_comment_attempted_at = now()
  where p.id = target
  returning p.id, p.workspace_id, p.instagram_account_id, p.meta_media_id, p.first_comment;
end;
$$;

create function public.finish_instagram_first_comment(p_id uuid, p_result text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_result is null or p_result not in ('published', 'failed', 'needs_review') then return false; end if;
  update public.posts p set first_comment_status = p_result
  where p.id = p_id and p.first_comment_status = 'sending';
  return found;
end;
$$;

revoke all on function public.claim_instagram_first_comment() from public, anon, authenticated;
revoke all on function public.finish_instagram_first_comment(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_instagram_first_comment() to service_role;
grant execute on function public.finish_instagram_first_comment(uuid, text) to service_role;
