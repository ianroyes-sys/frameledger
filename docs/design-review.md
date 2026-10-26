# Design overhaul — September 28, 2026

The light studio direction recorded below was subsequently rejected by the founder and replaced by the [reference-led dark redesign](reference-design.md). Current screenshots reflect the latest dark implementation. Native work is tracked in [mobile implementation](mobile-implementation.md).

## Implemented

Replaced the lavender financial dashboard with a studio-oriented design system: self-hosted Instrument Sans and DM Mono, cool paper/forest palette, custom frame wordmark/favicon, project-type artwork, larger cash figures, open metrics band, quieter navigation, refreshed project/payment/forms/dialog surfaces, and a split sign-in composition. Updated all existing workspace sections through a consistent shared CSS system.

Added a real command menu: Cmd/Ctrl+K, project/client and invoice lookup, page navigation, ArrowUp/ArrowDown and Enter, Escape, focus restoration, empty results and invoice filtering. No AI call or financial action is involved. Safari mobile testing identified platform-dependent Tab behavior; explicit arrow navigation resolves it.

Replaced an artificial seven-slot cash chart with proportional recorded inflow/outflow bars. Underlying money calculations and provider gates remain unchanged. Payment display now avoids a misleading negative zero on unpaid invoices.

## Verification

- 129 unit/integration/component/database tests passed.
- 54 E2E tests passed across desktop Chromium, mobile Chromium and mobile WebKit, including the complete wedding flow, financial confirmation, responsive accessibility and new search cases.
- Production build, TypeScript and ESLint passed.
- Screenshots and automated overflow/page-error inspection span14 states ×3 viewports:1440,834 and390px. Sign-in was also inspected at1440 and390px without logging in.
- Expanded axe checks cover those workspace states. First pass found contrast issues in two decorative project serials; a solid paper backing was added. Final pass:42 states, zero horizontal overflows, zero page errors and zero automated WCAG A/AA findings. Machine-readable results are in `screenshots/redesign/inspection.json`.
- Fonts are self-hosted with OFL licenses. No external font fetch is required by visitors or builds.

## Review artifacts

[Before](screenshots/redesign-before.png) · [Overview](screenshots/redesign/desktop-overview.png) · [Projects](screenshots/redesign/desktop-projects.png) · [Mobile](screenshots/redesign/mobile-overview.png) · [Sign-in](screenshots/redesign/desktop-signin.png) · [Search](screenshots/redesign/desktop-search.png)

Local synthetic preview: `http://127.0.0.1:3217` while the preview process is running. Reproduce screenshots with `node scripts/design-review.mjs` against a freshly built demo server on that port; `DESIGN_REVIEW_ORIGIN` can select another localhost port.

## Limits and deployment status

This is implemented and locally verified. An objective claim of “best of any neobank” would require comparative user research. Automated accessibility is not a complete screen-reader audit. Card issuance, live provider behavior and commercial readiness are separate from the redesign.

No hosting upgrade or public deployment occurred during this work. The earlier Vercel staging secret-export approval is still pending; design work does not assume that approval. Supabase/Whop account settings were not changed.
