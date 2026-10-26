# Independent engineering stress verification

Date: 2026-09-28. Scope: local, synthetic data only. This is executable engineering evidence, **not MiroFish output**, a penetration test, hosted load test, or proof of live banking readiness. No external financial requests, customer data, or money movement were used.

## Findings vetted and implemented

| Finding                                                           | Evidence and correction                                                                                                                                                                                                                                                                                                | Regression check                                                                                |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Webhook size limit ran after the entire body was read             | A chunked body without an honest Content-Length could consume memory before rejection. Stream consumption now cancels after 256 KiB; malformed UTF-8 gets 400.                                                                                                                                                         | An unlimited synthetic chunk producer is cancelled by the route before signature/database work. |
| JSON API bodies were read without an application byte limit       | All JSON mutation handlers now use a shared 64 KiB streaming reader. Oversized input returns 413; invalid JSON/UTF-8 returns 400.                                                                                                                                                                                      | Oversized, malformed, invalid-byte, and normal JSON inputs.                                     |
| Scheduler could report healthy after stale-account lookup failed  | The database error was ignored. It now produces 503 rather than a false successful sweep.                                                                                                                                                                                                                              | Mocked database failure, with no provider calls.                                                |
| Floating point intermediate aggregation could silently lose cents | Example: opening balance 2 plus MAX_SAFE_INTEGER receipt minus (MAX_SAFE_INTEGER − 1) expense should equal 3; ordinary number intermediates produce 2. Aggregate calculations now use BigInt before checked conversion. Project profit and purchase forecasts also reject results outside the supported integer range. | Exact cancellation and out-of-range profit/purchase cases.                                      |
| Commitment matching repeated full expense scans                   | Safe-to-spend and project profit now index expenses by commitment once; payment matching uses invoice-ID sets.                                                                                                                                                                                                         | 10,000 commitments with 10,000 matching expenses yield exact expected cash and costs.           |

## Stress scenarios executed

- 10,000 deterministic allocation combinations, including amounts near the safe integer limit: every cent conserved using an independent BigInt assertion.
- 10,000 expense-backed commitments: balance 1,600,000 cents, remaining commitments 600,000 cents, safe-to-spend 1,000,000 cents.
- 1,600 successive one-dollar refunds, each replayed: no duplicate effects; complete refund leaves zero tax/gear reserves.
- Streamed request cancellation, bounded JSON parsing, scheduler database failure, unsafe project/forecast arithmetic.
- Existing suite also checks revision conflicts, rate limiter counts, tenant isolation, duplicate/out-of-order financial events, and stale client-response rejection. Local PGlite tests establish database logic, not hosted multi-connection load capacity.

## Remaining operational limits

1. Hobby's daily recovery schedule is suitable only for this non-commercial staging exercise. Webhook background work is opportunistic; daily recovery is not a real-time settlement SLA.
2. Reconciliation processes a bounded number of businesses serially, but each business currently scans its linked invoices/transfers. Large histories can exceed a function duration. Before financial launch, implement a durable cursor-based worker with leases, retry backoff, failure quarantine and backlog monitoring. Repeated failing oldest events must not starve later events.
3. Optimistic revision checks prevent lost workspace updates; they can require retry when webhook and user writes overlap. This exercise did not benchmark real concurrent hosted traffic.
4. A saved balance is a snapshot. Failed reconciliation must retain its last-sync timestamp and must not imply current spendability. The provider performs a fresh balance check for payouts, but provider-side fees and concurrent external spending remain relevant.
5. Manual expense settlement matching, dispute/loss accounting, provider approval, and real card/payout acceptance remain launch gates documented elsewhere. MiroFish hypotheses cannot override these gates.
6. Whole-workspace state is still a bounded-MVP architecture. Move high-volume history to paginated relational queries before claiming large-agency scale. The 10,000-item calculation case is not a supported production account-volume guarantee.

## Verification

Targeted stress suites and full Vitest suite executed locally. Final counts and production/browser verification are recorded by the integrating agent in the deployment handoff. No latency SLA or third-party load result is claimed.
