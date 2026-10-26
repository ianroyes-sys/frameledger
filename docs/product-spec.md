# FrameLedger product specification

Working brand, 2026-09-28. This describes intended V1 behavior and acceptance criteria; it is not a claim that all deployment gates or integrations have passed. See README and verification report for implementation status.

## Product goal and user

Run the financial side of your creative business from one place. Get paid, split your money, run your projects, know what you actually made. Start with solo photographers/videographers and small studios. The founder is a power user who invoices projects, hires crew, purchases gear, travels, pays recurring software bills and needs irregular cash-flow clarity.

The core object is a Project Wallet: a financial record of a job, not a bank account. Client → project → invoice → verified payment → allocation → expense → collaborator → profit. The differentiator is explainable project economics and commitments against real cash.

## V1 scope and pages

| Area          | Required behavior                                                                                                                                                                                                    |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview      | Safe-to-spend hero, actual settled balance, calculation breakdown, receivables, active projects, upcoming obligations, recent activity and action queue.                                                             |
| Projects      | Create from Wedding, Portrait, Commercial, Video, Content Retainer, Social Retainer, Design or Custom preset; record client/date/value, estimated costs, invoices, payments, expenses, crew commitments and margins. |
| Money         | Virtual reserve rules, exact per-payment allocations, settled/expected separation and 30/60/90-day outlook.                                                                                                          |
| Invoices      | Editable creator line items, due date and project linkage, separate retainer/final invoices, supported hosted payment experience and webhook-driven status.                                                          |
| Expenses      | Category, merchant, amount, project or overhead, notes, receipt status/file reference and export.                                                                                                                    |
| Clients       | Contact, project history, open invoices, collected revenue and financial notes.                                                                                                                                      |
| Collaborators | Role, agreed compensation, remaining commitment, payment history and external tax-document status only.                                                                                                              |
| Insights      | Actual versus projected job profitability, category totals, purchase-impact simulator and deterministic business questions.                                                                                          |
| Tax           | Configurable reserve percentage, reserve balance, income/expense organization and export. No personal liability calculation.                                                                                         |
| Cards         | Only provider-supported controls behind capability gates; unavailable functions clearly explained.                                                                                                                   |
| Settings      | Creator profile, preferences, provider connection status, allocation settings, export and visible demo reset.                                                                                                        |

## Financial rules

Money arithmetic uses integer USD cents. Mixed currencies are rejected in V1; future balances must remain per currency with explicit conversion provenance. Allocate each incoming amount exactly once, with deterministic remainder assignment. Reserve percentages use integer basis points and cannot exceed 100%. No percentage change retroactively rewrites prior entries.

Safe-to-spend = settled available provider funds − tax reserve − protected gear/other reserves − unpaid contractor commitments − remaining project cost commitments − scheduled obligations. Expenses already deducted from settled funds must not also remain full commitments. Match actual expense to its commitment or explicitly release the estimate. Preserve negative results and explain shortfall; do not clamp them silently to zero. Project allocations and expenses must never double-subtract the same obligation.

Project estimated profit = contracted project revenue − actual direct expenses − remaining direct commitments − expected payment fees. Actual closed-project profit = settled net project income − actual direct expenses − actual contractor payments. Tax reserve and gear savings are cash protection, not deductible project costs. Show an optional after-reserve figure separately. Unassigned Adobe subscription is business overhead and does not silently lower the wedding's direct margin. Zero-revenue margin displays a dash with explanation.

A successful checkout redirect is never proof of settled funds. Provider payment success and available balance are distinct events. Failed/pending payment does not increase safe-to-spend. Refunds/reversals create compensating records and release/reverse attributable allocations once; existing external obligations do not disappear. Provider reconciliation must detect gaps and stale state.

## Core journey

1. Sign in; complete provider verification when live. In demo, explicitly label synthetic verification/payment behavior.
2. Choose creator type, payment pattern, contractor use, tax percentage and gear reserve preference.
3. Create client and project with editable preset categories.
4. Create a retainer invoice with actual provider support or a demo invoice in isolated demo mode.
5. Client reviews project, line items, due date and fees before hosted payment.
6. Verified event links the payment to invoice/project. Settlement updates available cash; allocation ledger posts once.
7. Add contractor/travel commitments before paying. Attach actual expenses and receipts to the job.
8. Collect final balance, record verified contractor payment, reconcile/release remaining estimates and close the job.
9. Purchase simulator displays cash impact with no movement of money.

## Wedding acceptance example

No opening funds or processing fees in this isolated arithmetic example; live fees always reduce cash and profit according to actual provider records.

| Moment                                                                                 | Balance | Tax reserve | Gear reserve | Crew owed | Travel remaining | Safe to spend |
| -------------------------------------------------------------------------------------- | ------: | ----------: | -----------: | --------: | ---------------: | ------------: |
| $1,600 retainer settled                                                                |  $1,600 |        $400 |         $160 |      $450 |             $120 |          $470 |
| $67 fuel settles and consumes travel estimate; $58 Adobe overhead; $140 rental settles |  $1,335 |        $400 |         $160 |      $450 |              $53 |          $272 |
| Final $1,600 settles                                                                   |  $2,935 |        $800 |         $320 |      $450 |              $53 |        $1,312 |
| $450 crew payment settles                                                              |  $2,485 |        $800 |         $320 |        $0 |              $53 |        $1,312 |
| Close project and explicitly release unused $53 travel estimate                        |  $2,485 |        $800 |         $320 |        $0 |               $0 |        $1,365 |

Remaining invoice balance after retainer is $1,600. Final direct project profit is $3,200 − $450 − $67 − $140 = $2,543 (79.46875% margin), before provider fees, owner labor, taxes and business overhead. Overall business cash includes the additional $58 Adobe cost. A $2,400 lens simulation then results in safe-to-spend of −$1,035; it must communicate the protected-cash shortfall, not recommend borrowing. If fees exist these example figures change. Expected invoices appear separately and never cure today's settled-cash shortfall.

## Intelligence and financial autonomy

Deterministic computations answer totals, margins, receipts missing and collaborators owed without paid model calls. A provider-neutral language layer may explain validated aggregates with source record IDs and calculation steps. Financial actions require a specific user confirmation, current authorization and server validation; the AI itself never moves funds. Confirmation records should expire and bind recipient, amount, currency and purpose.

Additional product hypotheses from research: optional protected retainer/cancellation reserve; closeout checklist exposing unpaid crew/missing receipts/unreleased estimates; data freshness and reconciliation status; late-payment scenario that shifts expected invoices by 14/30 days. These improve decision quality without adding autonomous financial risk.

## Activation, analytics and permissions

Activation is verified meaningful revenue received, not onboarding completion. Track allowlisted events and coarse metadata only: signup, verification, project/invoice creation, invoice payment, first $500 received, allocation rule, expense categorization, project closed, collaborator added/paid and subscription started. No invoice descriptions, amounts, client names, emails or receipt data to third-party analytics. Require separate tenant membership checks for every object and operation; frontend plan gating is never authorization.

## Acceptance and testing

Unit: safe-to-spend, percentage rounding, zero/negative/mixed-currency rejection, profit, commitments, refund/reversal, duplicate and out-of-order events, failed payment, partial settlement and deleted project association. Integration: input validation, tenancy, signature rejection, idempotency, provider errors and reconciliation. E2E: isolated wedding journey, client invoice view, expense attachment, collaborator commitment and lens simulator. Inspect desktop/tablet/mobile, keyboard/focus, contrast, empty/loading/error/offline states. Keep unsupported financial buttons absent or visibly disabled with a specific reason.

## Not in V1

Legal contract generation, native mobile, credit/lending, yield promises, payroll, self-hosted tax-ID collection, full CRM/scheduling/gallery delivery, FX aggregation, autonomous money movement and unverified card features. Contracts and payment timing are chosen by the creator; legal enforceability is not inferred from templates.
