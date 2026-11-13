begin;

create table private.instagram_intelligence_policies (
  version text not null,
  key text not null,
  area text not null,
  url text not null,
  consulted_on date not null,
  description text not null,
  primary key (version, key)
);
insert into private.instagram_intelligence_policies values
  ('1', 'community', 'community', 'https://transparency.meta.com/policies/community-standards/', '2026-11-13',
   'Diretrizes da Comunidade. Identifique a regra específica na justificativa.'),
  ('1', 'recommendation', 'recommendation', 'https://about.fb.com/br/news/2020/08/publicando-nossas-diretrizes-de-recomendacoes/', '2026-11-13',
   'A Meta aplica critérios adicionais ao recomendar conteúdo.'),
  ('1', 'originality', 'recommendation', 'https://about.fb.com/br/news/2024/04/ajudando-o-criador-de-conteudo-a-encontrar-novos-publicos/', '2026-11-13',
   'A Meta descreve critérios de originalidade e a consulta pelo Status da Conta.');

create table public.instagram_intelligence_jobs (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  username text not null,
  source text not null check (source in ('connected_analytics', 'owner_import')),
  source_label text not null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  snapshot jsonb,
  import_key text,
  report jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  attempts integer not null default 0,
  due_at timestamptz not null default now(),
  state text not null default 'queued' check (state in ('queued', 'done', 'failed')),
  failure text check (failure in ('processing_failed', 'workspace_revoked', 'ambiguous_account')),
  foreign key (batch_id, username) references public.instagram_intelligence_profiles(batch_id, username) on delete cascade
);

create index instagram_intelligence_jobs_latest on public.instagram_intelligence_jobs(batch_id, username, created_at desc, id desc);
create index instagram_intelligence_jobs_due on public.instagram_intelligence_jobs(due_at, id) where state = 'queued';
create unique index instagram_intelligence_jobs_active on public.instagram_intelligence_jobs(batch_id, username) where state = 'queued';

create unique index instagram_intelligence_jobs_unique_import
  on public.instagram_intelligence_jobs(batch_id, username, import_key)
  where source = 'owner_import' and state <> 'failed';

create table public.instagram_intelligence_reviews (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.instagram_intelligence_jobs(id) on delete cascade,
  reviewer uuid not null references auth.users(id) on delete cascade,
  assessment jsonb not null,
  report jsonb not null,
  created_at timestamptz not null default now()
);
create index instagram_intelligence_reviews_history on public.instagram_intelligence_reviews(job_id, id desc);

alter table public.instagram_intelligence_jobs enable row level security;
alter table public.instagram_intelligence_reviews enable row level security;
revoke all on public.instagram_intelligence_jobs, public.instagram_intelligence_reviews from public, anon, authenticated;
grant select on public.instagram_intelligence_jobs, public.instagram_intelligence_reviews to authenticated;
revoke all on private.instagram_intelligence_policies from public, anon, authenticated;

create function private.intelligence_owns_workspace(p_workspace uuid, p_owner uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_owner = auth.uid() and exists (
    select 1 from public.workspaces w where w.id = p_workspace and w.owner_id = p_owner
  )
$$;
revoke all on function private.intelligence_owns_workspace(uuid,uuid) from public, anon, authenticated;
grant execute on function private.intelligence_owns_workspace(uuid,uuid) to authenticated;
create policy "Owners read analysis jobs" on public.instagram_intelligence_jobs for select to authenticated
using (
  exists (select 1 from public.instagram_intelligence_batches b where b.id = batch_id)
  and (source = 'owner_import' or private.intelligence_owns_workspace(workspace_id, (select auth.uid())))
);
create policy "Owners read analysis reviews" on public.instagram_intelligence_reviews for select to authenticated
using (exists (select 1 from public.instagram_intelligence_jobs j where j.id = job_id));

create function private.intelligence_batch_owner(p_batch uuid)
returns uuid language plpgsql stable set search_path = '' as $$
declare
  owner uuid := auth.uid();
begin
  if owner is null or (auth.jwt()->>'is_anonymous') is distinct from 'false'
    or not exists (select 1 from public.instagram_intelligence_batches b where b.id = p_batch and b.owner_id = owner) then
    raise exception using errcode = '42501', message = 'Lote inacessível.';
  end if;
  return owner;
end;
$$;

create function private.intelligence_media_url(p_url text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(p_url collate "C" ~ '^https://(www[.])?instagram[.]com/(reel|reels|p|tv)/[A-Za-z0-9_-]{1,32}/$', false)
$$;

create function private.intelligence_valid_metrics(p_snapshot jsonb)
returns boolean language plpgsql set search_path = '' as $$
declare
  item jsonb;
  metric text;
  value jsonb;
  captured timestamptz;
  code text;
  seen text[] := '{}';
begin
  if jsonb_typeof(p_snapshot) is distinct from 'object'
    or p_snapshot - array['capturedAt','followers','reels'] <> '{}'::jsonb
    or jsonb_typeof(p_snapshot->'reels') is distinct from 'array'
    or coalesce(p_snapshot->>'capturedAt', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]{1,6})?Z$' then
    return false;
  end if;
  captured := (p_snapshot->>'capturedAt')::timestamptz;
  if jsonb_array_length(p_snapshot->'reels') > 90 or captured > now() + interval '5 minutes'
    or captured < '2000-01-01T00:00:00Z'::timestamptz then return false; end if;
  value := p_snapshot->'followers';
  if value is not null and value <> 'null'::jsonb and (
    jsonb_typeof(value) <> 'number' or value::text !~ '^[0-9]{1,12}$'
  ) then return false; end if;
  for item in select jsonb_array_elements(p_snapshot->'reels') loop
    if jsonb_typeof(item) is distinct from 'object'
      or item - array['url','publishedAt','views','likes','comments','shares','saves'] <> '{}'::jsonb
      or not private.intelligence_media_url(item->>'url')
      or coalesce(item->>'publishedAt','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]{1,6})?Z$'
      or (item->>'publishedAt')::timestamptz > captured
      or (item->>'publishedAt')::timestamptz < '2000-01-01T00:00:00Z'::timestamptz then return false; end if;
    code := split_part(item->>'url', '/', 5);
    if code = any(seen) then return false; end if;
    seen := array_append(seen, code);
    foreach metric in array array['views','likes','comments','shares','saves'] loop
      value := item->metric;
      if value is not null and value <> 'null'::jsonb and (
        jsonb_typeof(value) <> 'number' or value::text !~ '^[0-9]{1,12}$'
      ) then return false; end if;
    end loop;
  end loop;
  return true;
exception when invalid_datetime_format or datetime_field_overflow then
  return false;
end;
$$;

create function private.intelligence_sample(p_snapshot jsonb)
returns setof jsonb language sql stable set search_path = '' as $$
  with reels as (
    select item, (item->>'publishedAt')::timestamptz as published_at
    from jsonb_array_elements(p_snapshot->'reels') item
  ), sample_size as (
    select count(*) from reels where published_at >= (p_snapshot->>'capturedAt')::timestamptz - interval '720 hours'
  )
  select item from reels
  where published_at >= (p_snapshot->>'capturedAt')::timestamptz
    - case when (select * from sample_size) >= 20 then interval '720 hours' else interval '2160 hours' end
  order by published_at desc, item->>'url'
  limit 30
$$;

create function private.intelligence_report(p_snapshot jsonb, p_assessment jsonb, p_evaluated_at timestamptz)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  captured timestamptz := (p_snapshot->>'capturedAt')::timestamptz;
  followers numeric := (p_snapshot->>'followers')::numeric;
  sample jsonb;
  stats record;
  total integer;
  inspected integer;
  full_count integer;
  relative_views numeric;
  interactions numeric;
  top_share numeric;
  regularity numeric;
  frequency numeric;
  recent_change numeric;
  performance numeric;
  potential numeric := (p_assessment->>'potential')::numeric;
  safety numeric := (p_assessment->>'safety')::numeric;
  quality numeric := (p_assessment->>'quality')::numeric;
  final numeric;
  confidence text := 'low';
  decision text := 'review';
  reason text := 'insufficient_data';
  critical boolean;
  recurring boolean;
  flags jsonb;
begin
  select coalesce(jsonb_agg(item order by item->>'publishedAt' desc, item->>'url'), '[]'::jsonb)
  into sample from private.intelligence_sample(p_snapshot) item;

  with reels as (
    select (item->>'publishedAt')::timestamptz published_at,
      (item->>'views')::numeric views, (item->>'likes')::numeric likes, (item->>'comments')::numeric comments,
      (item->>'shares')::numeric shares, (item->>'saves')::numeric saves,
      case when item ? 'measuredAt' then (item->>'measuredAt')::timestamptz else captured end as measured_at
    from jsonb_array_elements(sample) item
  ), ranked as (
    select *, row_number() over(order by published_at desc, views, likes, comments) as idx, count(*) over() as n from reels
  )
  select count(*)::integer as total, count(views)::integer as measured, count(*) filter (where views > 0 and likes is not null and comments is not null)::integer as engaged,
    count(*) filter (where views is not null and measured_at >= p_evaluated_at - interval '720 hours') as fresh_measured,
    percentile_cont(.5) within group (order by views)::numeric as median_views,
    percentile_cont(.5) within group (order by likes)::numeric as median_likes,
    percentile_cont(.5) within group (order by comments)::numeric as median_comments,
    percentile_cont(.25) within group (order by views)::numeric as p25,
    percentile_cont(.5) within group (order by (likes + comments) / nullif(views, 0) * 100) as interaction_rate,
    avg(views) as mean_views, max(views) as max_views, sum(views) as sum_views, sum(shares) as shares, sum(saves) as saves,
    min(published_at) as first_at, max(published_at) as last_at,
    percentile_cont(.5) within group (order by views) filter (where idx <= n / 2) as recent_median,
    percentile_cont(.5) within group (order by views) filter (where idx > n / 2) as older_median
  into stats from ranked;
  total := stats.total;
  relative_views := stats.median_views / nullif(followers, 0) * 100;
  interactions := case when stats.engaged >= 5 then stats.interaction_rate end;
  top_share := stats.max_views / nullif(stats.sum_views, 0) * 100;
  regularity := stats.p25 / nullif(stats.median_views, 0) * 100;
  frequency := case when total >= 2 then (total - 1) * 7 / greatest(extract(epoch from stats.last_at - stats.first_at) / 86400, 1) end;
  recent_change := case when total >= 10 then (stats.recent_median / nullif(stats.older_median, 0) - 1) * 100 end;

  select count(*), count(*) filter (where x->>'coverage' = 'full') into inspected, full_count
  from jsonb_array_elements(coalesce(p_assessment->'inspected', '[]'::jsonb)) x
  where exists (select 1 from jsonb_array_elements(sample) r where r->>'url' = x->>'url');

  -- Independent capped operational benchmarks. Missing inputs never contribute zero.
  if stats.measured >= 10 and stats.measured * 2 >= total
    and relative_views is not null and interactions is not null and regularity is not null then
    performance := least(relative_views, 100) * .50 + least(interactions * 20, 100) * .25 + regularity * .25;
  end if;
  if performance is not null and potential is not null and safety is not null and quality is not null then
    final := round(performance * .35 + potential * .25 + safety * .30 + quality * .10, 1);
  end if;
  if total >= 20 and stats.fresh_measured >= 20 and stats.fresh_measured * 5 >= total * 4
    and full_count >= 20 and stats.last_at >= captured - interval '720 hours'
    and captured >= p_evaluated_at - interval '720 hours'
    and p_assessment->>'accountStatus' in ('eligible','restricted')
    and length(btrim(coalesce(p_assessment->>'accountEvidence',''))) >= 10 then
    confidence := 'high';
  elsif total >= 10 and stats.measured >= 10 and inspected >= 10 then
    confidence := 'medium';
  end if;

  with evidence as (
    select x, p.url, p.description, p.consulted_on, r->>'publishedAt' as publication_date
    from jsonb_array_elements(coalesce(p_assessment->'findings', '[]'::jsonb)) x
    join private.instagram_intelligence_policies p on p.version = '1' and p.key = x->>'policy' and p.area = x->>'area'
    join lateral (select r from jsonb_array_elements(sample) r where r->>'url' = x->>'url') media on true
    where length(btrim(coalesce(x->>'evidence',''))) >= 10
  )
  select coalesce(jsonb_agg(x || jsonb_build_object('policyUrl',url,'policyDescription',description,
    'policyConsultedOn',consulted_on,'publishedAt',publication_date) order by x->>'url', x->>'area', x->>'category'), '[]'::jsonb),
    coalesce(bool_or(x->>'severity' = 'critical' and x->'confirmed' = 'true'::jsonb), false),
    exists (select 1 from evidence repeating
      where repeating.x->>'severity' = 'high' and repeating.x->'confirmed' = 'true'::jsonb
      group by repeating.x->>'area', repeating.x->>'policy', lower(btrim(repeating.x->>'category'))
      having count(distinct repeating.x->>'url') >= 3)
  into flags, critical, recurring from evidence;

  if critical or recurring then
    decision := 'rejected';
    reason := case when critical then 'confirmed_critical' else 'confirmed_recurring' end;
  elsif p_assessment->>'accountStatus' = 'restricted' then
    reason := 'account_restricted';
  elsif p_assessment->>'community' in ('high','critical') or p_assessment->>'recommendation' in ('high','critical')
    or exists (select 1 from jsonb_array_elements(flags) x where x->>'severity' in ('high','critical')) then
    reason := 'risk_review';
  elsif p_assessment->>'accountStatus' is distinct from 'eligible' or
    length(btrim(coalesce(p_assessment->>'accountEvidence',''))) < 10 then
    reason := case when p_assessment is null then 'no_review' else 'account_unverified' end;
  elsif final is null or confidence = 'low' then
    reason := 'insufficient_data';
  elsif final < 60 then
    decision := 'rejected';
    reason := 'low_potential';
  elsif final < 80 then
    reason := 'score_review';
  elsif confidence <> 'high' or full_count < 20 then
    reason := 'limited_coverage';
  elsif p_assessment->>'community' is distinct from 'low' or p_assessment->>'recommendation' is distinct from 'low'
    or safety < 80 or exists (select 1 from jsonb_array_elements(flags) x where x->>'severity' in ('moderate','indeterminate')) then
    reason := 'safety_review';
  elsif (p_assessment->'finalReview') is distinct from 'true'::jsonb then
    reason := 'final_review';
  else
    decision := 'approved';
    reason := 'review_complete';
  end if;

  return jsonb_build_object(
    'criteriaVersion','1','policyVersion','1','evaluatedAt',p_evaluated_at,'analysisModel',case when exists (select 1 from jsonb_array_elements(p_assessment->'inspected') x where x->>'model' = 'qwen3.5:0.8b') then 'qwen3.5:0.8b' end,'capturedAt',p_snapshot->>'capturedAt',
    'periodStart',stats.first_at,'periodEnd',stats.last_at,'sample',sample,
    'coverage',jsonb_build_object('sampled',total,'measured',stats.measured,'inspected',inspected,'full',full_count),
    'metrics',jsonb_build_object('followers',followers,'medianViews',stats.median_views,'meanViews',stats.mean_views,
      'medianLikes',stats.median_likes,'medianComments',stats.median_comments,'interactionRate',interactions,
      'relativeViews',relative_views,'topViewShare',top_share,'regularity',regularity,'weeklyFrequency',frequency,
      'recentChange',recent_change,'shares',stats.shares,'saves',stats.saves),
    'notes',jsonb_build_object('performance',performance,'potential',potential,'safety',safety,'quality',quality),
    'score',final,'band',case when final >= 90 then 'excellent' when final >= 80 then 'very_good'
      when final >= 70 then 'good' when final >= 60 then 'regular' when final is not null then 'low' end,
    'confidence',confidence,'decision',decision,'reason',reason,
    'accountStatus',coalesce(p_assessment->>'accountStatus','unverified'),
    'community',coalesce(p_assessment->>'community','indeterminate'),
    'recommendation',coalesce(p_assessment->>'recommendation','indeterminate'),
    'findings',flags);
end;
$$;
create function private.intelligence_valid_review(p_snapshot jsonb, p_review jsonb)
returns boolean language plpgsql set search_path = '' as $$
declare
  field text;
  item jsonb;
  seen text[] := '{}';
  urls text[];
begin
  if jsonb_typeof(p_review) is distinct from 'object'
    or octet_length(p_review::text) > 100000
    or p_review - array['niche','subniche','microniche','formats','opportunities','subnicheReason','safetyReason',
      'qualityReason','accountStatus','accountEvidence','community','recommendation','findings','inspected',
      'potential','safety','quality','finalReview','weaknesses','audience','valueProposition','themes',
      'groupReference','groupEvidence'] <> '{}'::jsonb then return false; end if;
  foreach field in array array['niche','subniche','microniche','opportunities','subnicheReason','safetyReason','qualityReason',
    'accountEvidence','weaknesses','audience','valueProposition','groupReference','groupEvidence'] loop
    if p_review ? field and (
      jsonb_typeof(p_review->field) <> 'string' or char_length(p_review->>field) > 1500
    ) then return false; end if;
  end loop;
  if nullif(btrim(p_review->>'groupReference'), '') is not null and
    char_length(btrim(coalesce(p_review->>'groupEvidence',''))) < 10 then return false; end if;
  if not (p_review ?& array['formats','themes']) then return false; end if;
  foreach field in array array['formats','themes'] loop
    if p_review ? field then
      if jsonb_typeof(p_review->field) <> 'array' or jsonb_array_length(p_review->field) > 20
        or exists (select 1 from jsonb_array_elements(p_review->field) x
          where jsonb_typeof(x) <> 'string' or length(x #>> '{}') not between 1 and 120) then return false; end if;
    end if;
  end loop;
  foreach field in array array['potential','safety','quality'] loop
    if p_review ? field and p_review->field <> 'null'::jsonb then
      if jsonb_typeof(p_review->field) <> 'number'
        or (p_review->>field)::numeric not between 0 and 100
        or length(btrim(coalesce(p_review->>(case field when 'potential' then 'subnicheReason'
           when 'safety' then 'safetyReason' else 'qualityReason' end),''))) < 10 then return false; end if;
    end if;
  end loop;
  if p_review->>'accountStatus' is null or p_review->>'accountStatus' not in ('eligible','restricted','unverified')
    or (p_review->>'accountStatus' <> 'unverified' and length(btrim(coalesce(p_review->>'accountEvidence',''))) < 10)
    or jsonb_typeof(p_review->'finalReview') is distinct from 'boolean' then return false; end if;
  if p_review->'finalReview' = 'true'::jsonb and (
    nullif(btrim(p_review->>'niche'), '') is null or nullif(btrim(p_review->>'subniche'), '') is null
    or nullif(btrim(p_review->>'microniche'), '') is null
  ) then return false; end if;
  foreach field in array array['community','recommendation'] loop
    if coalesce(p_review->>field,'') not in ('low','moderate','high','critical','indeterminate') then return false; end if;
  end loop;
  if jsonb_typeof(p_review->'inspected') is distinct from 'array'
    or jsonb_typeof(p_review->'findings') is distinct from 'array' then return false; end if;
  if jsonb_array_length(p_review->'inspected') > 30 or jsonb_array_length(p_review->'findings') > 60 then return false; end if;
  select coalesce(array_agg(x->>'url'), '{}') into urls from private.intelligence_sample(p_snapshot) x;
  for item in select jsonb_array_elements(p_review->'inspected') loop
    if jsonb_typeof(item) is distinct from 'object'
      or item - array['url','coverage','note','format','theme','hook','editing','overlay','caption','audio','cta','model','modelNotes','frameTimes'] <> '{}'::jsonb
      or not coalesce((item->>'url') = any(urls), false) or (item->>'url') = any(seen)
      or coalesce(item->>'coverage','') not in ('full','frames','metadata','thumbnail')
      or length(btrim(coalesce(item->>'note',''))) not between 5 and 1000 then return false; end if;
    if exists (select 1 from jsonb_each(item - 'frameTimes') x where jsonb_typeof(x.value) <> 'string'
      or length(x.value #>> '{}') > 1000) then return false; end if;
    if item ? 'model' or item ? 'modelNotes' or item ? 'frameTimes' then
      if item->>'model' is distinct from 'qwen3.5:0.8b'
        or length(btrim(coalesce(item->>'modelNotes',''))) not between 3 and 1000
        or jsonb_typeof(item->'frameTimes') is distinct from 'array' then return false; end if;
      if jsonb_array_length(item->'frameTimes') not between 1 and 6 or exists (
        select 1 from jsonb_array_elements(item->'frameTimes') x
        where jsonb_typeof(x) <> 'number' or (x #>> '{}') !~ '^[0-9]{1,5}([.][0-9]{1,3})?$'
      ) then return false; end if;
    end if;
    seen := array_append(seen, item->>'url');
  end loop;
  for item in select jsonb_array_elements(p_review->'findings') loop
    if jsonb_typeof(item) is distinct from 'object'
      or item - array['url','area','severity','confirmed','policy','evidence','confidence','category','reason','action','second'] <> '{}'::jsonb
      or not coalesce((item->>'url') = any(seen), false)
      or coalesce(item->>'severity','') not in ('low','moderate','high','critical','indeterminate')
      or coalesce(item->>'confidence','') not in ('low','medium','high')
      or jsonb_typeof(item->'confirmed') is distinct from 'boolean'
      or (item->'confirmed' = 'true'::jsonb and item->>'confidence' <> 'high')
      or not exists (select 1 from private.instagram_intelligence_policies p
        where p.version = '1' and p.key = item->>'policy' and p.area = item->>'area') then return false; end if;
    foreach field in array array['evidence','category','reason','action'] loop
      if jsonb_typeof(item->field) is distinct from 'string'
        or length(btrim(item->>field)) not between (case when field = 'evidence' then 10 else 5 end) and 1500 then return false; end if;
    end loop;
    if item ? 'second' and item->'second' <> 'null'::jsonb and (
      jsonb_typeof(item->'second') <> 'number' or item->>'second' !~ '^[0-9]{1,5}([.][0-9]{1,3})?$'
    ) then return false; end if;
  end loop;
  return true;
end;
$$;

create function public.list_instagram_intelligence_sources()
returns table (id uuid, name text) language sql stable security definer set search_path = '' as $$
  select w.id, w.name from public.workspaces w
  where auth.uid() is not null and (auth.jwt()->>'is_anonymous') = 'false' and w.owner_id = auth.uid()
    and exists (select 1 from public.instagram_accounts a where a.workspace_id = w.id and a.connection_status = 'connected')
  order by w.name, w.id
$$;

create function public.enqueue_instagram_intelligence_connected(p_batch uuid, p_workspace uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  owner uuid := private.intelligence_batch_owner(p_batch);
  inserted integer;
begin
  if not exists (select 1 from public.workspaces w where w.id = p_workspace and w.owner_id = owner) then
    raise exception using errcode = '42501', message = 'Acesso ao espaço necessário.';
  end if;
  perform 1 from public.instagram_intelligence_batches b where b.id = p_batch for update;
  insert into public.instagram_intelligence_jobs(batch_id, username, source, source_label, workspace_id)
  select p_batch, profile.username, 'connected_analytics', 'Analytics do Instagram conectado', p_workspace
  from public.instagram_intelligence_profiles profile
  where profile.batch_id = p_batch
    and exists (select 1 from public.instagram_accounts a where a.workspace_id = p_workspace
      and lower(a.username) = profile.username and a.connection_status = 'connected')
    and not exists (select 1 from public.instagram_intelligence_jobs j
      where j.batch_id = p_batch and j.username = profile.username and j.source = 'connected_analytics'
      and j.workspace_id = p_workspace and j.state = 'done' and j.completed_at > now() - interval '5 minutes')
  on conflict (batch_id, username) where state = 'queued' do nothing;
  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

create function public.enqueue_instagram_intelligence_import(p_batch uuid, p_label text, p_items jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  owner uuid := private.intelligence_batch_owner(p_batch);
  item jsonb;
  seen text[] := '{}';
  input_username text;
  inserted integer;
begin
  if p_label is null or char_length(btrim(p_label)) not between 1 and 120 or p_label ~ '[[:cntrl:]]'
    or jsonb_typeof(p_items) is distinct from 'array' or octet_length(p_items::text) > 4000000 then
    raise exception using errcode = '22023', message = 'Importação inválida.';
  end if;
  if jsonb_array_length(p_items) not between 1 and 1000 then
    raise exception using errcode = '22023', message = 'A importação deve conter de 1 a 1.000 perfis.';
  end if;
  perform 1 from public.instagram_intelligence_batches b where b.id = p_batch for update;
  for item in select jsonb_array_elements(p_items) loop
    input_username := item->>'username';
    if jsonb_typeof(item) is distinct from 'object' or item - array['username','snapshot'] <> '{}'::jsonb
      or input_username is null or input_username = any(seen)
      or not exists (select 1 from public.instagram_intelligence_profiles p
        where p.batch_id = p_batch and p.username = item->>'username')
      or not private.intelligence_valid_metrics(item->'snapshot') then
      raise exception using errcode = '22023', message = 'Há um perfil fora do lote, duplicado ou com dados inválidos.';
    end if;
    seen := array_append(seen, input_username);
  end loop;
  insert into public.instagram_intelligence_jobs(batch_id, username, source, source_label, snapshot, import_key)
  select p_batch, x->>'username', 'owner_import', btrim(p_label), x->'snapshot',
    encode(sha256(convert_to((x->'snapshot')::text, 'UTF8')), 'hex')
  from jsonb_array_elements(p_items) x
  on conflict do nothing;
  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

create function private.intelligence_connected_snapshot(p_account uuid, p_at timestamptz)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'capturedAt', to_char(p_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'followers', (select followers from private.instagram_analytics_sync where account_id = p_account),
    'reels', coalesce((select jsonb_agg(jsonb_build_object(
      'url', m.permalink, 'publishedAt', to_char(m.published_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'views', m.views, 'likes', m.likes, 'comments', m.comments,
      'measuredAt', m.measured_at
    ) order by m.published_at desc, m.media_id) from (
      select * from private.instagram_analytics_media media
      where account_id = p_account and kind = 'reel' and published_at <= p_at
        and published_at >= p_at - interval '2160 hours' and private.intelligence_media_url(permalink)
      order by published_at desc, media_id limit 30
    ) m), '[]'::jsonb)
  )
$$;

create function private.process_instagram_intelligence_jobs(p_limit integer default 25)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  job public.instagram_intelligence_jobs%rowtype;
  payload jsonb;
  account_ids uuid[];
  owner uuid;
  processed integer := 0;
begin
  for job in select j.* from public.instagram_intelligence_jobs j
    where j.state = 'queued' and j.due_at <= now()
    order by j.due_at, j.id limit greatest(1, least(coalesce(p_limit, 25), 50)) for update skip locked
  loop
    processed := processed + 1;
    begin
      payload := job.snapshot;
      if job.source = 'connected_analytics' then
        select b.owner_id into owner from public.instagram_intelligence_batches b where b.id = job.batch_id;
        if not exists (select 1 from public.workspaces w where w.id = job.workspace_id and w.owner_id = owner) then
          update public.instagram_intelligence_jobs set state = 'failed', completed_at = now(),
            failure = 'workspace_revoked' where id = job.id;
          continue;
        end if;
        select array_agg(a.id) into account_ids from public.instagram_accounts a where a.workspace_id = job.workspace_id
          and lower(a.username) = job.username and a.connection_status = 'connected';
        if coalesce(cardinality(account_ids), 0) <> 1 then
          update public.instagram_intelligence_jobs set state = 'failed', completed_at = now(),
            failure = case when cardinality(account_ids) > 1 then 'ambiguous_account' else 'workspace_revoked' end where id = job.id;
          continue;
        end if;
        payload := private.intelligence_connected_snapshot(account_ids[1], now());
      end if;
      update public.instagram_intelligence_jobs set state = 'done', snapshot = payload,
        report = private.intelligence_report(payload, null, now()), completed_at = now(), attempts = job.attempts + 1, failure = null
      where id = job.id;
    exception when others then
      update public.instagram_intelligence_jobs set attempts = job.attempts + 1,
        state = case when job.attempts >= 2 then 'failed' else 'queued' end,
        failure = 'processing_failed',
        completed_at = case when job.attempts >= 2 then now() end,
        due_at = now() + make_interval(mins => 1 << job.attempts)
      where id = job.id;
    end;
  end loop;
  return processed;
end;
$$;

create function public.save_instagram_intelligence_review(p_job uuid, p_assessment jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  job public.instagram_intelligence_jobs%rowtype;
  owner uuid;
  result jsonb;
begin
  select * into job from public.instagram_intelligence_jobs where id = p_job and state = 'done' for update;
  owner := private.intelligence_batch_owner(job.batch_id);
  if job.source = 'connected_analytics' and not exists (
    select 1 from public.workspaces w where w.id = job.workspace_id and w.owner_id = owner
  ) then raise exception using errcode = '42501', message = 'Acesso à fonte revogado.'; end if;
  if not private.intelligence_valid_review(job.snapshot, p_assessment) then
    raise exception using errcode = '22023', message = 'Revise os campos, as notas e as evidências.';
  end if;
  result := private.intelligence_report(job.snapshot, p_assessment, now());
  insert into public.instagram_intelligence_reviews(job_id, reviewer, assessment, report)
  values (p_job, owner, p_assessment, result);
  return result;
end;
$$;

create function public.list_instagram_intelligence_results(p_batch uuid)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb;
begin
  if not exists (select 1 from public.instagram_intelligence_batches where id = p_batch) then
    raise exception using errcode = '42501', message = 'Lote inacessível.';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'username', p.username, 'position', p.position, 'jobId', finished.id,
    'state', coalesce(j.state,'awaiting_source'), 'failure', j.failure,
    'source', finished.source, 'sourceLabel', finished.source_label, 'completedAt', finished.completed_at,
    'score', r.result->'score', 'confidence', r.result->'confidence',
    'notes', r.result->'notes', 'medianViews', r.result->'metrics'->'medianViews',
    'decision', coalesce(r.result->>'decision','review'), 'reason', r.result->>'reason',
    'community', r.result->'community', 'recommendation', r.result->'recommendation',
    'niche', rev.assessment->'niche', 'subniche', rev.assessment->'subniche',
    'groupReference', rev.assessment->'groupReference'
  ) order by p.position), '[]'::jsonb) into result
  from public.instagram_intelligence_profiles p
  left join lateral (select * from public.instagram_intelligence_jobs j
    where j.batch_id = p.batch_id and j.username = p.username
    order by j.created_at desc, j.id desc limit 1) j on true
  left join lateral (select * from public.instagram_intelligence_jobs finished
    where finished.batch_id = p.batch_id and finished.username = p.username and finished.state = 'done'
    order by finished.created_at desc, finished.id desc limit 1) finished on true
  left join lateral (select * from public.instagram_intelligence_reviews rev
    where rev.job_id = finished.id order by rev.id desc limit 1) rev on true
  cross join lateral (select coalesce(rev.report,finished.report) as result) r
  where p.batch_id = p_batch;
  return result;
end;
$$;

create function public.get_instagram_intelligence_report(p_job uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'id', j.id, 'username', j.username, 'source', j.source, 'sourceLabel', j.source_label, 'completedAt', j.completed_at,
    'assessment', r.assessment, 'reviewedAt', r.created_at,
    'report', coalesce(r.report,j.report),
    'pastReports', (select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'date',p.completed_at,'sourceLabel',p.source_label)
      order by p.completed_at desc, p.id desc), '[]'::jsonb) from (
        select p.id,p.completed_at,p.source_label from public.instagram_intelligence_jobs p
        where p.batch_id = j.batch_id and p.username = j.username and p.state = 'done' and p.id <> j.id
        order by p.completed_at desc,p.id desc limit 25
      ) p),
    'history', (select coalesce(jsonb_agg(jsonb_build_object('id',h.id,'date',h.created_at,'decision',h.report->>'decision',
      'reason',h.report->>'reason','score',h.report->'score') order by h.id desc), '[]'::jsonb)
      from (select * from public.instagram_intelligence_reviews where job_id = j.id order by id desc limit 50) h)
  )
  from public.instagram_intelligence_jobs j
  left join lateral (select * from public.instagram_intelligence_reviews where job_id = j.id order by id desc limit 1) r on true
  where j.id = p_job and j.state = 'done'
$$;

revoke all on function private.intelligence_batch_owner(uuid), private.intelligence_media_url(text),
  private.intelligence_valid_metrics(jsonb), private.intelligence_sample(jsonb), private.intelligence_report(jsonb,jsonb,timestamptz),
  private.intelligence_valid_review(jsonb,jsonb), private.intelligence_connected_snapshot(uuid,timestamptz),
  private.process_instagram_intelligence_jobs(integer) from public, anon, authenticated;
revoke all on function public.list_instagram_intelligence_sources(), public.enqueue_instagram_intelligence_connected(uuid,uuid),
  public.enqueue_instagram_intelligence_import(uuid,text,jsonb), public.save_instagram_intelligence_review(uuid,jsonb),
  public.list_instagram_intelligence_results(uuid), public.get_instagram_intelligence_report(uuid) from public, anon, authenticated;
grant execute on function public.list_instagram_intelligence_sources(), public.enqueue_instagram_intelligence_connected(uuid,uuid),
  public.enqueue_instagram_intelligence_import(uuid,text,jsonb), public.save_instagram_intelligence_review(uuid,jsonb),
  public.list_instagram_intelligence_results(uuid), public.get_instagram_intelligence_report(uuid) to authenticated;

-- Existing Lovable Cloud environments with pg_cron use the database worker.
-- Local integration tests without pg_cron invoke the same function explicitly.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('00duhot-instagram-intelligence', '* * * * *',
      'select private.process_instagram_intelligence_jobs(25)');
  end if;
end;
$$;

commit;
