# Architecture

FrameLedger is a responsive Next.js TypeScript application. Whop owns financial truth; Supabase owns tenant identity and creator context; local browser storage is only an explicitly synthetic demo workspace. No live funds are mixed with demo fixtures.

## Boundaries

- `src/domain/index.ts`: portable pure TypeScript integer-cent USD calculation engine, state types, reducer, sample workspace. No framework or provider dependency. Allocation uses BigInt intermediates and deterministic largest remainders. Percentages use basis points. No cross-currency addition or invented exchange rates.
- `src/server/whop.ts`: server-only verified REST adapter with fixed hosts, explicit API version, timeout, schema validation, no raw error/PII logging, no-store fetches. MockFinancialAdapter is distinct and never selected silently for failed production requests.
- `src/server/auth.ts`: Supabase user token verification, owner authorization, database rate limiter. Service key never reaches browser. Bearer-auth APIs have no ambient cookie authorization; Origin checked for writes. Every business mapping originates server-side.
- `/api/workspace`: authenticated GET aggregate, POST validated context command with optimistic revision and atomic audit, PUT empty workspace creation. `/api/businesses` aliases list/create for onboarding. Financial receipt/payout/refund simulation commands are absent from production allowlist.
- `/api/invoices`: explicit confirmed send; persistent unique operation record precedes external request; external ID linking precedes local sent status. Unknown outcomes demand operator recovery rather than silently issuing again.
- `/api/webhooks/whop`: raw signature verification before parsing, durable minimal-ID queue with unique event IDs. Immediate after() worker reads current provider resources. Worker failure leaves durable queue for cron or manual reconciliation.
- `/api/reconcile` and `/api/cron/reconcile`: owner-triggered and secret-protected reconciliation. Fetch current invoice/payment/account states, never rely on arrival order or browser redirect. Version conflict fails and retries; no partial aggregate commit. Recovery rotates oldest synchronized businesses, up to 50 per cron cycle.
- `/api/whop/access-token`: owner-scoped short-lived identity token only. No caller-selected account or permissions. Refuses sandbox Elements (not supported upstream).
- `/api/cards`: strips responses to non-sensitive fields, verifies card membership in account before explicitly confirmed freeze/unfreeze/cancel, records request audit. No PAN or CVV retrieval.

## Financial model

Every invoice belongs to a project and client. Each receipt records allocation amounts as they were computed at receipt time, so a later percentage change affects future income only. Refunds unwind proportional reserves conservatively using integer arithmetic, with last refund returning all residual cents. Costs attach to a project or remain overhead. Contractor commitments reduce available spending before payout. A linked actual travel expense consumes its estimate; releasing unused estimate changes commitment only, never cash.

Safe-to-spend = settled provider cash − virtual tax/gear/protected reserves − remaining commitments − manually recorded expenses awaiting transaction matching. Manual expense reservations are intentionally conservative in connected mode and can double-reserve a cost already reflected in Whop until transaction import/matching is completed. They must not inflate cash when an estimate is fulfilled. UI must treat absent `balanceSyncedAt` or stale snapshot as unverified, and never suggest live affordability from an unsynchronized balance.

Demo derives cash from synthetic receipts less costs. Production `actualSettledBalance` overrides receipt-derived funds: a paid invoice may remain pending at Whop. Current available USD is read separately; crypto/USD-equivalent balances do not count. Taxes are bookkeeping reserves, not an expense in pretax project margin. Equipment allocation is not a project cost. Overhead Adobe subscription affects business cash but not a wedding's project margin. Expected invoices are scenarios, never cash or guaranteed collection.

## Supabase migration and tenant isolation

Apply `supabase/migrations/202609280001_core.sql`. It creates businesses, aggregate states, invoice links, webhook queue, snapshots, private receipt metadata/bucket, audit log, creator preferences, and tenant-keyed extension tables for the complete future relational model. RLS allows only owner reads; direct browser writes are revoked. Server commands validate and execute using trusted service role. `commit_workspace` locks the tenant row, compares revision and commits state plus audit atomically, executable by service_role only. No token, card number, raw KYC payload, W-9 ID or banking credential belongs in application tables.

The V1 aggregate JSON is canonical creator context. Extension tables are migration scaffolding, not synchronized alternate truth. They allow gradual relational extraction, but are not yet a complete normalized accounting schema. Owner-only permissions are intentional; team roles require explicit later policy design. Workspace creation uses a service-only transaction that inserts the business, empty aggregate and creation audit together.

## Consistency and recovery

Duplicate webhook IDs cannot create duplicate queue events. Even two distinct provider events for one payment use a stable payment resource ID in the reducer. Old event arrival causes a fresh read of current resource, so it cannot roll back payment state. Refunds compare canonical cumulative refund amount. Failed or pending payments are not credited. Reconciliation excludes manually marked-paid invoices without payment resource. Settled cash refresh accounts for reversals independent of status events; reversed-income attribution beyond provider cumulative refunds and card transaction import requires further production work.

Scheduled reconciliation handles missed delivery after endpoint downtime; event queue survives process termination. Errors return non-2xx or remain queued, never mark an unsynchronized event processed. Unknown remote send outcomes use the recovery runbook in whop-capabilities.md. For large deployments replace bounded cron with durable queue workers and paginated all-tenant reconciliation. Parent deployment config sets a recovery schedule; immediate delivery processing does not wait for cron.

## AI and portability

Deterministic calculations remain local domain functions. Natural language assistant adapters may interpret queries over a tenant-scoped read model, but cannot execute money actions. Every future action proposal needs explicit user confirmation followed by server authorization and a verified provider operation. Domain has no React import and can be reused by Expo after Elements compatibility validation.

## Verification limits

Domain and mocked API-boundary tests run without secrets and never move money. Supabase migration execution, real RLS attacks, provider sandbox responses, external settlement/refund sequences and production webhook authenticity still require configured service credentials. No test suite substitutes for those launch gates.

## Confirmed collaborator transfers (prepared integration)

Migration `202609280002_payouts.sql` adds verified collaborator-to-Whop destination bindings and a durable payout outbox. Only an administrator using trusted credentials can bind a recipient after verifying ownership, identity, exact account ID, and the collaborator relationship; browser commands cannot assign destinations. The GET preview returns the saved verified name/account, outstanding amount, and configured fee disclosure. POST requires explicit confirmation of that exact amount and destination, checks current provider settled USD, and creates the operation plus audit while locking the workspace. General workspace commits cannot edit payout commitments or record duplicate linked expenses.

Delivery uses verified `POST /transfers` type ledger with both documented idempotency header and ledger idempotence_key. The persisted immutable operation is retried only within 23 hours of creation; older unknown outcomes require operator verification. `GET /transfers/{id}` must match origin, destination, amount and USD currency. Only canonical `succeeded` resolves a commitment, while `processing` and `failed` leave it reserved; a failed transfer may later succeed under the same ID per Whop docs. Stable resource IDs deduplicate success. Fees from the verified response become settled project expenses. Current balance refresh occurs in the same aggregate synchronization. Webhook delivery triggers this same reconciler.

The gate `WHOP_PAYOUTS_ENABLED=true` plus a nonempty `WHOP_TRANSFER_FEE_DISCLOSURE` requires verified pricing, platform approval, recipient verification, and successful controlled provider testing before enabling. Sandbox payout features are unavailable per official docs, so no live transfer was attempted. This is a prepared integration, not externally verified payment functionality. Never enable it merely to bypass a setup error.
