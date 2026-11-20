-- Run once as the Supabase database operator for the verified legacy workspace.
-- Replace both placeholders with the IDs confirmed in Auth and public.workspaces.
begin;

do $restore$
declare
  verified_owner uuid := '<OWNER_UUID>';
  verified_workspace uuid := '<WORKSPACE_UUID>';
begin
  perform 1
  from public.workspaces
  where id = verified_workspace and owner_id = verified_owner
  for update;

  if not found then
    raise exception 'The specified workspace does not belong to the verified owner';
  end if;

  if exists (
    select 1
    from public.instagram_workspace_apps
    where workspace_id = verified_workspace and app_id is not null
  ) then
    raise exception 'This workspace already has a dedicated Meta app';
  end if;

  insert into public.instagram_workspace_apps (workspace_id)
  values (verified_workspace)
  on conflict (workspace_id) do nothing;
end;
$restore$;

commit;
