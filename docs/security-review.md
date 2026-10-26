# Security and financial correctness review

Review begun 2026-09-28 during implementation. Scope: local source inspection of `src/server`, `src/app/api`, `src/domain`, Supabase migration, auth UI and provider SDK. This is an engineering review, not a penetration test or launch certification. Findings below are a point-in-time record; resolution requires tests and final source reinspection.

## Critical issues

No credential exposure or direct unauthenticated money-moving route was found in the files available at first inspection. Production financial readiness is **not verified**: webhook/invoice/reconciliation routes were still being implemented at that point and no deployed Supabase/Whop credentials were available for a two-tenant live test.

## High issues

1. **Manual expense can incorrectly raise available cash against a provider snapshot (open at initial review).** `safeToSpend` uses `actualSettledBalance` when present, while `ADD_EXPENSE` immediately consumes an expense-linked commitment. If $67 of fuel is manually entered against $120 travel while provider balance is unchanged, obligations fall $67 without cash falling: safe-to-spend increases. Require reconciled provider expense provenance, retain an unmatched-expense obligation, or disable that live operation until reconciliation is implemented. Sent to backend and parent.
2. **Production settlement, webhook and replay guarantees remain release gates.** Signature verification alone does not establish account ownership or ordering. Each incoming event must match the configured business account, reconcile against authoritative resource state, and update financial state/event status atomically. A successful payment is not necessarily available money. Pending manual/provider cash must never be presented as settled. Reinspect completed routes before release.

## Medium issues

1. **Cross-project expense reassignment retains old commitment link (open at initial review).** `ASSIGN_EXPENSE` changes `projectId` without clearing or validating `commitmentId`. Costs move but the original project's commitment remains consumed. Reject reassignment or detach old commitment explicitly; add regression test.
2. **Collaborator reference is not validated (open at initial review).** `ADD_COMMITMENT` checks project but not supplied collaborator ID. Orphan references can hide who is owed. Require an existing collaborator in the same aggregate.
3. **Overdue invoices treated as next-window expected cash (open at initial review).** `purchaseImpact` bounds only the latest due date, so already-overdue receivables enter 30/60-day projections with no revised expected date. Show overdue separately or use explicit revised expected date and uncertainty.
4. **New workspace response mismatch (reported).** Auth UI expected `payload.business.id`, while POST `/api/businesses` initially returned `businessId`. New signup could create a workspace but appear to fail. Align contract and cover end-to-end signup with credentials in staging.
5. **Rate limits, request-size limits and operational controls unverified.** These were not present in initial endpoint inspection. Add durable platform-backed rate limiting or documented infrastructure enforcement for signup/mutations/invoice creation/webhooks; cap body sizes and retry amplification. In-memory limits are only a local defense, not a distributed guarantee.

## Positive controls observed

- Whop key accessed only by server module; public client imports do not contain it.
- API auth validates bearer token through Supabase `getUser`, then checks business owner server-side. No user-supplied actor ID is trusted.
- Generic unexpected error responses avoid leaking provider payloads.
- Origin checking on writes supplements bearer auth. Bearer tokens are not ambient cookie credentials; future cookie migration needs explicit CSRF review.
- Zod rejects unsupported production command types, including demo payment/refund/reset commands. `SEND_INVOICE` in the general endpoint is rejected in favor of its dedicated confirmed route.
- Database tables enable RLS; authenticated clients receive select only. Owner-based policies and tenant filtering are present.
- `commit_workspace` locks the workspace row, checks expected revision, and inserts an audit entry in the same database transaction. Execute permission is revoked from public/anon/authenticated and granted to service role.
- Service role use makes server authorization mandatory; RLS does not protect accidental service-role queries. Context relational tables are extension placeholders, not proof of normalized foreign-key consistency.
- Receipt bucket is private with file limit and an allowlist; read policy checks owner through business-path prefix. Upload path and content validation need separate review when implemented.
- Money uses safe integer cents and BigInt allocation arithmetic; allocation sums are required to equal 10,000 basis points.
- Local demo storage is separate from live bearer requests. Production-facing mode should fail closed if configuration is absent.

## Webhook cryptographic review

Initial verifier uses HMAC SHA-256 over exact `id.timestamp.rawBody`, a five-minute timestamp tolerance, timing-safe comparison, required headers and body event-ID equality. It supports multiple space-separated v1 signatures and validates envelope shape after verification.

Installed official `@whop/sdk/dist/cjs/helpers/verifyWebhook.js` explicitly explains that Whop signs with the literal bytes of its issued secret, including prefix. The application's literal-secret HMAC matches that convention; blindly base64-decoding a `ws_` secret would be wrong. This local SDK comparison is stronger evidence than applying generic Standard Webhooks assumptions. The official SDK helper itself notes that its generic payload type is not runtime shape validation.

Still required: known official event fixtures, tamper/stale/future/missing-secret tests, timestamp replay persistence, account mapping and duplicate/out-of-order end-to-end processing. Cryptographic validity alone never grants cross-tenant mutation permission.

## Commands/evidence

Read role instructions and source files; inspected official installed SDK webhook helper. No live funds, deployments, external messages, or database writes were performed by this review. Documentation formatting completed separately. At this initial stage no security tests were added or run; the next review pass must update this record with concrete test results and resolved findings.

## Fix order

1. Prevent safe-to-spend from increasing due to unmatched expense/settlement state.
2. Verify provider account mapping, authoritative reconciliation and atomic replay processing.
3. Fix expense reassignment and collaborator reference invariants.
4. Separate overdue forecasts, fix signup response contract, complete rate/body limits.
5. Run signature/auth/tenancy/integration tests and a staging two-business RLS exercise; record actual observed results.

## Second pass: fixes and executed regression tests

The backend updated the domain after the initial findings. `tests/security.test.ts` now contains **12 passing tests**, executed with `./node_modules/.bin/vitest run tests/security.test.ts` on 2026-09-28. Coverage: exact literal-secret HMAC, tampered payload, stale/future timestamps, missing/wrong secret/headers, malformed signature, body/header ID mismatch, rotated signatures, rejected client payment/refund/payout/reset commands, rejected client settlement provenance, snapshot/manual-expense invariant, expense reassignment, missing collaborator and overdue forecast handling.

Resolved in inspected domain code and tested:

- Manual expenses now reserve cash against a provider snapshot unless internally marked settled externally. Client command parsing strips that provenance flag. This is conservative: a manually recorded expense can remain reserved after its provider debit settles, until transaction matching is implemented. The UI must disclose that this may understate safe-to-spend; it is not complete reconciliation.
- Reassigning an expense clears a commitment association that no longer belongs to the destination project.
- New contractor commitments require a known collaborator when supplied.
- Past-due invoices are excluded from next-period expected totals; they still require an overdue view/reminder workflow.

New route inspection confirms authenticated invoice/reconcile endpoints, signed webhook account-to-business mapping, persistent unique event IDs, authoritative invoice/payment retrieval, atomic revision-guarded state commit, a cron recovery endpoint and provider balance snapshots. Duplicate webhooks trigger authoritative recomputation rather than direct additive credits. This reduces double application risk but does not replace real provider fixture/integration tests.

### Additional release findings sent to backend

1. **Invoice operation recovery:** initial implementation inserted a pending send operation before provider configuration/network work and rejected every duplicate. A missing key/rejection could permanently block retry; provider success plus failed local linking could orphan an invoice. Safely resume a pending operation with the same documented idempotency key and persist errors/status. Do not create a new key on blind retry. Resolution pending final inspection.
2. **Cron fairness:** first 50 configured businesses selected without cursor/last-sync ordering can starve later businesses indefinitely. A rotating cursor, ordering by last attempt or proper job queue is required beyond a bounded pilot. Pending events are separately selected but do not guarantee full periodic repair.
3. **Cron comparison byte length:** comparing JS string lengths before `timingSafeEqual` can still throw for a same-character-length non-ASCII bearer value with a different byte length. Compare Buffer lengths inside a safe error boundary. This is availability robustness, not an auth bypass.
4. **Settlement and fees:** provider payment schema and fee/refund semantics need real official response fixtures. Current exact invoice-total check intentionally blocks partial provider payments; partial behavior must not be advertised live until supported.

No deployed tenant-isolation test, provider sandbox round-trip, penetration test, production monitoring exercise, backup restore or external security assessment has been executed. Production financial launch remains gated on that evidence and the unresolved items above.

## Final compatibility review update

**Executed:** `./node_modules/.bin/vitest run tests/database.test.ts` — **8 tests passed** on 2026-09-28. The harness runs the checked-in SQL migrations against PGlite's embedded PostgreSQL engine. It supplies minimal Supabase-compatible `auth.users`, `auth.uid()`, roles and private-storage objects/functions. Only `create extension ... pgcrypto` is omitted because the tested UUID function is built in. Schema bootstrap includes the service-role grants/bypass expected from Supabase. This is real PostgreSQL SQL/RLS/function execution, but **not validation of a hosted Supabase project's complete permissions, storage service, JWT handling, or operational configuration**.

Database tests cover atomic workspace+audit creation and rollback on invalid state, owner-only aggregate/business reads, anonymous reads denied, direct authenticated writes denied, privileged RPC execution denied, privileged actor ownership checks, optimistic revision conflict with no extra audit mutation, persisted 120-request limiter and independent actor quotas, extension-table tenant reads, and private receipt path ownership.

The first run found a real receipt policy bug: unqualified `name` inside the `businesses` subquery resolved to the business's name rather than the storage object's path. The migration now explicitly calls `storage.foldername(storage.objects.name)`. The failing owner-receipt test passed after the fix; all eight pass. Existing deployed databases would require an explicit policy-replacement migration rather than merely editing the initial migration.

Earlier findings now resolved in final inspected source:

- Provider construction precedes creation of the durable invoice send lock, so missing configuration no longer poisons the operation.
- **Unknown invoice-send outcomes intentionally stay blocked.** Current provider documentation did not establish a safe retry guarantee for the legacy invoice call. Blind retry could duplicate a client invoice. Operator reconciliation/recovery is documented in `whop-capabilities.md`; automated orphan recovery remains a limitation, not an implemented guarantee.
- Cron compares byte lengths before timing-safe comparison and selects businesses by oldest reconciliation time. This resolves fixed-first-page starvation for successful jobs. A large set of permanently failing jobs still needs backoff/fair scheduling and monitoring before scale.
- A persistent database rate limiter is now invoked after authenticated identity validation and fails closed on backend limiter error; direct invocation by authenticated clients is denied. Unauthenticated perimeter rate limiting remains a deployment responsibility.
- Workspace creation now uses an atomic RPC, tested for rollback. Other provider/database distributed transactions still require reconciliation.

The security test file independently passed **12 tests**. Parent owns complete-suite, browser and build verification. Remaining production gates include real provider response/settlement fixtures, sandbox end-to-end callbacks, deployed two-tenant Supabase checks, file-serving/upload checks, monitoring/backoff, restoration and external review. No live money was moved by this review.

## Contractor payout migration review

The final database pass applies **all checked-in migrations in filename order**, including `202609280002` contractor payouts, to the compatibility harness. `./node_modules/.bin/vitest run tests/database.test.ts` now reports **13 passing tests**.

New tested boundaries: browser roles cannot prepare payouts or modify recipient mappings; service calls must match business owner, outstanding amount and administrator-verified recipient; repeated identical pending confirmation returns the same operation ID with one audit entry; prepared commitments cannot be changed/released or also recorded as linked expenses; trusted reconciliation can advance paid state; missing/unsupported currency and malformed/missing monetary or contractor fields fail closed; recipient and payout rows remain tenant-private.

Review identified and backend corrected two important migration details before this pass: identical pending preparation now reuses its durable operation rather than failing unique insertion, and nullable/missing JSON fields use explicit type checks/`IS DISTINCT FROM` so SQL NULL cannot bypass rejection. Tests include missing contractor kind, missing amount, null paid, null currency, unsupported currency and already expense-linked commitments.

These tests establish SQL authorization and consistency in the compatibility harness. They do not prove actual Whop transfer delivery, commercial permission, supported fees, production idempotency behavior, or hosted database configuration. Live transfer execution remains feature-gated, requires verified destination/disclosure and explicit user confirmation, and was not exercised with real funds.
