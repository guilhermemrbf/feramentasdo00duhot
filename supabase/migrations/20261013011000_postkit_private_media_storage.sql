-- Private media storage for PostKit.
-- Object paths must start with the workspace UUID: <workspace_id>/<asset-id>/<filename>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'postkit-media',
  'postkit-media',
  false,
  524288000,
  array['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/png']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "workspace members can read PostKit media objects"
on storage.objects for select to authenticated
using (
  bucket_id = 'postkit-media'
  and (storage.foldername(name))[1] is not null
  and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
);

create policy "workspace editors can upload PostKit media objects"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'postkit-media'
  and (storage.foldername(name))[1] is not null
  and public.has_workspace_role(
    ((storage.foldername(name))[1])::uuid,
    array['owner','admin','editor']::public.workspace_role[]
  )
);

create policy "workspace editors can update PostKit media objects"
on storage.objects for update to authenticated
using (
  bucket_id = 'postkit-media'
  and (storage.foldername(name))[1] is not null
  and public.has_workspace_role(
    ((storage.foldername(name))[1])::uuid,
    array['owner','admin','editor']::public.workspace_role[]
  )
)
with check (
  bucket_id = 'postkit-media'
  and (storage.foldername(name))[1] is not null
  and public.has_workspace_role(
    ((storage.foldername(name))[1])::uuid,
    array['owner','admin','editor']::public.workspace_role[]
  )
);

create policy "workspace editors can delete PostKit media objects"
on storage.objects for delete to authenticated
using (
  bucket_id = 'postkit-media'
  and (storage.foldername(name))[1] is not null
  and public.has_workspace_role(
    ((storage.foldername(name))[1])::uuid,
    array['owner','admin','editor']::public.workspace_role[]
  )
);
