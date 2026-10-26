# Platform revenue setup

Verified against official Whop Docs MCP on 2026-09-28. Prepared code is not an active commercial agreement. No fees have been enabled or collected.

## Supported configuration

The official [Create fee markup](https://docs.whop.com/api-reference/fee-markups/create-fee-markup) describes `POST /fee_markups`, permission `company:update_child_fees`, `account_id`, `fee_type`, `percentage_fee` (0–25 percentage points) and `fixed_fee_usd` ($0–$50). Creating an existing type updates it. [List fee markups](https://docs.whop.com/api-reference/fee-markups/list-fee-markups) describes `GET /fee_markups?account_id=…` with cursor pagination; a platform account returns platform defaults. [Deleting](https://docs.whop.com/api-reference/fee-markups/delete-fee-markup) reverts to parent defaults: deletion must not be assumed to mean zero fees.

Supported types: payment, transfer, bank deposit, next-day bank withdrawal, instant/RTP withdrawal, bank wire, digital-wallet withdrawal, crypto withdrawal/deposit/swap. These are provider capabilities, not a claim that this application exposes every corresponding financial operation.

**Card interchange is not a documented fee-markup type.** Do not forecast or advertise interchange participation without a separate verified provider agreement. Card cashback funded by the platform is a cost. Receiving customer deposits is not platform revenue. Gross transaction volume is not revenue.

## Operator workflow

1. Obtain Whop approval for the platform and relevant connected-account structure, scope, eligible services, fee payer, settlement recipient, refund treatment and actual net economics.
2. Choose an exact fee policy and secure required commercial/legal review. Publish customer terms and contextual fee disclosure before activation. Do not charge unannounced fees or use internal operator notes as customer disclosure.
3. Create a local policy JSON using the structure below. This is a hypothetical example, not an approved price:

```json
{
  "accountId": "biz_REPLACE",
  "environment": "sandbox",
  "feeType": "payment_markup",
  "basisPoints": 50,
  "fixedMinor": 0,
  "disclosure": "Platform fee: 0.50% of each qualifying payment, in addition to applicable provider fees.",
  "approvalReference": "REPLACE_WITH_APPROVAL_REFERENCE"
}
```

4. Run `npm run fees:review -- /path/to/policy.json`. This validates and previews the exact provider payload and SHA-256 review digest without calling Whop.
5. Only after explicitly approving the actual rates/account, set server-only `WHOP_FEE_CHANGES_ENABLED=true`, matching `WHOP_ENVIRONMENT` and the scoped `WHOP_API_KEY`. Apply with `npm run fees:review -- /path/to/policy.json --apply REVIEW_DIGEST`. Do not use the example as an approved policy. There is no tenant-accessible fee-edit API.
6. The script logs local intent before the request and provider confirmation afterward in ignored `.fee-policy-audit.jsonl` (owner-only creation permissions). Retain this securely with operator records. A response failure or timeout requires inspecting actual provider configuration before retry; legacy API idempotency is not assumed.
7. Read the full paginated provider configuration and verify a supported test payment's fee breakdown and platform settlement. Account-level configuration alone does not prove collection, correct inheritance, refunds or revenue receipt. Keep actual public fee schedules synchronized with provider settings.
8. Disable the operator change flag after configuration. This flag does not disable an already configured provider fee. To stop charging, explicitly set reviewed zero values and verify the effective inherited fee configuration; do not simply delete the markup.

The digest prevents accidental application of a changed preview; it is not an electronic signature or a substitute for authorization. Provider permission and commercial approval remain necessary. The tool does not publish disclosures, activate subscription billing, calculate taxes, or confirm settlement. Production use must retain operational audit records and provider read-back evidence.

## Illustrative economics

At an assumed 0.50% platform markup, a $1,600 qualifying payment produces $8 gross markup; $100,000 qualifying monthly volume produces $500 gross markup. Neither figure is profit. Provider costs, fee payer, refunds, losses, taxes, support and contractual revenue splits determine net revenue. These values are calculation examples, not configured fees or revenue projections.

Prioritize predictable software subscription value. Avoid charging every possible operation simply because an endpoint exists. Subscription billing and customer entitlement enforcement remain a separate implementation/acceptance gate.
