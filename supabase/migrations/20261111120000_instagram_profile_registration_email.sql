-- Existing drafts can keep their email unset until the team fills it in.
alter table public.instagram_profile_drafts
  add column if not exists registration_email text
  constraint instagram_profile_drafts_registration_email_check check (
    registration_email is null
    or (
      char_length(registration_email) <= 254
      and registration_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    )
  );

create unique index if not exists instagram_profile_drafts_workspace_email
  on public.instagram_profile_drafts (workspace_id, lower(registration_email))
  where registration_email is not null;

grant update (registration_email) on public.instagram_profile_drafts to authenticated;
