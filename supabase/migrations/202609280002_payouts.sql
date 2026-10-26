-- Recipient binding is an administrator-verified operation, never a browser-supplied account mapping.
create table public.collaborator_payout_destinations(id uuid primary key default gen_random_uuid(),business_id uuid not null references public.businesses(id),collaborator_id text not null,whop_account_id text not null check(whop_account_id ~ '^biz_[a-zA-Z0-9]+$'),verified_name text not null,verified_at timestamptz not null,verified_by uuid not null references auth.users(id),unique(business_id,collaborator_id));
create table public.payout_operations(id uuid primary key default gen_random_uuid(),business_id uuid not null references public.businesses(id),commitment_id text not null,origin_id text not null,destination_id text not null,amount_cents bigint not null check(amount_cents>0),operation_key text not null unique,whop_transfer_id text unique,status text not null default 'queued',created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(business_id,commitment_id));
alter table public.collaborator_payout_destinations enable row level security;
alter table public.payout_operations enable row level security;
create policy tenant_read on public.collaborator_payout_destinations for select to authenticated using(exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid()));
create policy tenant_read on public.payout_operations for select to authenticated using(exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid()));
revoke all on public.collaborator_payout_destinations,public.payout_operations from anon,authenticated;
grant select on public.collaborator_payout_destinations,public.payout_operations to authenticated;
-- Row-lock the same aggregate used by other commands so a commitment cannot change during submission.
create or replace function public.prepare_payout(p_business uuid,p_actor uuid,p_commitment text,p_amount bigint,p_destination text) returns uuid language plpgsql security definer set search_path=public as $$
declare workspace jsonb;commitment jsonb;destination text;origin_account text;new_id uuid;existing public.payout_operations%rowtype;begin
 select whop_account_id into origin_account from businesses where id=p_business and owner_id=p_actor;
 if origin_account is null then raise exception 'Verified origin required'; end if;
 select state into workspace from workspace_states where business_id=p_business for update;
 if workspace->>'currency' is distinct from 'USD' then raise exception 'USD workspace required';end if;
 select value into commitment from jsonb_array_elements(workspace->'commitments') where value->>'id'=p_commitment;
 if exists(select 1 from jsonb_array_elements(workspace->'expenses') e where e->>'commitmentId'=p_commitment) then raise exception 'Resolve expense-linked commitment before payout';end if;
 if commitment is null or commitment->>'kind' is distinct from 'contractor' then raise exception 'Contractor commitment required';end if;
 if jsonb_typeof(commitment->'amount') is distinct from 'number' or jsonb_typeof(commitment->'paid') is distinct from 'number' or coalesce(commitment->>'amount','') !~ '^[0-9]+$' or coalesce(commitment->>'paid','') !~ '^[0-9]+$' or nullif(commitment->>'collaboratorId','') is null then raise exception 'Invalid commitment amounts or collaborator';end if;
 if not exists(select 1 from jsonb_array_elements(workspace->'collaborators') c where c->>'id'=commitment->>'collaboratorId') then raise exception 'Collaborator not found';end if;
 if p_amount is null or p_destination is null then raise exception 'Confirmation required';end if;
 if (commitment->>'amount')::bigint-(commitment->>'paid')::bigint<>p_amount or p_amount<=0 then raise exception 'Commitment amount changed';end if;
 select whop_account_id into destination from collaborator_payout_destinations where business_id=p_business and collaborator_id=commitment->>'collaboratorId';
 if destination is null or destination<>p_destination or destination=origin_account then raise exception 'Verified recipient mismatch';end if;
 select * into existing from payout_operations where business_id=p_business and commitment_id=p_commitment;
 if found then
 if existing.amount_cents<>p_amount or existing.destination_id<>p_destination or existing.origin_id<>origin_account then raise exception 'Existing payout differs from confirmation';end if;
 return existing.id;end if;
 new_id:=gen_random_uuid();
 insert into payout_operations(id,business_id,commitment_id,origin_id,destination_id,amount_cents,operation_key) values(new_id,p_business,p_commitment,origin_account,destination,p_amount,'payout-'||new_id::text);
 insert into audit_logs(business_id,actor_id,action,resource_id) values(p_business,p_actor,'PAYOUT_CONFIRMED',new_id::text);
 return new_id;
end $$;
revoke all on function public.prepare_payout(uuid,uuid,text,bigint,text) from public,anon,authenticated;
grant execute on function public.prepare_payout(uuid,uuid,text,bigint,text) to service_role;
create or replace function public.commit_workspace(p_business_id uuid,p_actor uuid,p_expected_revision integer,p_state jsonb,p_action text) returns integer language plpgsql security definer set search_path=public as $$
declare current_revision integer;old_state jsonb;op record;old_c jsonb;new_c jsonb;begin
 if not exists(select 1 from businesses where id=p_business_id and owner_id=p_actor) then raise exception 'Forbidden';end if;
 select revision,state into current_revision,old_state from workspace_states where business_id=p_business_id for update;
 if current_revision is distinct from p_expected_revision then raise exception 'Revision conflict' using errcode='40001';end if;
 if p_action<>'WHOP_RECONCILE' then
 for op in select commitment_id from payout_operations where business_id=p_business_id loop
 select value into old_c from jsonb_array_elements(old_state->'commitments') where value->>'id'=op.commitment_id;
 select value into new_c from jsonb_array_elements(p_state->'commitments') where value->>'id'=op.commitment_id;
 if old_c is distinct from new_c then raise exception 'Payout commitment locked';end if;
 if exists(select 1 from jsonb_array_elements(p_state->'expenses') e where e->>'commitmentId'=op.commitment_id) then raise exception 'Payout cannot also be recorded as expense';end if;
 end loop;end if;
 update workspace_states set state=p_state,revision=revision+1,updated_at=now() where business_id=p_business_id;
 insert into audit_logs(business_id,actor_id,action) values(p_business_id,p_actor,p_action);
 return current_revision+1;
end $$;
revoke all on function public.commit_workspace(uuid,uuid,integer,jsonb,text) from public,anon,authenticated;
grant execute on function public.commit_workspace(uuid,uuid,integer,jsonb,text) to service_role;
