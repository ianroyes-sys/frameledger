# Unit economics and pricing hypotheses

Snapshot researched 2026-09-28. Public fees are reference data, not the negotiated economics of an approved FrameLedger deployment. Configure pricing centrally. Transaction markup defaults to zero and disabled. Do not absorb processing fees without explicit business modeling.

## Known public Whop costs

[Official Whop fees](https://docs.whop.com/fees): domestic card 2.7% + $0.30; international card surcharge 1.5%; FX 1%; ACH collection 1.5% capped at $5. Next-day ACH withdrawal $2.50; instant bank payout 4% + $1; crypto/Venmo payout 5% + $1; bank wire $23; international local payout varies. Optional billing 0.5%, orchestration 0.8%, tax/remittance 2% when enabled and tax collected. 3DS $0.03, Radar $0.07, dispute $15, early alert $29, affiliate processing 1.25%. These components can stack. Applicable country, contract, enabled products and payment method must be checked before presenting a customer quote.

For a $1,600 domestic-card invoice, base arithmetic is $43.50 processing, leaving $1,556.50 before other applicable costs. If billing's 0.5% applies, another $8 is charged. Two such payments cost $87 base or $103 with that billing increment. Two ACH payments at the public cap cost $10 collection before any additional applicable services. These are illustrative fee arithmetic, not guaranteed quotes or our revenue.

## Unknowns requiring commercial confirmation

- Neobank platform contract and availability by jurisdiction/business type.
- Per-deposit, transfer, card issuing, card spend, ledger, token, KYC and account servicing costs.
- Interchange participation, revenue share, reserves, payout limits and dispute liability allocation.
- Whether the selected invoice integration invokes optional billing fees.
- Minimum volume commitments, support obligations, refunds of fees and negative balance handling.
- Which fees may legally/commercially be passed to users and what disclosure is required.

The [Blueprint article](https://whop.com/blog/neobank-blueprint/) describes configurable movement markups and funded cashback. It does not verify a margin contract for this app. Do not project interchange, float/yield, stablecoin swaps or deposit revenue until official technical and commercial terms are known. Cashback is an expense if funded from our balance.

## Product tiers (hypotheses, no billing activated)

| Tier   | Proposed monthly price | Value hypothesis                                                                                                     |
| ------ | ---------------------: | -------------------------------------------------------------------------------------------------------------------- |
| Free   |                     $0 | Basic projects/invoices, expenses, tax reserve tracking, data export and safe cash visibility.                       |
| Pro    |                    $12 | Allocation rules, advanced project economics, forecasts, simulator, automation and branded invoices where supported. |
| Studio |                    $29 | Team/collaborator permissions, agency reporting and project controls when actually implemented.                      |

Do not sell unavailable features. Keep export and access to historical financial records available after downgrade. Trial/paid entitlement is server-validated separately from marketing configuration.

Competitive context: Found $35 Plus, Mercury paid from $35, Lili Pro $15/Smart $35, Wave Pro $19, Pixieset Plus $15 monthly/$12 annual, HoneyBook Starter $29 annual equivalent and Bonsai Essentials $19/user annual equivalent. Sources and billing distinctions are in research.md. $12 is plausible positioning, not validated willingness to pay. Interview working creators and test paid retention before changing the business model around it.

## Sensitivity model

Contribution = subscriptions + verified net movement revenue − attributable infrastructure − support − AI − unrecovered fees/losses. Payment volume is never revenue. With zero movement markup, it produces no assumed payment revenue.

Illustrative cohort of 100 Pro subscribers, $1,200 monthly gross subscription revenue:

| Variable cost per subscriber/month | Total cost | Contribution | Contribution margin |
| ---------------------------------- | ---------: | -----------: | ------------------: |
| $2                                 |       $200 |       $1,000 |               83.3% |
| $5                                 |       $500 |         $700 |               58.3% |
| $10                                |     $1,000 |         $200 |               16.7% |

These invented cost scenarios test sensitivity; they are not vendor quotes. They exclude fixed staff/legal/security costs and subscription processing. If 10% of 1,000 free users convert to Pro, gross revenue is $1,200 while servicing the other 900 may consume it. At an assumed $1 variable cost across all 1,000 users, only $200 remains before fixed costs and payment losses. Deterministic calculations should cost no model tokens; AI budgets need per-user caps and measured unit costs.

## Decision gates

Collect actual provider quote, test settlement/refund/payout statements, identify fee payer, calculate support cost and loss reserve, validate subscription payment lifecycle, then enable only reviewed pricing flags. Publish exact fee disclosure adjacent to each relevant confirmation. No fee or revenue is generated by the present demo.

## Verified fee administration follow-up

The official Docs MCP confirms legacy `POST /fee_markups` and permission `company:update_child_fees` for configurable payment/movement markups. See [monetization setup](monetization-setup.md) for the exact supported types, limits, operator tool and validation steps. This establishes a technical configuration mechanism, not a negotiated revenue-share contract. Interchange remains unverified. No fees have been activated.
