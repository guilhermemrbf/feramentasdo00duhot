-- Adjust the operational cutoff while retaining the evidence and compliance requirements.
-- Stored reports keep their original version and are not rewritten.
create or replace function private.intelligence_report(p_snapshot jsonb, p_assessment jsonb, p_evaluated_at timestamptz)
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
  elsif final < 30 then
    decision := 'rejected';
    reason := 'below_approval_threshold';
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
    'criteriaVersion','2','approvalThreshold',30,'policyVersion','1','evaluatedAt',p_evaluated_at,'analysisModel',case when exists (select 1 from jsonb_array_elements(p_assessment->'inspected') x where x->>'model' = 'qwen3.5:0.8b') then 'qwen3.5:0.8b' end,'capturedAt',p_snapshot->>'capturedAt',
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
