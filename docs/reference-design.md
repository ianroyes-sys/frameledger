# Reference-led redesign — 2026-09-28

The founder rejected the light green redesign as too flat and provided seven Pinterest pins. All seven public preview images were retrieved and visually inspected. The standard web reader could not access Pinterest; public page metadata supplied each image URL. Reference images were kept temporarily outside the repository and are not shipped in the product. The implementation uses original CSS artwork and native SwiftUI surfaces.

## Observations and decisions

| Reference                                                                         | Observed direction                                                            | Applied lesson                                                                                                                               |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| [Mobile neobank](https://www.pinterest.com/pin/19210735906191301/)                | Black canvas, neon accent, large balance, compact action tiles, textured card | Strong cash hierarchy and tactile action tiles. No fabricated card number, network, issuance or growth metric.                               |
| [Game account screen](https://www.pinterest.com/pin/597571444346451017/)          | Luminous blue hero, translucent overlapping surfaces, clear account controls  | Depth through controlled lighting and layered borders. Gambling mechanics, trophies and bonus balances are not product features.             |
| [Financial dashboard concept](https://www.pinterest.com/pin/1145673592729436980/) | Violet/orange hero over dark compact panels                                   | Accent concentrated around the balance and meaningful actions. No guaranteed returns, referral earning claim or invented investment product. |
| [Banking UX](https://www.pinterest.com/pin/589408670030087687/)                   | Overlapping wallet surfaces, muted dark background, floating navigation       | Original overlapping frames and a floating labeled mobile navigation bar.                                                                    |
| [FinancePro concept](https://www.pinterest.com/pin/1147010598885532164/)          | Violet light, dark cards, generous large numbers                              | Violet material system shared by native and web; no decorative time-series chart pretending to show real history.                            |
| [Neo banking app](https://www.pinterest.com/pin/370350769379395888/)              | Iridescent card surfaces, clear balance contrast, mobile actions              | Layered, restrained light and solid numerical contrast; avoid copying branded layouts and issuer marks.                                      |
| [Crypzone concept](https://www.pinterest.com/pin/578853358390388528/)             | Glowing top surface, rounded action controls, compact transaction rows        | Strong visual hierarchy and compact mobile controls. Crypto trading/swaps are not added.                                                     |

These are visual observations, not evidence of usable or compliant financial products. We retain explicit settled/expected balances, virtual reserve disclosures, confirmation flows and synthetic-mode labeling.

## Implemented direction

Charcoal canvas, raised slate panels, luminous violet balance surface, original overlapping rounded frames, lavender primary actions, subtle border highlights and dimensional project covers. The desktop retains an efficient financial workspace; mobile uses four labeled action tiles and floating primary navigation. The requested depth comes from light, overlapping shapes and surface hierarchy, not motion behind financial data.

Web artwork is decorative CSS with `aria-hidden`; no reference image or proprietary card design is copied. Native SwiftUI uses system typography and independently implemented gradients/materials.

## Verification

Web:129 tests and54 browser tests passed; production build, lint and typecheck passed.42 responsive screen states passed overflow/runtime checks and automated WCAG A/AA checks. These automated checks are not a complete screen-reader audit. Native build/test evidence and limitations are in [mobile implementation](mobile-implementation.md).
