# Native iOS implementation

Built 2026-09-28. This is a real SwiftUI iPhone/iPad application, not a web wrapper. It is an explicitly synthetic native preview, not a live financial client or submitted App Store product.

## Run

Open `mobile/FrameLedger.xcodeproj`, select the shared **FrameLedger** scheme and an iPhone simulator, then Run. Minimum deployment target is iOS 18. A local simulator build does not require paid enrollment or signing. The preview bundle ID is `com.royzmediagroup.frameledger.preview`; confirm the permanent identifier before device distribution.

```sh
swift test --package-path mobile/FrameLedgerCore
xcodebuild -project mobile/FrameLedger.xcodeproj -scheme FrameLedger \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath mobile/.build CODE_SIGNING_ALLOWED=NO build
```

For UI tests use `-destination 'platform=iOS Simulator,name=FrameLedger Design Preview' test`. Generated derived data and user Xcode state are ignored. The checked-in project runs without Ruby tooling. If changing target membership, `ruby mobile/scripts/generate-project.rb` regenerates it using the already-installed `xcodeproj` Ruby gem.

## Implemented

- Native tab navigation, dimensional dark/violet overview, original overlapping-frame icon.
- Dominant Safe to Spend, actual recorded balance, explainable reserve/commitment sheet.
- Three synthetic creative projects and financial detail including expected profit before owner labor/tax/overhead.
- Paid/deposit/final invoice status screen. No fake Send action.
- Interactive purchase-impact simulator with exact integer minor-unit arithmetic and explicit deficit states. Purchase input persists in local app preferences; it never changes balances.
- Visible synthetic indicators and explicit unavailable live connection status.
- Read-only HTTPS API boundary targeting the existing authenticated `/api/workspace?businessId=...` route. It requires a short-lived user access token supplied by a future secure authentication layer. It is **not connected to the demo UI** and has not been verified against a live deployment.
- Three Swift Testing calculation tests (scenario, decimal parsing, negative/zero/overflow), plus native XCUITest journey.

## Data boundary

Native records are an independent immutable synthetic scenario. Web demo/localStorage and native demo are not synced. No secret, account credentials, banking information, analytics SDK, card data, or KYC documents are embedded. No money-moving native API exists. No “issue card” control is shown.

The Swift arithmetic package models the demonstrated scenario, not the full web domain. Before live use, decode the backend's actual state schema, implement and test financial parity across refund/reversal/fees/pending expenses, and ideally have the backend return canonical computed summaries. Do not substitute native demo totals for live amounts. Current app is USD-only.

## Why SwiftUI

Installed Xcode 26.6 / Swift 6.3.3 and iOS 26.5 simulators allow native builds immediately. The web stack is untouched. Official Whop Elements documentation currently documents SwiftUI/SPM support on iOS18+/Swift6; its RN path requires RN0.86+ with CocoaPods (Expo) or RN0.87+ with SPM. We did not upgrade or assume Expo compatibility. No Whop SDK was added because no live authenticated financial surface is enabled.

Sources checked 2026-09-28:

- [Whop Elements official getting started](https://docs.whop.com/elements/latest/getting-started): SwiftUI support, platform floor, token boundary; documented SPM package `whopsdk-elements-swift` from0.1.12. This is documented compatibility, not a completed SDK integration test.
- [Expo SDK reference](https://docs.expo.dev/versions/latest/): separate native ecosystem; no dependency upgrade required for this approach.
- [Apple SwiftUI documentation](https://developer.apple.com/documentation/swiftui/): native app/view framework.

## Remaining before live/TestFlight

1. Secure Supabase session lifecycle and Keychain storage, recovery/logout/account deletion, authenticated API state decoder, backend-derived summaries and stale-data handling. Review redirect handling and prevent user tokens following untrusted cross-origin redirects before enabling the API adapter.
2. Provider permissions and terms, exact Whop native SDK build/device compatibility, tokens, hosted verification/payment redirects, confirmation and idempotency tests.
3. Receipt capture/upload, transaction history, notification privacy and offline error experience. These are not implemented in this preview.
4. Full VoiceOver/Dynamic Type/contrast/device matrix, automated network error tests, privacy manifest and data inventory. Native semantics and scrollable layouts are in place; a formal accessibility audit has not been completed.
5. Entity enrollment/signing, permissions/territory review, privacy/support URLs, reviewer access, TestFlight and App Review. No membership purchased or app published.

See `docs/app-store-path.md` for the publication/compliance path. This document supersedes its earlier statement that no native binary exists.

## Executed verification

On 2026-09-28, Xcode simulator build succeeded, **3 Swift Testing tests passed**, and **1 XCUITest journey passed** (overview → $2,400 purchase → -$1,930 available → reserve breakdown → Johnson Wedding $2,630 estimated profit → invoice status → live connection unavailable). `swift-format` lint passed on native implementation/UI-test sources. Dedicated simulator: FrameLedger Design Preview, iPhone17Pro / iOS26.5. No physical-device run was performed.

Screenshots exported from the successful native XCUITest and visually inspected:

- `mobile/screenshots/ios-overview.png`
- `mobile/screenshots/ios-project-detail.png`
- `mobile/screenshots/ios-purchase-simulator.png`

Xcode result bundle (local ignored artifact): `mobile/.build/Logs/Test/Test-FrameLedger-2026.09.28_17-24-41--0500.xcresult`.
