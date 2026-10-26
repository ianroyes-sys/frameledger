# Card program readiness

Verified 2026-09-28 against the official Whop Docs MCP using `mcporter call 'https://docs.whop.com/mcp.query_docs_filesystem_whop_docs(command: "cat /api-reference/beta/cards/create-card.mdx /api-reference/beta/cards/update-card.mdx /api-reference/beta/cards/list-cards.mdx")'`.

## Verified provider capabilities

- [Create Card](https://docs.whop.com/api-reference/beta/cards/create-card): `POST /cards` supports `account_id`, `assigned_user_id`, `name`, `spend_limit` (dollars), `spend_limit_frequency` (daily/weekly/monthly/one_time), and `transaction_limit` (dollars). Returns either a created card (201), or application/provisioning/invitation (202). Business issuing accounts require an assigned member. Approval is not implied by a successful API request.
- [List Cards](https://docs.whop.com/api-reference/beta/cards/list-cards): `GET /cards?account_id=...` includes cards awaiting setup; members see cards assigned to them.
- [Update Card](https://docs.whop.com/api-reference/beta/cards/update-card): `PATCH /cards/{id}` supports freeze/unfreeze, permanent cancellation, name and limit changes. Name/billing/limits require `payout:account:update` and `company:balance:read`. Scope and account-specific availability need provider verification.

## Implemented and locally tested, not externally accepted

- Owner-authorized list/freeze/unfreeze/cancel routes with explicit UI confirmation and requested-action audit records. Card ownership is verified by an account-scoped list before changes.
- Virtual-card request form with card name, monthly limit, provider terms link and explicit confirmation.
- `POST /api/cards` reads account and cardholder mappings from server-managed records, never accepts a client-provided Whop owner/cardholder ID.
- Durable issuance request ID, body and safe response persisted before/after provider request. Same confirmed ID returns the recorded result. Unknown outcomes are never blindly resubmitted, including after provider idempotency retention expires. A partial unique database index blocks another unknown request for the workspace. Operator reconciliation is required to clear an unknown outcome.
- Responses distinguish applications, invitations, provisioning and cards. Provider card status is displayed; no card issuance is fabricated.
- Safe allowlisted fields only; PAN, CVV, PIN and applicant verification URLs are not forwarded or stored. Sensitive-field projections have automated tests.
- Currency inputs use integer USD cents and convert to documented dollar values only at the provider boundary.

## Operator activation requirements

1. Obtain explicit Whop/card program approval for the business, markets, commercial terms and intended users. Confirm exact provider/issuer disclosures and applicant consent flow.
2. Apply migration `202609280003_cards.sql` with the other migrations. Verify hosted RLS and privileges.
3. Configure `WHOP_ENVIRONMENT=production`, the server Whop credential with the approved minimum scopes, `WHOP_CARD_TERMS_URL` to the applicable HTTPS Whop card terms, and `WHOP_CARD_ISSUING_ENABLED=true` only after operational acceptance. The issuing gate is disabled otherwise. No secret belongs in a public environment variable.
4. Insert each `cardholder_bindings` row through a privileged operations workflow after independently confirming the Whop user is the intended member of the connected account. Include `verified_at` and `verified_by`. Never trust a browser-supplied identifier as verification.
5. Test with Whop's expressly authorized issuing test facility/assistance. The ordinary sandbox does not establish card issuing acceptance. Do not issue real cards merely to run automated tests.
6. Establish support procedures for pending applications, denied accounts, invitation completion, provision jobs and requests whose outcome is unknown. Inspect provider records before marking an unknown request confirmed; do not delete its record or click again to bypass the lock.

## Still missing for a full card experience

- Provider-approved sensitive card display (hosted secure card details). This app intentionally does not retrieve raw PAN/CVV/PIN. Users cannot yet view full card credentials inside this app.
- Card transaction ingestion/reconciliation into expense records, reversals and authorization/settlement differences. Existing expense records do not prove live card transaction synchronization.
- Application verification and provisioning-job completion integration. The current interface reports pending statuses and asks users to complete Whop onboarding; it does not implement all applicant follow-up screens.
- Editing an existing card's limits or name from the UI (provider supports it; this release sets a monthly limit when requesting).
- Physical-card ordering, shipment, Apple Wallet provisioning, merchant/category restrictions and project-specific settlement rails. No support is assumed from a card `type` field.
- Transaction spending revenue/interchange agreement. Issuing a card does not establish that the platform receives interchange. Whop-approved fee markups and card program commercial revenue are separate questions.

The application remains an unlaunched financial platform, not a chartered bank. A functioning mock and typed API boundary do not establish external card-program acceptance.
