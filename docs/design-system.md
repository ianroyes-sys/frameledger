# FrameLedger — night studio design system

Updated2026-09-28 from the founder’s seven visual references. The light green direction is superseded. [Reference analysis](reference-design.md) records what was observed and applied.

## Product and visual direction

Financial workspace for independent creatives. Money remains linked to projects and obligations. Visual identity: a dark studio, illuminated wallet surfaces, precise type, original layered-frame artwork, tactile controls and quiet data panels. FrameLedger is still a working name, not a cleared trademark or bank charter.

## Tokens

| Role             | Value                                         |
| ---------------- | --------------------------------------------- |
| Canvas           | `#090a10`                                     |
| Base surface     | `#13151c`                                     |
| Elevated surface | `#1c1e29`                                     |
| Main text        | `#f5f4fb`                                     |
| Secondary text   | `#a4a6b8`                                     |
| Accent           | `#b49aff`                                     |
| Primary button   | Violet gradient with white label              |
| Success          | `#91dfbc`, with status text                   |
| Warning          | `#f3c681`, with explanatory text              |
| Danger           | `#ffa59c`, with consequence/confirmation text |
| Borders          | Slate/violet, stronger on inputs and overlays |

Hero surface combines violet lighting with dark gradients; keep the number and labels in front of decorative artwork. Reserve colors are accompanied by labels. Never use a color or decorative card as evidence of an account, card issuance or guaranteed funds.

## Type and material

Web: locally bundled Instrument Sans400–700 and DM Mono400; OFL licenses in `public/fonts`. Native: system SwiftUI typography. No third-party font request from visitors.

Page headings28–37px, balance56–75px with tabular digits, section headings17–22px, body12–16px, utility labels9–11px. Mobile inputs16px. Amounts retain proper currency and negative values; zero never receives a decorative minus sign.

Panels18–24px radius, action tiles16px, inputs11px, mobile navigation25px. Use fine inner highlights and modest shadows to separate surfaces. The balance artwork is three original overlapping frames, not a payment card. Project illustrations vary by category without pretending to be uploaded client photographs.

## Interaction and layout

Overview: title, four functional quick actions, Safe to Spend with actual balance, recorded movement comparison, obligations/reserves, active projects and attention items. Cash movement bars compare recorded totals; there is no artificial timeline.

Desktop has a stable sidebar and global search. Cmd/Ctrl+K searches actual project/client names, invoices and pages. Arrow keys navigate; Enter opens; Escape dismisses and restores focus. No financial action executes from search.

Mobile has large action tiles and a floating, labeled navigation bar. Sheets preserve focus trapping, keyboard dismissal and confirmations. All sections use the same dark components, including payment, sign-in, errors and empty states. Financial functionality/gates are independent of appearance.

Motion: short180ms transitions and dialog entry only; honor reduced motion. Do not animate numerical money values or fabricate activity.

## Trust and accessibility

Actual balance, virtual reserves, expected receivables and stale data remain distinguishable. Project profit excludes owner labor, tax and overhead. Demo mode remains explicit. Hosted provider fields remain provider-controlled; never render sensitive card details ourselves.

Automated WCAG checks, keyboard tests and narrow-screen review accompany each major change. Automated checks supplement human assistive-technology and real-user review; no unsupported claim of industry-best UX.

[Current verification](reference-design.md) · [iOS implementation](mobile-implementation.md)
