create function public.sales_tracking_report(p_days integer, p_breakdown text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_days is null or p_days not in (7, 14, 30)
     or p_breakdown is null or p_breakdown not in ('campaign', 'ad') then
    raise exception 'Invalid report filters' using errcode = '22023';
  end if;

  return (
    with allowed as (
      select auth.uid() as user_id where public.platform_is_approved()
    ), bounds as (
      select (now() at time zone 'America/Sao_Paulo')::date as today
    ), sales as (
      select (e.occurred_at at time zone 'America/Sao_Paulo')::date as day,
        e.amount_cents, c.token_hash, c.utm_source, c.utm_medium, c.utm_campaign,
        c.campaign_id, case when p_breakdown = 'ad' then c.ad_id end as ad_id,
        coalesce(r.amount_cents, 0) as reversed_cents
      from allowed a
      join public.sales_events e on e.user_id = a.user_id
      cross join bounds b
      left join public.sales_tracking_orders o on o.link_id = e.link_id and o.external_id = e.external_id
      left join public.sales_tracking_clicks c on c.token_hash = o.token_hash and c.source_id = o.source_id
        and c.created_at between e.occurred_at - interval '168 hours' and e.occurred_at
      left join public.sales_events r on r.user_id = e.user_id and r.provider = e.provider
        and r.external_id = e.external_id and r.kind = 'reversed'
      where e.kind = 'approved'
        and e.occurred_at >= ((b.today - (p_days - 1))::timestamp at time zone 'America/Sao_Paulo')
        and e.occurred_at < ((b.today + 1)::timestamp at time zone 'America/Sao_Paulo')
    ), totals as (
      select count(*) as approved, count(token_hash) as attributed,
        coalesce(sum(amount_cents), 0) as gross_cents,
        coalesce(sum(amount_cents) filter (where token_hash is not null), 0) as gross_attributed_cents,
        coalesce(sum(reversed_cents) filter (where token_hash is not null), 0) as reversed_attributed_cents
      from sales
    ), daily as (
      select day, coalesce(sum(amount_cents) filter (where token_hash is not null), 0) as gross_attributed_cents,
        coalesce(sum(amount_cents) filter (where token_hash is null), 0) as gross_unattributed_cents,
        count(token_hash) as attributed
      from sales group by day
    ), series as (
      select b.today - i as day, coalesce(d.gross_attributed_cents, 0) as gross_attributed_cents,
        coalesce(d.gross_unattributed_cents, 0) as gross_unattributed_cents, coalesce(d.attributed, 0) as attributed
      from bounds b cross join generate_series(0, p_days - 1) as g(i)
      left join daily d on d.day = b.today - i
    ), campaigns as (
      select utm_source as source, utm_medium as medium,
        min(utm_campaign) as campaign,
        campaign_id, ad_id, count(*) as sales, sum(amount_cents) as gross_cents, sum(reversed_cents) as reversed_cents
      from sales where token_hash is not null
      group by utm_source, utm_medium, case when campaign_id is null then utm_campaign end, campaign_id, ad_id
      order by gross_cents desc, campaign_id, ad_id, source, medium, campaign
      limit 50
    ), sources as (
      select s.id, s.origin, s.link_id, l.label, l.active as gateway_active, s.active, s.created_at,
        (select max(c.created_at) from public.sales_tracking_clicks c where c.source_id = s.id) as last_click_at
      from allowed a
      join public.sales_tracking_sources s on s.user_id = a.user_id
      join public.sales_webhook_links l on l.id = s.link_id
    )
    select to_jsonb(t) || jsonb_build_object(
      'unattributed', t.approved - t.attributed,
      'series', coalesce((select jsonb_agg(s order by s.day) from series s), '[]'::jsonb),
      'campaigns', coalesce((select jsonb_agg(c order by c.gross_cents desc, c.campaign_id, c.ad_id, c.source, c.medium, c.campaign) from campaigns c), '[]'::jsonb),
      'sources', coalesce((select jsonb_agg(s order by s.active desc, s.created_at desc) from sources s), '[]'::jsonb)
    ) from totals t
  );
end;
$$;

revoke all on function public.sales_tracking_report(integer,text) from public, anon;
grant execute on function public.sales_tracking_report(integer,text) to authenticated;
