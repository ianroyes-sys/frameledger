# Follow-up security and financial correctness review

Reviewed 2026-09-28. This is a local code/database/test review, not a penetration-test certification or a live provider acceptance result. No real financial request, payout, invoice delivery, identity collection, or credential provisioning was performed.

## Critical issues

No new critical exploit was demonstrated by this review. This does not establish production readiness.

## High issues

The production launch still requires authenticated Whop sandbox/provider acceptance and hosted Supabase checks. The account ownership bindings, pinned response version, signed deliveries, fees and settlement transitions have not been externally confirmed in this environment.

Dispute/Resolution Center losses and a collected payment later losing `paid` status require verified financial-activity reconciliation. The code now fails the sync for these cases instead of marking unmodeled accounting fresh. It does not invent a reversal amount or automatically move money. A complete ledger-based loss workflow and operator procedure are launch requirements.

## Medium issues fixed

- Reconciliation previously parsed paid-only money fields before checking payment status. Whop's installed official SDK allows `total: null` on uncollected payments. Pending/unpaid nullable totals now leave revenue unchanged without breaking an otherwise valid balance refresh.
- Canonical payment responses were not explicitly bound to their requested payment ID and connected account. Both fields are now checked. Retrieved invoices are also checked against their stored external ID and issuing company.
- Negative or excessive cumulative refunds and inconsistent net amounts could corrupt fee/profit calculations or be silently ignored. Paid gross, net and refund invariants are now validated before applying changes.
- A transfer response with another ID but identical source/destination/amount could be accepted. Existing operations now require the exact stored provider transfer ID.
- Late project costs, new invoice/commitment obligations, refunds and corrected provider fees could change completed project finances without reopening review. These changes now reopen affected projects. Moving an expense reopens both affected completed projects; category/receipt changes alone do not.
- Canonical unpaid `void` invoices now stop counting as receivables, and `past_due` invoices recover from a locally stale draft state. No manual-paid invoice is treated as cash without a canonical payment.

## Low issues / operational limits

Unknown-outcome invoice sends deliberately remain locked until an operator verifies Whop's resource, because legacy invoice idempotency coverage is not established. This behavior was preserved; recovery instructions are in `docs/whop-capabilities.md`.

A payout whose unknown-outcome retry window expired blocks automatic submission and requires operator verification. Never delete the operation to force a retry. Failed payouts retain their original identity.

The scheduled worker processes bounded business lists but performs sequential provider requests. Provider acceptance must include realistic invoice volumes, hosting duration limits, retry/backoff behavior, alerting and failure isolation before multi-tenant launch.

The review also inspected authorization, confirmed payout preparation/locking, receipt ownership, card ownership checks, access-token scope restrictions, RLS/service-role boundaries and webhook-signature verification. These are implemented controls; hosted permissions and actual provider behavior remain unverified.

## Tests added

`tests/payment-reconciliation.test.ts`: pending/null amounts; canonical fee allocation; duplicate paid/refund sync; partial/full and first-observed full refund; decreasing refund snapshots; cross-account/wrong-ID responses; invalid monetary boundaries; inconsistent persisted event history; late fee correction; changed collected status; lost dispute/resolution cases.

`tests/project-closeout.test.ts`: late cost/invoice/commitment reopening; refund idempotency; source and destination reopening on reassignment; no reopening for receipt/category-only or unchanged project assignment.

`tests/integration-transfers.test.ts`: wrong canonical transfer ID regression added to existing source/destination/amount checks.

## Commands run

- Focused domain/payment/transfer tests: passed.
- `npm run test`: 84 tests passed across 11 files at review completion. Other agents may subsequently add tests.
- `npm run typecheck`: passed.
- Prettier applied to changed domain, server and test files.

The parent agent owns final browser verification, production build and aggregate handoff.

## Recommended fix / verification order

1. Validate pinned provider contracts using approved sandbox fixtures and signed deliveries, including pending/paid/refunded/failed/out-of-order states.
2. Complete ledger-backed dispute/reversal and expense settlement matching before presenting fully reconciled profit for live accounts.
3. Exercise unknown-outcome invoice and payout recovery with an operator and record auditable procedures.
4. Validate hosted RLS/storage policies, rate limits, backups and restoration.
5. Load-test the reconciliation scheduler with monitoring and operational error alerts before opening a multi-user pilot.
