# Trust, security and compliance notes

Research snapshot 2026-09-28. Product guardrails and launch questions, not a legal opinion. Legal/compliance review remains required before live launch.

## Language and account model

FrameLedger is a working-name business financial platform. Do not describe the company as a chartered bank, an FDIC-insured institution, an investment service or a guarantor of funds. We have not verified insurance/pass-through eligibility for the selected Whop balance structure. Do not inherit a competitor's disclosures or infer coverage from a provider marketing page.

Project wallets and allocation buckets are internal bookkeeping envelopes, not separate accounts or legally segregated funds. Safe-to-spend is an estimate from tracked settled funds and recorded obligations; missing expenses, pending fees, reversals and stale provider data can change it. Show data freshness and calculation basis. Expected invoice receipts remain uncertain.

[Whop Seller Terms](https://whop.com/seller-terms) describe net proceeds, fees, financial partner balances and seller responsibility for disputes/refunds. [Buyer Terms](https://whop.com/buyer-terms) distinguish product support from payment support and require applicable pricing/fee visibility. Their presence does not settle FrameLedger's own licensing, merchant-of-record, agent or partner responsibilities. Obtain the applicable platform agreements and exact approved disclosures.

## Provider and financial actions

Use hosted verification and sensitive payment/card fields. Store external IDs, verification status and necessary metadata, never PAN/CVV, bank credentials, raw identity documents or tax IDs. W-9 states indicate requested, received or externally verified; they are not an invitation to upload sensitive forms here. Hosted provider verification must complete according to actual provider requirements before live operations.

Live operations require authenticated tenant authorization, capability eligibility, server input validation, explicit confirmation and audit records. An AI recommendation cannot execute a transfer, invoice send, payout or card action on its own. Expiring confirmation should bind material action details. A webhook establishes provider events; client redirects do not. Available cash is sourced from settled/available balance, not assumed from generic payment success.

## Tax and accounting boundaries

Display: 'Estimates only. Consult a qualified tax professional for tax advice.' Reserve percentage is the user's budgeting preference; do not call it their tax rate or guaranteed liability. Direct project profit excludes business overhead, owner labor and taxes unless explicitly included in the displayed basis. Sales tax is distinct from income tax reserves. Do not invent deductions, automatically classify gear as immediately deductible, or assert legal enforceability of retainers/late fees.

Quarterly dates depend on tax year, jurisdiction and circumstances. No production reminder date should ship until its specific year and applicability are verified from an authoritative tax source. Maintain configurable reminders and source URL/version rather than hardcoded evergreen dates.

## Security acceptance gates

- Server-only Whop secrets and appropriately scoped short-lived Element access tokens.
- Supabase tenant RLS, membership checks, tenant-safe relationships and private receipt storage.
- Signature verification before event persistence/processing; unique provider event IDs, transactional/idempotent application and out-of-order protection.
- Reconciliation against provider state, visible sync age, retry/dead-letter handling and alerts.
- Durable idempotency and supported provider idempotency for money operations; no guessed header guarantees.
- Secure cookies, origin/CSRF checks where cookie authentication is used, rate limits, strict input validation and appropriate security headers.
- Redacted errors/logs, secret/dependency scans, file-type/size validation, retention/deletion policy and restore drill.
- Audit actor, tenant, action, object and timestamp without unnecessarily recording sensitive contents.

These are gates, not a claim they have all been audited. Automated tests do not replace penetration testing, provider certification or operational readiness.

## Demo and release boundaries

Demo data and provider adapters remain explicitly separate. Display synthetic mode on both creator and client views. Demo callbacks cannot mutate production finance tables; real webhook endpoints cannot ingest demo payments as real receipts. No real money was authorized for testing. A deployed demo is not a live financial product.

Before launch: establish business/legal entity and working-name clearance, approved regions/use cases, commercial/provider terms, privacy policy/retention and incident response, customer support and dispute escalation, a documented production security review, and a small controlled pilot with verified statements. Do not publish unsupported compliance badges.
