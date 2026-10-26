-- FrameLedger: apply with Supabase migrations; all financial amounts are USD cents.
create extension if not exists pgcrypto;
create table public.businesses(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),name text not null,whop_account_id text unique,created_at timestamptz not null default now());
create index businesses_owner on public.businesses(owner_id);
create table public.workspace_states(business_id uuid primary key references public.businesses(id) on delete cascade,state jsonb not null,revision integer not null default 0,updated_at timestamptz not null default now());
create table public.audit_logs(id uuid primary key default gen_random_uuid(),business_id uuid not null references public.businesses(id),actor_id uuid references auth.users(id),action text not null,resource_id text,created_at timestamptz not null default now());
create table public.invoice_metadata(id uuid primary key default gen_random_uuid(),business_id uuid not null references public.businesses(id),local_invoice_id text not null,whop_invoice_id text unique,operation_key text not null unique,state text not null default 'pending',unique(business_id,local_invoice_id));
create table public.webhook_events(id text primary key,business_id uuid references public.businesses(id),event_type text not null,resource_id text not null,occurred_at timestamptz not null,received_at timestamptz not null default now(),processed_at timestamptz,attempts integer not null default 0,last_error text);
create table public.financial_snapshots(id uuid primary key default gen_random_uuid(),business_id uuid not null references public.businesses(id),available_cents bigint not null,currency text not null check(currency='USD'),created_at timestamptz not null default now());
create table public.creator_preferences(business_id uuid primary key references public.businesses(id),business_type text,preferences jsonb not null default '{}');
create table public.receipts(id uuid primary key default gen_random_uuid(),business_id uuid not null references public.businesses(id),expense_id text not null,storage_path text not null unique,created_at timestamptz not null default now());
-- Context aggregate is the V1 canonical representation, serialized by a pure domain reducer.
-- Relational extension tables provide stable tenant keys for later reporting/integrations.
do $$ declare table_name text; begin
 foreach table_name in array array['clients','projects','project_templates','project_members','allocation_rules','allocation_buckets','allocation_entries','transaction_metadata','expense_categories','collaborators','project_collaborators','contractor_commitments','notifications','subscriptions','feature_flags'] loop
 execute format('create table public.%I(id uuid primary key default gen_random_uuid(),business_id uuid not null references public.businesses(id) on delete cascade,external_id text,context jsonb not null default ''{}'',created_at timestamptz not null default now(),unique(business_id,external_id))',table_name);
 end loop;
end $$;
do $$ declare t record; begin
 for t in select tablename from pg_tables where schemaname='public' and tablename in ('businesses','workspace_states','audit_logs','invoice_metadata','webhook_events','financial_snapshots','creator_preferences','receipts','clients','projects','project_templates','project_members','allocation_rules','allocation_buckets','allocation_entries','transaction_metadata','expense_categories','collaborators','project_collaborators','contractor_commitments','notifications','subscriptions','feature_flags') loop
 execute format('alter table public.%I enable row level security',t.tablename);
 if t.tablename='businesses' then
 execute 'create policy tenant_read on public.businesses for select to authenticated using(owner_id=auth.uid())';
 else
 execute format('create policy tenant_read on public.%I for select to authenticated using(exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid()))',t.tablename);
 end if;
 -- Mutations require authenticated server commands. Direct anon/authenticated writes are denied.
 execute format('revoke all on public.%I from anon, authenticated',t.tablename);
 execute format('grant select on public.%I to authenticated',t.tablename);
 end loop;
end $$;
create or replace function public.commit_workspace(p_business_id uuid,p_actor uuid,p_expected_revision integer,p_state jsonb,p_action text) returns integer language plpgsql security definer set search_path=public as $$
declare current_revision integer; begin
 if not exists(select 1 from businesses where id=p_business_id and owner_id=p_actor) then raise exception 'Forbidden'; end if;
 select revision into current_revision from workspace_states where business_id=p_business_id for update;
 if current_revision is distinct from p_expected_revision then raise exception 'Revision conflict' using errcode='40001'; end if;
 update workspace_states set state=p_state,revision=revision+1,updated_at=now() where business_id=p_business_id;
 insert into audit_logs(business_id,actor_id,action) values(p_business_id,p_actor,p_action);
 return current_revision+1;
end $$;
revoke all on function public.commit_workspace(uuid,uuid,integer,jsonb,text) from public,anon,authenticated;
grant execute on function public.commit_workspace(uuid,uuid,integer,jsonb,text) to service_role;
-- Private receipt storage. Path starts with business UUID. No raw identity documents accepted.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('receipts','receipts',false,5242880,array['image/jpeg','image/png','application/pdf']) on conflict(id) do nothing;
create policy receipt_read on storage.objects for select to authenticated using(bucket_id='receipts' and exists(select 1 from public.businesses b where b.id::text=(storage.foldername(storage.objects.name))[1] and b.owner_id=auth.uid()));
create table public.rate_limits(actor_id uuid not null,bucket bigint not null,hits integer not null default 1,primary key(actor_id,bucket));
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon,authenticated;
create or replace function public.check_rate_limit(p_actor uuid) returns boolean language plpgsql security definer set search_path=public as $$
declare count_now integer;bucket_now bigint:=floor(extract(epoch from now())/60);begin
 insert into rate_limits(actor_id,bucket,hits) values(p_actor,bucket_now,1) on conflict(actor_id,bucket) do update set hits=rate_limits.hits+1 returning hits into count_now;
 delete from rate_limits where bucket<bucket_now-10;
 return count_now<=120;
end $$;
revoke all on function public.check_rate_limit(uuid) from public,anon,authenticated;
grant execute on function public.check_rate_limit(uuid) to service_role;
alter table public.businesses add column reconciled_at timestamptz;
create or replace function public.create_workspace(p_actor uuid,p_name text,p_state jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare new_id uuid;begin
 insert into businesses(owner_id,name) values(p_actor,p_name) returning id into new_id;
 insert into workspace_states(business_id,state) values(new_id,p_state);
 insert into audit_logs(business_id,actor_id,action) values(new_id,p_actor,'WORKSPACE_CREATED');
 return new_id;
end $$;
revoke all on function public.create_workspace(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.create_workspace(uuid,text,jsonb) to service_role;
