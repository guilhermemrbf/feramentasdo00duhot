-- This column originally shipped through Drizzle. Fresh Supabase projects
-- need it before analytics and the later Unified Login migration.
alter table public.instagram_accounts
  add column if not exists auth_mode text not null default 'instagram_login';

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.instagram_accounts'::regclass
      and conname = 'instagram_accounts_auth_mode_check'
  ) then
    alter table public.instagram_accounts
      add constraint instagram_accounts_auth_mode_check
      check (auth_mode in ('instagram_login', 'facebook_login'));
  end if;
end;
$$;
