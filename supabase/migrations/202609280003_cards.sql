-- Only operations staff can bind a verified Whop cardholder to a business.
create table public.cardholder_bindings (
 business_id uuid primary key references public.businesses(id),
 whop_account_id text not null check(whop_account_id ~ '^biz_[a-zA-Z0-9]+$'),
 whop_user_id text not null check(whop_user_id ~ '^user_[a-zA-Z0-9]+$'),
 verified_at timestamptz not null,
 verified_by uuid not null references auth.users(id)
);
create table public.card_issuance_requests (
 id uuid primary key,
 business_id uuid not null references public.businesses(id),
 actor_id uuid not null references auth.users(id),
 request_body jsonb not null,
 terms_url text not null,
 status text not null default 'unconfirmed' check(status in ('unconfirmed','confirmed')),
 result jsonb,
 created_at timestamptz not null default now()
);
alter table public.cardholder_bindings enable row level security;
alter table public.card_issuance_requests enable row level security;
revoke all on public.cardholder_bindings,public.card_issuance_requests from anon,authenticated;
grant all on public.cardholder_bindings,public.card_issuance_requests to service_role;
-- Unconfirmed operations must be investigated before another card is requested.
create unique index one_unconfirmed_card_request on public.card_issuance_requests(business_id) where status='unconfirmed';
