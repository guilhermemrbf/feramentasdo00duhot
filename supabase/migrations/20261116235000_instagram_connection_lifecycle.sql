begin;

alter table public.instagram_accounts
  add column profile_picture_url text,
  add column client_business_id text,
  add column login_config_id text,
  add column connected_at timestamptz,
  add column disconnected_at timestamptz;

-- Keep the existing RPC signature: metadata travels with each validated profile.
create or replace function public.save_instagram_unified_accounts(
  p_workspace_id uuid, p_user_id uuid, p_accounts jsonb, p_scopes text[],
  p_token_ciphertext text, p_expires_at timestamptz
) returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (
    select 1 from public.workspaces w where w.id = p_workspace_id and (
      w.owner_id = p_user_id or exists (
        select 1 from public.workspace_members m where m.workspace_id = w.id
          and m.user_id = p_user_id and m.role in ('owner','admin','editor')
      )
    )
  ) then raise exception 'Workspace access denied' using errcode = '42501'; end if;
  if p_accounts is null or jsonb_typeof(p_accounts) <> 'array'
    or jsonb_array_length(p_accounts) not between 1 and 2100
    or nullif(p_token_ciphertext, '') is null
    or (p_expires_at is not null and (not isfinite(p_expires_at) or p_expires_at <= now()))
    or not (array['instagram_basic','instagram_content_publish']::text[] <@ p_scopes)
    or p_scopes is null then
    raise exception 'Invalid Instagram grant' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_to_recordset(p_accounts)
      as a(id text, username text, client_business_id text, login_config_id text)
    where a.id is null or a.id !~ '^[0-9]+$' or nullif(btrim(a.username),'') is null
      or (a.client_business_id is not null and a.client_business_id !~ '^[0-9]+$')
      or (a.login_config_id is not null and a.login_config_id !~ '^[0-9]+$')) then
    raise exception 'Invalid Instagram profile' using errcode = '22023';
  end if;

  with saved as (
    insert into public.instagram_accounts (
      workspace_id, instagram_user_id, username, display_name, connection_status,
      auth_mode, scopes, token_expires_at, last_verified_at, connected_by,
      client_business_id, login_config_id, connected_at, disconnected_at
    )
    select p_workspace_id, a.id, a.username, a.name, 'connected',
      'instagram_unified_login', p_scopes, p_expires_at, now(), p_user_id,
      a.client_business_id, a.login_config_id, now(), null
    from jsonb_to_recordset(p_accounts)
      as a(id text, username text, name text, client_business_id text, login_config_id text)
    order by a.id
    on conflict (workspace_id, instagram_user_id) do update set
      username = excluded.username,
      display_name = coalesce(excluded.display_name, instagram_accounts.display_name),
      connection_status = 'connected', auth_mode = excluded.auth_mode,
      scopes = excluded.scopes, token_expires_at = excluded.token_expires_at,
      last_verified_at = excluded.last_verified_at, connected_by = excluded.connected_by,
      client_business_id = excluded.client_business_id, login_config_id = excluded.login_config_id,
      connected_at = excluded.connected_at, disconnected_at = null,
      last_error_code = null, last_error_message = null
    returning id
  )
  insert into public.instagram_tokens (
    account_id, access_token_ciphertext, encryption_key_version, token_expires_at
  )
  select id, p_token_ciphertext, 'v1', p_expires_at from saved
  on conflict (account_id) do update set
    access_token_ciphertext = excluded.access_token_ciphertext,
    encryption_key_version = excluded.encryption_key_version,
    token_expires_at = excluded.token_expires_at, updated_at = now(),
    refresh_token_ciphertext = null,
    analytics_access_token_ciphertext = null, analytics_token_expires_at = null;
end;
$$;

revoke all on function public.save_instagram_unified_accounts(uuid,uuid,jsonb,text[],text,timestamptz)
  from public, anon, authenticated;
grant execute on function public.save_instagram_unified_accounts(uuid,uuid,jsonb,text[],text,timestamptz)
  to service_role;

create function public.disconnect_instagram_account(p_account_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare target public.instagram_accounts; cancelled_posts integer; cancelled_stories integer;
begin
  -- Use the same locks as the publisher and reviewed scheduler. No network work
  -- occurs while holding these locks, and an in-flight publication is preserved.
  perform pg_catalog.pg_advisory_xact_lock(6110301);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_account_id::text,0));
  select * into target from public.instagram_accounts where id = p_account_id for update;
  if not found or auth.uid() is null or not coalesce(public.has_workspace_role(
      target.workspace_id, array['owner','admin','editor']::public.workspace_role[]),false) then
    raise exception 'account_access_denied' using errcode = '42501';
  end if;
  perform 1 from private.instagram_reel_loops where account_id = p_account_id for update;
  perform 1 from public.posts where instagram_account_id = p_account_id
    and status in ('scheduled','processing') for update;
  if exists (select 1 from public.posts where instagram_account_id = p_account_id and status = 'processing') then
    raise exception 'account_publish_in_progress' using errcode = '55000';
  end if;
  update public.posts set status = 'cancelled', last_error_code = 'account_disconnected',
    last_error_message = 'Agendamento cancelado ao desconectar esta conta.'
    where instagram_account_id = p_account_id and status = 'scheduled';
  get diagnostics cancelled_posts = row_count;
  update private.instagram_reel_loops set state = 'paused', pause_reason = 'account'
    where account_id = p_account_id and state = 'active';
  update public.instagram_story_reminders set state = 'cancelled'
    where instagram_account_id = p_account_id and state = 'pending';
  get diagnostics cancelled_stories = row_count;
  delete from public.instagram_tokens where account_id = p_account_id;
  update public.instagram_accounts set connection_status = 'revoked', scopes = '{}',
    token_expires_at = null, disconnected_at = coalesce(disconnected_at,now()),
    last_error_code = 'user_disconnected', last_error_message = 'Desconectada desta operação.'
    where id = p_account_id;
  return jsonb_build_object('disconnected',true,'cancelledPosts',cancelled_posts,
    'cancelledStories',cancelled_stories);
end;
$$;
revoke all on function public.disconnect_instagram_account(uuid) from public,anon;
grant execute on function public.disconnect_instagram_account(uuid) to authenticated;

commit;
