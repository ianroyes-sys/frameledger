# iPhone and App Store path

## Native implementation update

A SwiftUI iOS18+ app now exists in `mobile/`, with a simulator build and an explicitly synthetic evaluation experience. See [mobile implementation](mobile-implementation.md) for exact executed tests, screenshots and unimplemented production work. The earlier platform analysis below remains launch guidance; statements that no native project exists are historical. No signing enrollment, TestFlight upload, provider activation or App Store submission has occurred.

## Earlier planning review

Reviewed 2026-09-28 against official Apple documentation and the official Whop Docs MCP. This is an implementation plan, not an App Review decision or legal clearance. The current repository is a responsive web app; no native binary, signing configuration, TestFlight build, or App Store submission exists.

## Can this become an iPhone app?

Yes. Reuse the TypeScript financial domain and authenticated backend in a separate mobile client. The present Next.js UI does not automatically become native. Recommended sequence: verify the web financial loop, run a private pilot, then build the iPhone experience.

### Apple rules that affect the plan

- **3.2.1(viii):** money-management services should be submitted by the financial institution performing them, with necessary permissions in each offered jurisdiction.
- **5.1.1(ix):** financial services and sensitive-information apps should come from the service-providing legal entity, not an individual developer.
- **4.2:** a repackaged website alone can fail minimum functionality review.
- **3.1.3(e):** payment for a wedding shoot consumed outside the app uses external payment methods.
- **3.1.1:** digital Pro feature upgrades generally require in-app purchase unless an exception applies. US storefront external-link rules differ; do not assume worldwide parity.
- **3.1.3(f):** a free companion to a paid web tool can qualify without IAP when there are no in-app purchases or external purchase calls to action.

Source: [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/).

Our interpretation: these rules do not establish a universal bank-charter requirement for every bookkeeping app. They also do not establish that an LLC plus Whop credentials is sufficient. Have Whop and qualified counsel confirm the exact service model, permitted branding, territories, and submitting entity; seek App Review guidance with that written arrangement. Calling the product a financial workspace does not remove requirements triggered by its actual functions.

Keep creator-service payments and FrameLedger software subscriptions as separate billing flows. A photography deposit is not the same purchase as unlocking cash-flow forecasts. Digital content sales or other future invoice types need separate classification. Our proposed first mobile release is a free companion for existing users, without upgrade purchasing or upgrade links; validate eligibility before committing to that business model.

## Enrollment and publication work

Enroll the approved operating entity in the Apple Developer Program. Organization enrollment requires a legal entity, D-U-N-S number (with Apple's government exception), an authorized account holder, domain-associated work email, and a functioning company website. A DBA alone is insufficient. Apple lists membership at **US$99 per year**, subject to regional pricing. No membership purchase is included in this build. [Apple enrollment requirements](https://developer.apple.com/programs/enroll/).

Build deletion initiation into account settings before submission. Explain what records must be retained and why; deleting access must not silently erase required financial records or imply remaining funds disappeared. Apple allows additional support steps in regulated industries and permits a disclosed manual processing period. Account deletion and subscription cancellation need separate handling. [Apple account deletion guidance](https://developer.apple.com/support/offering-account-deletion-in-your-app/).

Prepare a data inventory covering Supabase, Whop, receipts, diagnostics and any future analytics/AI vendor. App Store privacy responses include relevant third-party collection; hosted payment fields do not eliminate disclosure of the financial context our own backend stores. Review SDK privacy manifests alongside the final native dependency list. [Apple privacy details](https://developer.apple.com/app-store/app-privacy-details/).

## Verified Whop mobile compatibility

The official [Elements getting-started documentation](https://docs.whop.com/elements/latest/getting-started) was read through `https://docs.whop.com/mcp` using `query_docs_filesystem_whop_docs`, file `elements/latest/getting-started.mdx`.

| Path               | Documented requirements / scope                                                                                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React Native       | `@whop/elements-react-native`; React Native 0.87+ with Swift Package Manager or 0.86+ with CocoaPods; Fabric enabled; React 19.2.3+; iOS 15.1+; Android minSdk 24 / compileSdk 37 |
| Swift              | Swift Package Manager; iOS 18+ and Swift 6.0 for the documented account Elements path                                                                                             |
| Listed RN surfaces | Payment, address, card, card fields, email, tax ID, branding, and express checkout Elements                                                                                       |
| Server boundary    | API keys remain server-side; short-lived scoped access tokens go to the client                                                                                                    |

The page discusses Expo's CocoaPods linkage, but this is not proof that any particular released Expo SDK meets the React Native minimum. Select a compatible version only after a clean device-build spike. Do not upgrade the existing web app to chase native SDK versions. Payment Elements support is not proof that native KYC, card-management and balance Elements have identical coverage. Verify each needed surface and use documented hosted flows where appropriate.

The RN payment guide specifies a hosted HTTPS return URL for redirects and 3D Secure; custom schemes are not accepted for that payment parameter. Verify return behavior on physical devices before accepting customer payments. No native compatibility test has been executed in this repository.

## Proposed mobile scope and release gates

1. Extract reusable domain types/calculations into a package without browser dependencies; preserve existing tests. Keep money mutations, reconciliation and secrets in the backend.
2. Build native overview, projects, invoice status, receipt camera/upload and purchase simulation. Add accessible navigation, biometric session unlock backed by secure credential storage, and opt-in notifications without sensitive lock-screen amounts.
3. Validate Whop Elements on physical iPhones: interrupted network, canceled verification, payment redirects, expired tokens, duplicate taps and account switching. Keep unapproved financial capabilities unavailable.
4. Implement account deletion, privacy/support screens, production authentication recovery, and a documented billing design. Test permissions, VoiceOver and large text.
5. Prepare the submitting entity's provider authorization and territory evidence, working backend, reviewer access, privacy answers, screenshots and support URL.
6. Use [TestFlight](https://developer.apple.com/testflight/) for a controlled beta before public submission. Treat approval as an external gate, not an outcome guaranteed by passing local tests.

Native receipts, useful notifications and secure session handling are proposed product improvements; none are claimed as implemented in the web repository.
