-- New Supabase projects may disable automatic table grants. BYPASSRLS does
-- not grant SQL privileges: explicitly allow server DML on our owned tables.
-- No privileges are granted on unrelated tables or tables created in future.
-- UUID keys require no sequence grants. Browser grants and RLS are unchanged.
grant usage on schema public to service_role;
grant select, insert, update, delete on table
  public.businesses,
  public.workspace_states,
  public.audit_logs,
  public.invoice_metadata,
  public.webhook_events,
  public.financial_snapshots,
  public.creator_preferences,
  public.receipts,
  public.clients,
  public.projects,
  public.project_templates,
  public.project_members,
  public.allocation_rules,
  public.allocation_buckets,
  public.allocation_entries,
  public.transaction_metadata,
  public.expense_categories,
  public.collaborators,
  public.project_collaborators,
  public.contractor_commitments,
  public.notifications,
  public.subscriptions,
  public.feature_flags,
  public.rate_limits,
  public.collaborator_payout_destinations,
  public.payout_operations,
  public.cardholder_bindings,
  public.card_issuance_requests
to service_role;

revoke truncate, references, trigger on public.cardholder_bindings, public.card_issuance_requests from service_role;

-- Read-only operational inspection; never returns customer rows or credential material.
-- This RPC is only callable by the server credential. STABLE prohibits SQL writes.
create or replace function public.inspect_financial_setup() returns jsonb
language sql stable security definer set search_path = '' as $$
with expected_tables(name) as (
  select unnest(array['businesses','workspace_states','audit_logs','invoice_metadata',
    'webhook_events','financial_snapshots','creator_preferences','receipts','clients',
    'projects','project_templates','project_members','allocation_rules','allocation_buckets',
    'allocation_entries','transaction_metadata','expense_categories','collaborators',
    'project_collaborators','contractor_commitments','notifications','subscriptions',
    'feature_flags','rate_limits','collaborator_payout_destinations','payout_operations',
    'cardholder_bindings','card_issuance_requests'])
), table_checks as (
  select e.name,c.oid,c.relrowsecurity,
    case when c.oid is null then false else
      not pg_catalog.has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      and not pg_catalog.has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') end as restricted
  from expected_tables e left join pg_catalog.pg_namespace n on n.nspname='public'
  left join pg_catalog.pg_class c on c.relnamespace=n.oid and c.relname=e.name and c.relkind='r'
), expected_functions(signature) as (
  select unnest(array['public.create_workspace(uuid,text,jsonb)',
    'public.commit_workspace(uuid,uuid,integer,jsonb,text)',
    'public.check_rate_limit(uuid)',
    'public.prepare_payout(uuid,uuid,text,bigint,text)',
    'public.inspect_financial_setup()'])
), function_checks as (
  select pg_catalog.to_regprocedure(signature) as oid from expected_functions
)
select pg_catalog.jsonb_build_object('contract_version',1,'checks',pg_catalog.jsonb_build_object(
 'required_tables', (select bool_and(oid is not null) from table_checks),
 'service_table_privileges', (select bool_and(case when oid is null then false else
   pg_catalog.has_table_privilege('service_role',oid,'SELECT') and
   pg_catalog.has_table_privilege('service_role',oid,'INSERT') and
   pg_catalog.has_table_privilege('service_role',oid,'UPDATE') and
   pg_catalog.has_table_privilege('service_role',oid,'DELETE') end) from table_checks),
 'table_rls_enabled', (select bool_and(coalesce(relrowsecurity,false)) from table_checks),
 'browser_writes_denied', (select bool_and(restricted) from table_checks),
 'privileged_functions_restricted', (select bool_and(case when oid is null then false else
   not pg_catalog.has_function_privilege('anon',oid,'EXECUTE') and
   not pg_catalog.has_function_privilege('authenticated',oid,'EXECUTE') and
   pg_catalog.has_function_privilege('service_role',oid,'EXECUTE') end) from function_checks),
 'private_receipt_bucket', exists(select 1 from storage.buckets where id='receipts'
   and public=false and file_size_limit=5242880
   and allowed_mime_types @> array['image/jpeg','image/png','application/pdf']
   and allowed_mime_types <@ array['image/jpeg','image/png','application/pdf']),
 'receipt_read_policy', exists(select 1 from pg_catalog.pg_policies where schemaname='storage'
   and tablename='objects' and policyname='receipt_read' and cmd='SELECT'),
 'tenant_read_policies', (select count(*)=25 from pg_catalog.pg_policies p
   join expected_tables e on e.name=p.tablename
   where p.schemaname='public' and p.policyname='tenant_read' and p.cmd='SELECT')
));
$$;
revoke all on function public.inspect_financial_setup() from public,anon,authenticated;
grant execute on function public.inspect_financial_setup() to service_role;
