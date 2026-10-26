# Financial-platform readiness

Updated 2026-09-28. User objective: establish Supabase and Whop operations, card issuing, and legitimate platform revenue before native app development.

## Current evidence

| Capability                                                                          | Prepared locally                                                                 | Externally verified for this business                                                  |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Supabase accounts, workspace storage, private receipts                              | Migrations, RLS, authenticated API, local tests, read-only inspection tooling    | Staging provisioned; hosted readiness and two-user workspace/receipt acceptance passed |
| Whop connected account and KYC                                                      | Administrative account binding and hosted verification integration               | No approved account connected                                                          |
| Receive creative-service invoice payments                                           | Documented invoice API and hosted payment link; canonical webhook reconciliation | No provider acceptance performed                                                       |
| Available balance and virtual reserves                                              | Integer-cent accounting, balance freshness, explainable Safe to Spend            | No live balance observed                                                               |
| Card requests                                                                       | Gated virtual-card request flow; provider result types distinguished             | Issuance eligibility and actual delivery not verified                                  |
| Card freeze/unfreeze/cancel                                                         | Account-bound requests and explicit confirmation                                 | Not exercised against provider                                                         |
| Collaborator transfers                                                              | Verified recipient bindings, operation tracking and confirmation                 | Disabled pending approval/acceptance                                                   |
| Platform transaction markups                                                        | Official fee API; operator preview/apply tool; exact-policy confirmation         | No approved policy, activated fees or settlement evidence                              |
| Card interchange revenue                                                            | No assumed percentage or earnings                                                | Requires verified commercial agreement                                                 |
| Software subscriptions                                                              | Configurable pricing hypotheses                                                  | Billing and entitlement lifecycle not activated                                        |
| Traditional bank account/routing details, physical cards, lending, insured deposits | Not represented as implemented                                                   | Not established by Whop integration or branding                                        |

Customer money and platform revenue must be accounted for separately. A provider fee-setting response is not a revenue settlement record. Fees must be disclosed to the actual payer before activation. Virtual reserves are bookkeeping, not separate bank accounts.

## Setup access still needed

- Supabase staging is provisioned; no further database credential input is required for the current staging checks.
- Intended Whop platform account/app name/link, correctly scoped credential, signing secret, verified account structure and provider approval for this use case.
- Operating legal entity and country; intended customer countries.
- Provider-confirmed card terms, fees, eligibility and verified cardholder mappings.
- Approved platform fee policy: exact operation, rate, payer, disclosures, effective date, settlement beneficiary and refund treatment.

Supply secrets only through local/deployment environment configuration. Do not paste them into chat. Existing unrelated Supabase/Whop projects must not be repurposed automatically.

## Order of operations

1. Establish target accounts and approved provider scope.
2. Apply all migrations to isolated staging; run `npm run check:setup`, `npm run check:supabase -- --allow-network`, and `npm run verify:whop` with that environment configured.
3. Run real staging tenant/auth/storage and invoice/webhook acceptance. Read-only connectivity checks do not prove these workflows.
4. Close dispute/reversal and expense matching gaps from [the security review](followup-security.md). Add monitoring, recovery, backups and restoration evidence.
5. Verify cards and payouts with provider-supported test facilities. Where sandbox support is absent, obtain provider-assisted acceptance or leave disabled; do not test with real money by default.
6. Review a fee policy using [the monetization guide](monetization-setup.md), activate only after explicit approval, and verify actual provider collection/settlement.
7. Run a private web pilot before native-app work.

See [Supabase setup](supabase-setup.md), [operational launch](operational-launch.md) and [working-name research](brand-naming.md). The product is not fully operational until external evidence closes these gates.

Whop account is known and signed in, but account-wide updated terms await user acceptance. A commercial hosting decision is also pending.
