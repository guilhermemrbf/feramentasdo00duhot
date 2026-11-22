begin;

create table private.platform_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  decision text not null default 'pending' check (decision in ('pending', 'approved', 'denied')),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  trial_expires_at timestamptz
);

create table private.platform_administrators (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table private.platform_trial_invites (
  id uuid primary key default gen_random_uuid(),
  token_hash bytea unique not null,
  email text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  revoked_at timestamptz
);

alter table private.platform_access
add column trial_invite_id uuid references private.platform_trial_invites(id) on delete set null;

create table private.platform_access_audit (
  id bigint generated always as identity primary key,
  subject_id uuid not null,
  actor_id uuid not null,
  decision text not null check (decision in ('approved', 'denied')),
  happened_at timestamptz not null default now()
);

alter table private.platform_access enable row level security;
alter table private.platform_administrators enable row level security;
alter table private.platform_trial_invites enable row level security;
alter table private.platform_access_audit enable row level security;

revoke all on private.platform_access, private.platform_administrators,
  private.platform_trial_invites, private.platform_access_audit from public, anon, authenticated;

-- Bind the existing verified production account by immutable Auth user ID.
-- An empty development or preview database can be bootstrapped using the documented operator SQL.
insert into private.platform_administrators(user_id)
select id from auth.users
where lower(email) = 'scaleupperformance@gmail.com' and email_confirmed_at is not null
on conflict do nothing;

insert into private.platform_access(user_id, created_at)
select id, coalesce(created_at, now()) from auth.users
on conflict do nothing;

create function private.register_platform_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into private.platform_access(user_id) values(new.id) on conflict do nothing;
  return new;
end;
$$;

revoke all on function private.register_platform_user() from public, anon, authenticated;
create trigger register_mousehot_access after insert on auth.users
for each row execute function private.register_platform_user();

create function private.platform_user_status(p_user uuid) returns text
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select case
      when u.email_confirmed_at is null then 'unverified'
      when exists(select from private.platform_administrators a where a.user_id = u.id) then 'admin'
      when access.decision in ('approved', 'denied') then access.decision
      when access.trial_expires_at > statement_timestamp() and exists (
        select from private.platform_trial_invites i
        where i.id = access.trial_invite_id and i.revoked_at is null
      ) then 'trial'
      when access.trial_expires_at is not null then 'expired'
      else 'pending'
    end
    from auth.users u left join private.platform_access access on access.user_id = u.id
    where u.id = p_user and u.deleted_at is null
  ), 'unverified');
$$;

create function public.platform_access_status() returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'status', private.platform_user_status(auth.uid()),
    'trial_expires_at', (select trial_expires_at from private.platform_access where user_id = auth.uid()),
    'server_now', statement_timestamp()
  );
$$;

create function public.platform_is_approved() returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.platform_user_status(auth.uid()) in ('admin','approved');
$$;

create function public.platform_approved_user(p_user uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.platform_user_status(p_user) in ('admin','approved');
$$;

create function public.platform_admin_leads() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if private.platform_user_status(auth.uid()) <> 'admin' then
    raise exception 'Acesso exclusivo da administração.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(lead) order by created_at desc) from (
      select u.id, u.email, left(trim(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', '')), 120) as name,
        a.decision, a.created_at, a.decided_at, u.email_confirmed_at as verified_at, a.trial_expires_at
      from private.platform_access a join auth.users u on u.id = a.user_id
      where u.deleted_at is null
        and not exists (select from private.platform_administrators ad where ad.user_id = u.id)
    ) lead
  ), '[]'::jsonb);
end;
$$;

create function public.platform_admin_decide(p_user uuid, p_decision text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if private.platform_user_status(auth.uid()) <> 'admin' then
    raise exception 'Acesso exclusivo da administração.' using errcode = '42501';
  end if;
  if p_decision is null or p_decision not in ('approved', 'denied')
    or exists(select from private.platform_administrators where user_id = p_user) then
    raise exception 'Decisão inválida.';
  end if;
  if p_decision = 'approved' and not exists (
    select from auth.users where id = p_user and email_confirmed_at is not null and deleted_at is null
  ) then
    raise exception 'O e-mail ainda precisa ser confirmado.';
  end if;
  update private.platform_access
  set decision = p_decision, decided_by = auth.uid(), decided_at = now(), trial_expires_at = null, trial_invite_id = null
  where user_id = p_user and decision <> p_decision and decision <> 'approved';
  if found then
    insert into private.platform_access_audit(subject_id, actor_id, decision)
    values (p_user, auth.uid(), p_decision);
  end if;
end;
$$;

create function public.platform_admin_invites() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if private.platform_user_status(auth.uid()) <> 'admin' then
    raise exception 'Acesso exclusivo da administração.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(invite) order by created_at desc) from (
      select id, email, created_at, expires_at, used_at, revoked_at
      from private.platform_trial_invites order by created_at desc limit 100
    ) invite
  ), '[]'::jsonb);
end;
$$;

create function public.platform_admin_create_invite(p_email text) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  normalized text := lower(trim(p_email));
  token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if private.platform_user_status(auth.uid()) <> 'admin' then
    raise exception 'Acesso exclusivo da administração.' using errcode = '42501';
  end if;
  if normalized is null or length(normalized) > 254 or normalized !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'Informe um e-mail válido.';
  end if;
  insert into private.platform_trial_invites(email, token_hash, created_by)
  values(normalized, sha256(convert_to(token, 'UTF8')), auth.uid());
  return token;
end;
$$;

create function public.platform_admin_revoke_invite(p_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if private.platform_user_status(auth.uid()) <> 'admin' then
    raise exception 'Acesso exclusivo da administração.' using errcode = '42501';
  end if;
  update private.platform_trial_invites set revoked_at = now()
  where id = p_id and revoked_at is null;
end;
$$;

create function public.platform_start_trial(p_token text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  account_email text;
  current_access private.platform_access;
  invite_id uuid;
  updated_at timestamptz := statement_timestamp();
begin
  select lower(email) into account_email from auth.users
  where id = auth.uid() and email_confirmed_at is not null and deleted_at is null;
  if account_email is null then
    raise exception 'Confirme o e-mail para iniciar o teste.' using errcode = '42501';
  end if;
  select * into current_access from private.platform_access where user_id = auth.uid() for update;
  if not found or current_access.decision <> 'pending'
     or private.platform_user_status(auth.uid()) = 'admin' then
    raise exception 'Este cadastro não pode iniciar um teste.';
  end if;
  if private.platform_user_status(auth.uid()) = 'trial' then return public.platform_access_status(); end if;
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then raise exception 'Convite inválido.'; end if;
  update private.platform_trial_invites set used_by = auth.uid(), used_at = updated_at
  where token_hash = sha256(convert_to(p_token, 'UTF8')) and email = account_email
    and expires_at > updated_at and revoked_at is null and used_at is null
  returning id into invite_id;
  if not found then raise exception 'Convite inválido, usado ou indisponível para este e-mail.'; end if;
  update private.platform_access set trial_expires_at = updated_at + interval '15 minutes', trial_invite_id = invite_id
  where user_id = auth.uid();
  return public.platform_access_status();
end;
$$;

-- Gate Security Definer RPCs as well as ordinary PostgREST table requests.
-- Gate Storage and direct/Realtime row visibility through restrictive RLS too.
create function public.platform_data_api_guard() returns void
language plpgsql stable set search_path = ''
as $$
declare
  target text := current_setting('request.path', true);
begin
  if current_user not in ('anon', 'authenticated') then return; end if;
  if current_user = 'authenticated' then
    if public.platform_is_approved() or target in ('/rpc/platform_access_status', '/rpc/platform_start_trial') then
      return;
    end if;
  end if;
  raise exception 'O acesso à plataforma ainda não foi aprovado.' using errcode = '42501';
end;
$$;

revoke all on function
  private.platform_user_status(uuid), public.platform_approved_user(uuid), public.platform_is_approved(),
  public.platform_access_status(), public.platform_admin_leads(), public.platform_admin_decide(uuid,text),
  public.platform_admin_invites(), public.platform_admin_create_invite(text), public.platform_admin_revoke_invite(uuid),
  public.platform_start_trial(text), public.platform_data_api_guard()
from public, anon, authenticated, service_role;

grant execute on function public.platform_approved_user(uuid) to service_role;
grant execute on function public.platform_data_api_guard() to anon, authenticated, service_role;
grant execute on function
  public.platform_is_approved(), public.platform_access_status(), public.platform_admin_leads(),
  public.platform_admin_decide(uuid,text), public.platform_admin_invites(),
  public.platform_admin_create_invite(text), public.platform_admin_revoke_invite(uuid), public.platform_start_trial(text)
to authenticated;

do $$
declare
  relation record;
begin
  for relation in select n.nspname, c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r','p') and c.relrowsecurity
  loop
    execute format('create policy platform_approved_access on %I.%I as restrictive to authenticated using ((select public.platform_is_approved())) with check ((select public.platform_is_approved()))', relation.nspname, relation.relname);
  end loop;
end;
$$;

create policy platform_approved_postkit_storage on storage.objects as restrictive to authenticated
using (bucket_id not in ('postkit-media', 'postkit-drive-staging') or (select public.platform_is_approved()))
with check (bucket_id not in ('postkit-media', 'postkit-drive-staging') or (select public.platform_is_approved()));

do $$
begin
  if exists (
    select 1 from pg_db_role_setting s join pg_roles r on r.oid = s.setrole
    cross join lateral unnest(s.setconfig) option
    where r.rolname = 'authenticator'
      and option like 'pgrst.db_pre_request=%'
      and option <> 'pgrst.db_pre_request=public.platform_data_api_guard'
  ) then
    raise exception 'The project already has a Data API pre-request hook. Integrate the access guard before deployment.';
  end if;
end;
$$;

alter role authenticator set pgrst.db_pre_request to 'public.platform_data_api_guard';
notify pgrst, 'reload config';
notify pgrst, 'reload schema';
commit;
