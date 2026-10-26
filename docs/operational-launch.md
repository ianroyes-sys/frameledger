# Making FrameLedger operational

Updated 2026-09-28. This checklist separates local software evidence from service provisioning and real financial acceptance. See [verification](verification.md) for the current test run and [Whop capabilities](whop-capabilities.md) for exact supported operations. No production account or financial transaction is created by this document.

## 1. Set the operating model

Owner: founder with Whop and qualified counsel.

- Confirm which entity offers the product, which entity performs each regulated financial service, allowed customer countries, connected-account eligibility, customer support obligations, complaints/refunds, and required disclosures.
- Obtain written provider approval for the actual intended services. Confirm fees, settlement timing, holds, refunds, cards, transfers and recipient eligibility. Do not equate a working API key with commercial approval.
- Clear the working brand and domain. Publish reviewed terms, privacy, fee and virtual-reserve disclosures. Retain the distinction between a bookkeeping reserve and legally segregated funds.

Exit evidence: approved service scope, named responsible parties, verified fees and reviewed disclosure copy. Until then, use the synthetic demo for product review.

## 2. Provision isolated staging

Owner: project administrator.

Create a Supabase staging project and a separate deployment environment. Apply **all files currently in `supabase/migrations` in filename order**; do not rely on an old count of migrations. Configure email confirmation, permitted authentication URLs and deliverable authentication emails. Follow the current [README](../README.md).

Supply these values through local/deployment secret settings, never chat or committed files:

| Variable                        | Value or source                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------ |
| `FRAMELEDGER_MODE`              | `production` selects authenticated application storage; it is separate from the Whop environment |
| `NEXT_PUBLIC_SUPABASE_URL`      | Staging Supabase project URL                                                                     |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Staging public key; RLS must remain enabled                                                      |
| `SUPABASE_SERVICE_ROLE_KEY`     | Staging server-only service credential                                                           |
| `WHOP_API_KEY`                  | Separate approved sandbox credential with least privileges                                       |
| `WHOP_WEBHOOK_SECRET`           | Signing secret for the staging endpoint                                                          |
| `WHOP_ENVIRONMENT`              | `sandbox` for provider testing                                                                   |
| `CRON_SECRET`                   | Strong independently generated worker secret                                                     |
| `WHOP_PAYOUTS_ENABLED`          | Leave unset/false until the separate approval and acceptance gate                                |
| `WHOP_TRANSFER_FEE_DISCLOSURE`  | Actual verified fee language; not a guessed estimate                                             |

Run `npm run check:setup` after configuring `.env.local`. This prints only presence/validation results and makes no provider calls; a pass does not prove service credentials work.

Map each business to its verified Whop account through the trusted administrative process. Never use an account ID pasted by a customer without ownership verification. Configure `/api/webhooks/whop` and the recovery worker on the deployed origin.

Exit evidence: two separate users sign up and can access only their own workspaces and receipts; new accounts contain no demo records; invalid auth is rejected; sign-out/account switching does not expose the previous workspace.

## 3. Execute external acceptance without real money

Owner: engineer and provider administrator.

Use Whop's documented test environment. The existing capability review records sandbox gaps for Elements and payouts; verify the current [sandbox documentation](https://docs.whop.com/developer/guides/sandbox) before the session. A mock test cannot close a provider acceptance gate. Where no sandbox exists, obtain provider-assisted evidence or leave the feature disabled. This testing plan does not authorize real money movement.

Record request IDs, resource IDs and outcomes without raw personal/payment data:

1. Create Johnson Wedding and separate $1,600 retainer/final invoices. Verify actual hosted payment URLs and customer delivery in the test setup.
2. Complete a supported synthetic provider payment. Verify signed webhook delivery, canonical payment read, available balance and project/receivable updates. Distinguish pending proceeds from available settlement.
3. Check fees, tax/gear allocations, $450 contractor and $120 travel commitments against independent arithmetic. Synthetic no-fee acceptance is $470 Safe to Spend after the first payment; provider fees/settlement can legitimately change that figure.
4. Replay a duplicate; deliver an older event after a newer one; test failure/refund and denied webhook signatures. Confirm no extra invoice income or reserves.
5. Deliberately interrupt a webhook and prove reconciliation repairs it. Inspect stale-balance warnings, audit records and unresolved-operation recovery.
6. Attach the $67 fuel and $140 rental to the wedding, leave $58 Adobe as overhead, close the supported scenario and check profitability. Test $2,400 lens impact. Never use an unverified contractor payout to force a successful state.
7. Exercise receipt isolation, expired authentication, request failures and concurrent updates on deployed mobile and desktop browsers.

Exit evidence: saved results from the real staging services. Investigate mismatched provider payloads before production activation; prepared adapter tests are not upstream confirmation.

## 4. Prepare production operations

Owner: operator and engineer.

- Complete ledger-backed dispute/reversal accounting and expense settlement matching; see [follow-up security review](followup-security.md). The current loss handling fails synchronization safely and is not a complete dispute workflow.
- Configure separate production Supabase and Whop credentials, approved account mappings, deployment domain, HTTPS, webhook destination and `CRON_SECRET`. Keep test accounts and records out of production.
- Verify the deployment's scheduler actually runs. The checked-in daily cron is a recovery sweep, not continuous monitoring. Alert on webhook failures, oldest unprocessed event, stale balance, reconciliation failures and unresolved invoice/transfer operations.
- Select retention and backup settings for the database **and receipt storage**. Perform a restore drill; confirm restored records reconcile with provider truth before resuming actions.
- Establish key rotation, access reviews, incident ownership, support contact, provider escalation, disputed-payment handling and operator recovery for unknown invoice/transfer outcomes. Logs must exclude tokens, raw identity data and receipt contents.
- Complete independent security/tenant review and verify production rate limits and auth recovery. Decide whether the current refresh-requires-login behavior is acceptable for the pilot.
- Keep payouts/card controls gated until eligibility and provider-specific verification are complete. Pricing is configuration only; subscriptions and billing need a separate implemented/verified flow before charging customers.

Exit evidence: monitored deployment, alert delivery, successful restore, reviewed customer terms and an operator who can recover a failed synchronization.

## 5. Private creator pilot, then mobile

Begin with the founder and a small invited group after the prior gates pass. Track paid invoices, available-balance correctness, support incidents and project closeouts. Validate recurring-revenue, expense matching and reporting needs before expanding scope.

The current documented limits include USD-only accounting, single-line invoice creation, basic global allocations, limited history, manual transaction matching, no activated subscription billing, and no native mobile binary. Maintain a visible distinction between product limitations and actual financial failures.

Once the financial loop is externally verified, follow [the App Store path](app-store-path.md). Building iPhone screens can reuse the domain/backend, but provider authorization, mobile integration testing and App Review are additional work.

## Launch decision record

For each gate, record date, environment, operator, evidence location, failures and resolution. Suggested states: **prepared**, **executed**, **verified**, **externally confirmed**, **blocked**. Do not mark the platform fully operational solely because the local test suite or deployment build passes.
