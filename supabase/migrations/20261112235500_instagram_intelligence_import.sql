create table public.instagram_intelligence_batches (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  profile_count integer not null check (profile_count between 1 and 1000),
  created_at timestamptz not null default now()
);

create index instagram_intelligence_batches_owner_created_idx
  on public.instagram_intelligence_batches (owner_id, created_at desc, id desc);

create table public.instagram_intelligence_profiles (
  batch_id uuid not null references public.instagram_intelligence_batches(id) on delete cascade,
  username text not null check (
    char_length(username) between 1 and 30 and username collate "C" ~ '^[a-z0-9_]+([.][a-z0-9_]+)*$'
  ),
  position integer not null check (position between 1 and 1000),
  primary key (batch_id, position),
  unique (batch_id, username)
);

alter table public.instagram_intelligence_batches enable row level security;
alter table public.instagram_intelligence_profiles enable row level security;
revoke all on public.instagram_intelligence_batches, public.instagram_intelligence_profiles from public, anon, authenticated;
grant select on public.instagram_intelligence_batches, public.instagram_intelligence_profiles to authenticated;

create policy "Owners read their intelligence batches"
on public.instagram_intelligence_batches for select to authenticated
using (
  owner_id = (select auth.uid())
  and ((select auth.jwt())->>'is_anonymous') = 'false'
);

create policy "Owners read their imported profiles"
on public.instagram_intelligence_profiles for select to authenticated
using (exists (
  select 1 from public.instagram_intelligence_batches batch
  where batch.id = batch_id and batch.owner_id = (select auth.uid())
));

-- Direct writes are revoked. This function owns the full, bounded import transaction.
create function public.create_instagram_intelligence_batch(p_name text, p_usernames text[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid := auth.uid();
  total integer := cardinality(p_usernames);
  batch uuid;
begin
  if owner is null or (auth.jwt()->>'is_anonymous') is distinct from 'false' then
    raise exception using errcode = '42501', message = 'Acesso autenticado necessário.';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 80
    or p_name ~ '[[:cntrl:]]' or total is null or total not between 1 and 1000
    or array_ndims(p_usernames) is distinct from 1 then
    raise exception using errcode = '22023', message = 'Nome ou tamanho do lote inválido.';
  end if;
  if exists (
    select 1 from unnest(p_usernames) as input(username)
    where username is null or char_length(username) not between 1 and 30
      or username collate "C" !~ '^[a-z0-9_]+([.][a-z0-9_]+)*$'
      or username in (
        'about', 'accounts', 'api', 'challenge', 'developer', 'direct', 'explore', 'legal',
        'oauth', 'p', 'privacy', 'reel', 'reels', 'settings', 'stories', 'terms', 'tv', 'web'
      )
  ) or (select count(distinct username) from unnest(p_usernames) as input(username)) <> total then
    raise exception using errcode = '22023', message = 'A lista contém nomes inválidos ou duplicados.';
  end if;

  insert into public.instagram_intelligence_batches (owner_id, name, profile_count)
  values (owner, btrim(p_name), total)
  returning id into batch;

  insert into public.instagram_intelligence_profiles (batch_id, username, position)
  select batch, input.username, input.position::integer
  from unnest(p_usernames) with ordinality as input(username, position);

  return batch;
end;
$$;

revoke all on function public.create_instagram_intelligence_batch(text, text[]) from public, anon, authenticated;
grant execute on function public.create_instagram_intelligence_batch(text, text[]) to authenticated;
