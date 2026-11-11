alter table public.instagram_accounts
  drop constraint instagram_accounts_auth_mode_check,
  add constraint instagram_accounts_auth_mode_check
    check (auth_mode in ('instagram_login', 'facebook_login', 'instagram_unified_login'));

-- Save the account and its encrypted grant in one transaction. The browser
-- never calls this function and cannot read or change the stored token.
create or replace function public.save_instagram_unified_accounts(
  p_workspace_id uuid,
  p_user_id uuid,
  p_accounts jsonb,
  p_scopes text[],
  p_token_ciphertext text,
  p_expires_at timestamptz
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.workspaces w
    where w.id = p_workspace_id and (
      w.owner_id = p_user_id or exists (
        select 1 from public.workspace_members m
        where m.workspace_id = w.id and m.user_id = p_user_id
          and m.role in ('owner', 'admin', 'editor')
      )
    )
  ) then
    raise exception 'Workspace access denied' using errcode = '42501';
  end if;

  with saved as (
    insert into public.instagram_accounts (
      workspace_id, instagram_user_id, username, display_name, connection_status,
      auth_mode, scopes, token_expires_at, last_verified_at, connected_by
    )
    select p_workspace_id, profile.id, profile.username, profile.name, 'connected',
      'instagram_unified_login', p_scopes, p_expires_at, now(), p_user_id
    from jsonb_to_recordset(p_accounts) as profile(id text, username text, name text)
    order by profile.id
    on conflict (workspace_id, instagram_user_id) do update set
      username = excluded.username,
      display_name = coalesce(excluded.display_name, instagram_accounts.display_name),
      connection_status = excluded.connection_status,
      auth_mode = excluded.auth_mode,
      scopes = excluded.scopes,
      token_expires_at = excluded.token_expires_at,
      last_verified_at = excluded.last_verified_at,
      connected_by = excluded.connected_by,
      last_error_code = null,
      last_error_message = null
    returning id
  )
  insert into public.instagram_tokens (
    account_id, access_token_ciphertext, encryption_key_version, token_expires_at
  )
  select id, p_token_ciphertext, 'v1', p_expires_at from saved
  on conflict (account_id) do update set
    access_token_ciphertext = excluded.access_token_ciphertext,
    encryption_key_version = excluded.encryption_key_version,
    token_expires_at = excluded.token_expires_at,
    updated_at = now(),
    refresh_token_ciphertext = null,
    analytics_access_token_ciphertext = null,
    analytics_token_expires_at = null;
end;
$$;

revoke all on function public.save_instagram_unified_accounts(uuid, uuid, jsonb, text[], text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.save_instagram_unified_accounts(uuid, uuid, jsonb, text[], text, timestamptz)
  to service_role;
