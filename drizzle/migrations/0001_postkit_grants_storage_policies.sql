grant usage on schema public to authenticated, service_role;
grant select, insert, update on public.workspaces to authenticated;
grant select, insert, update, delete on public.workspace_members to authenticated;
grant select, insert, update, delete on public.instagram_accounts, public.media_assets, public.caption_sets, public.hashtag_groups, public.publishing_schedules, public.posts to authenticated;
grant select on public.publish_attempts, public.publish_logs, public.post_metrics_snapshots to authenticated;
grant select, update on public.notifications to authenticated;
grant all on public.workspaces, public.workspace_members, public.instagram_accounts, public.instagram_tokens, public.media_assets, public.caption_sets, public.hashtag_groups, public.publishing_schedules, public.posts, public.publish_attempts, public.publish_logs, public.post_metrics_snapshots, public.notifications to service_role;
grant usage, select on all sequences in schema public to service_role;
revoke all on public.instagram_tokens from anon, authenticated;

create or replace function public.add_workspace_owner_member()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'owner') on conflict do nothing;
  return new;
end; $$;
revoke execute on function public.add_workspace_owner_member() from public, anon, authenticated;
create trigger workspaces_add_owner_member after insert on public.workspaces
for each row execute function public.add_workspace_owner_member();

create policy "workspace members can read PostKit media objects"
on storage.objects for select to authenticated
using (bucket_id = 'postkit-media' and (storage.foldername(name))[1] is not null
  and public.is_workspace_member(((storage.foldername(name))[1])::uuid));
create policy "workspace editors can upload PostKit media objects"
on storage.objects for insert to authenticated
with check (bucket_id = 'postkit-media' and (storage.foldername(name))[1] is not null
  and public.has_workspace_role(((storage.foldername(name))[1])::uuid, array['owner','admin','editor']::public.workspace_role[]));
create policy "workspace editors can update PostKit media objects"
on storage.objects for update to authenticated
using (bucket_id = 'postkit-media' and (storage.foldername(name))[1] is not null
  and public.has_workspace_role(((storage.foldername(name))[1])::uuid, array['owner','admin','editor']::public.workspace_role[]))
with check (bucket_id = 'postkit-media' and (storage.foldername(name))[1] is not null
  and public.has_workspace_role(((storage.foldername(name))[1])::uuid, array['owner','admin','editor']::public.workspace_role[]));
create policy "workspace editors can delete PostKit media objects"
on storage.objects for delete to authenticated
using (bucket_id = 'postkit-media' and (storage.foldername(name))[1] is not null
  and public.has_workspace_role(((storage.foldername(name))[1])::uuid, array['owner','admin','editor']::public.workspace_role[]));