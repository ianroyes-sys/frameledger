# Verification report — 2026-09-28

## Outcome and evidence boundary

The implemented local V1 runs and its synthetic core journey passes. The production build succeeds. This is **not certification that the financial product is production-ready**: hosted Supabase staging has now passed synthetic two-user acceptance; Whop API access, live KYC, invoice delivery, client payment, card mutation and transfers remain unverified. No real money moved.

| Check                              | Result                        | Evidence / limits                                                                                                                    |
| ---------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Formatter                          | Passed                        | `npm run format:check`                                                                                                               |
| Lint                               | Passed                        | `npm run lint`, no errors or warnings                                                                                                |
| TypeScript                         | Passed                        | `npm run typecheck`                                                                                                                  |
| Unit/integration/security/database | 120 tests passed in 19 files  | `npm test`                                                                                                                           |
| PostgreSQL compatibility tests     | 19 passed, included above     | All five migrations applied to PGlite with mock Supabase auth/storage schemas; actual SQL RLS, transaction/RPC behavior tested       |
| Desktop/mobile E2E                 | 48 passed                     | `npm run test:e2e`; Chromium desktop, iPhone-sized Chromium and WebKit                                                               |
| Accessibility                      | Automated tests passed        | Axe WCAG A/AA checks on overview, keyboard dialog Escape; not a complete manual screen-reader or WCAG certification                  |
| Production build                   | Passed                        | `npm run build`, all application and API routes compiled                                                                             |
| Production credential gate         | Passed                        | `scripts/production-smoke.mjs`; missing credentials fail closed, live invoice page never reads demo storage                          |
| Responsive visual inspection       | Passed inspected views        | Desktop 1440×1100, tablet 834×1112, mobile 390×844, overview/project/invoice/simulator; no detected page errors or document overflow |
| Dependency audit                   | Zero reported vulnerabilities | `npm audit --json` against the installed lockfile on this date                                                                       |
| Basic secret-pattern scan          | No matches                    | Source/tests/docs/example env scanned for common token patterns; not a comprehensive secret-scanner certification                    |
| Hosted Supabase/Whop end to end    | Not executed                  | Requires credentials, account setup, approval and external verification                                                              |

## Follow-up verification

Repeated the full suite after hardening canonical payment/account bindings, refund validation, completed-project reopening, persisted-state validation, cross-tab synchronization, stale response handling, sign-in validation, and mobile navigation. All checks above passed again. WebKit is a browser-engine test on macOS, not an actual iPhone or native app certification.

New browser cases cover corrupted nested records, denied storage, invalid allocation/payment/purchase inputs, cross-tab payment updates, optional client-field compatibility, and confirmation before changing completed projects. Component tests cover authentication errors, failed workspace loads, revision conflicts and out-of-order responses.

`npm run check:setup` correctly reports missing external service configuration in this workspace. No secret values were printed. This expected failure is an external setup blocker, not a passing live-integration result.

Before launch, complete ledger-backed dispute/reversal accounting, manual expense settlement matching, authentication recovery and external acceptance; see [follow-up security](followup-security.md) and [operational launch](operational-launch.md).

## Core wedding journey exercised in the browser

The seeded retainer is synthetic. The test then records $67 fuel against the existing $120 travel estimate, $58 Adobe overhead, and $140 project rental. It simulates the final $1,600 invoice payment, pays the $450 second-shooter commitment, explicitly releases the unused $53 travel estimate, closes the project, and simulates a $2,400 lens purchase.

Verified checkpoints:

- Initial $1,600 available balance → $400 tax + $160 gear + $450 crew + $120 travel → **$470 Safe to Spend**.
- Fuel consumes travel commitment; with Adobe and rental, Safe to Spend becomes **$272**.
- After final income, collaborator payment and release of remaining travel estimate: **$2,485 actual synthetic balance**, **$1,365 Safe to Spend**.
- Direct project profit: **$2,543** before tax, fees, owner labor and overhead. Adobe remains overhead.
- Lens simulation: **−$1,035 Safe to Spend** after purchase. Expected invoice money is not represented as current cash.
- Reloading preserves the completed demo state.

A second browser journey creates a new client, wedding project and retainer invoice from the UI, marks the demo invoice sent, opens the client-facing invoice, and records an $800 partial synthetic payment. The remaining invoice balance is $800 and its status is partial.

## Security boundaries exercised

- No-session workspace/invoice/reconciliation requests are rejected.
- Cross-origin mutations are rejected.
- Unsigned webhook requests are not accepted.
- Public cron invocation is rejected.
- Raw-body signature tampering, expired/future timestamps, malformed IDs and duplicate signature variants are covered.
- Client commands cannot forge payments, refunds, transfer success, settled balance or provider settlement provenance.
- Owner-scoped database access, direct-write rejection, service-only RPCs, rollback, revision conflicts and persistent rate limits are tested in PostgreSQL.
- Receipt object access is restricted to the business owner and production receipt references are checked against the expense/business.
- Transfer preparation binds exact verified recipient and amount; repeat requests reuse the operation; in-flight commitments cannot be altered; only authoritative success records payment.

## Issues found and corrected

1. **Receipt RLS SQL ambiguity:** unqualified `name` resolved to business name, not object path. Qualified `storage.objects.name`; tenant storage tests now pass.
2. **Live cash overstatement:** consuming a commitment with a manually entered expense could inflate spendable cash against an unchanged provider snapshot. Pending manual expenses now stay conservatively reserved.
3. **Mobile receipt input overflow:** an invisible file input expanded the document and intercepted form clicks. Correct clipping and table containment restored mobile expense entry.
4. **Accessibility:** weak text contrast, unnamed allocation semantics and inaccessible horizontal table scrolling were corrected.
5. **Live/demo boundary:** the live invoice page no longer mounts the demo store; root mode resolves at request time instead of baking demo mode into a static page.
6. **Negative zero:** money formatting now renders zero as `$0.00` instead of `-$0.00`.
7. **Transfer concurrency:** database locks preserve commitment/recipient consistency while an operation is pending; identical preparation reuses the same operation ID.

## Artifacts

Screenshots are in `docs/screenshots/`; machine-readable viewport results are in `inspection.json`. `scripts/visual-check.mjs` captures them from port 3210. `scripts/production-smoke.mjs` expects a production-mode build running on port 3211. Browser tests use ephemeral contexts and synthetic data only.

## Remaining launch gates

Apply both Supabase migrations to a real staging project and rerun tenant/storage/auth tests. Verify official provider response fixtures and webhook delivery in the configured environment. Verify account eligibility, hosted identity verification, invoice delivery/checkout, refunds, card controls, transfer fees and recipient mapping. Reconcile settled versus pending funds. Exercise the documented uncertain-invoice recovery path. Complete name, terms, fee and disclosure review before public launch.

## Supabase, cards and monetization follow-up

Added a service-only database readiness inspector and an explicit read-only hosted verifier, local Supabase configuration, a Whop connectivity checker, and an operator fee-policy preview/apply tool. No external credentials are configured. Both service checks stopped before sending requests; no hosted migrations, cards, fees or accounts were changed.

Added gated virtual-card request UI/backend, trusted cardholder mappings, durable operation reservation, explicit terms confirmation, distinct pending/application results and sensitive-field stripping. Tests cover provider request boundaries, UI confirmation/pending feedback, no resubmission after an unknown outcome, actual SQL uniqueness and denied browser access. Updated card action responses are bound to the requested card and audited.

Latest full results: 116 tests across 18 files; 48 browser tests across three browser configurations; formatter, lint, typecheck and production build passed. New cards UI tests use mocked provider responses; browser regression uses the synthetic workspace. No actual card program acceptance is implied. Full card display, card transaction synchronization and applicant completion workflows remain gaps in [card program readiness](card-program.md). Fee preview arithmetic is not a provider settlement result; [monetization setup](monetization-setup.md) explains activation and revenue verification.

## Hosted provisioning update

A Supabase staging project now exists. All five migrations and durable history are recorded. Twelve hosted readiness checks and the actual two-user workspace/receipt acceptance passed; synthetic records were cleaned up. Production-origin handling and explicit service-role grants were corrected during this verification. Fresh local suite:120 tests across19 files;48 browser tests on an isolated demo production server; formatter/lint/typecheck/build passed. Whop account login works, but its updated financial terms are awaiting user acceptance; no provider mutations performed. Remaining gates: SMTP, public hosting, Whop provider approval and operating procedures.

## Local stress verification update

129 tests across22 files and48 browser tests passed after engineering hardening. Lint, typecheck, and production build passed. Stress scenarios covered10,000 allocation cases,10,000 commitments and1,600 partial refunds with duplicate replay. These are local synthetic tests, not hosted/provider load or live-finance acceptance. See `engineering-stress.md` for separate evidence. Deployment remains pending explicit secret-export authorization; no upgrade was performed.
