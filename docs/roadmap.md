# Roadmap and release gates

2026-09-28. This is a prioritized plan, not a list of already shipped features. README and verification evidence identify what actually runs.

## V1: make one job financially understandable

Complete and test project creation, retainer/final invoices, verified payment/settlement, virtual allocation ledger, commitments, expense attribution, collaborator tracking, safe-to-spend and project closeout. Responsive overview/project/invoice/money/expense views share a deterministic domain layer and explicit demo mode. Purchase simulator explains impact without moving funds.

Gate: wedding acceptance scenario passes with pennies reconciled; duplicate/refund/reversal events work; pending cash excluded; RLS/cross-tenant rejection proven; webhook signature tests and reconciliation proven; production build and browser checks pass. Missing credentials cannot be replaced by simulated production success.

## Production pilot

1. Provision Supabase, configure authentication redirect allowlist, migrate schema and verify RLS/storage with two tenants.
2. Obtain Whop app/company approvals and credentials, confirm each capability and current fees, configure scoped tokens and webhook signatures.
3. Exercise provider-supported testing for invoice lifecycle, refunds, settlement and reconciliation. If unavailable, request an approved test arrangement rather than move money opportunistically.
4. Complete legal/account/disclosure review and name clearance; add operational monitoring, support and incident procedures.
5. Pilot with founder and a small invited creator group. Measure first meaningful payment, time-to-invoice, attribution completeness, repeat projects and trust comprehension.

## Highest-value follow-ons

- Protected retainer/cancellation buffer with explicit user control.
- Project closeout checklist: unpaid crew, missing receipts, remaining estimates, uncollected final balance and unmatched fees.
- Late-invoice scenario: shift expected receipts 14/30 days and show downside cash; no model dependence.
- Recurring subscription detection with user confirmation; vendor normalization rules and missing receipt reminders.
- External bookkeeping CSV import/export, import preview, duplicate detection and provenance.
- Optional owner-time/overhead costing to distinguish direct project margin from economic profit.
- Narrow AI explanation with fact/estimate labels, calculation citations, provider abstraction and strict per-user budget.

## Phase two

Contracts/e-signatures and W-9/1099 via approved integrations; QuickBooks/Xero sync; receipt OCR with explicit data handling; team roles/auditor access; native Expo client after official Element compatibility verification; project/vendor cards only when provider capabilities permit; scheduling/gallery links without creating a full studio suite.

Payroll, lending, insurance referrals, physical cards, international/FX, Tap to Pay, deep crypto and a marketplace require separate commercial/regulatory/product validation. Do not let these delay the core financial record.

## Research follow-up

Interview 5–8 creators, including seasonal wedding and recurring retainer businesses; observe actual invoice-to-closeout tasks; review App Store/G2/Capterra complaints with recency and sampling controls; evaluate name/domain/handle availability authoritatively. Test the $12/$29 pricing hypothesis with payment intent and retention, not praise for mockups.

## Metrics

Activation: meaningful verified business revenue received, plus a cohort reaching $500 monthly. Monitor project creation retention, paid invoice timing, categorized/project-attributed expense rate, safe-to-spend comprehension, allocation adoption, 30/90-day retention and paid conversion. Send privacy-preserving event metadata rather than client/transaction payloads. Report payment volume separately from revenue and contribution margin.
