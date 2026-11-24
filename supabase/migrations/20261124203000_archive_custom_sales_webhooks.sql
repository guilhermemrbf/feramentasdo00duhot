alter table public.sales_webhook_links
  add column archived_at timestamptz,
  add constraint sales_webhook_links_archived_opt_out
    check (archived_at is null or (provider = 'custom' and not active));
