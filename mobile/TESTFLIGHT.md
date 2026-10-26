# Internal TestFlight release

This build is a synthetic-data design evaluation, version **0.1.0 (1)**, bundle identifier `com.royzmediagroup.frameledger.preview`. It has no live account login, card issuing, payment collection, analytics SDK, or external data collection. It is not a financial service launch.

## Prepared release configuration

- iOS 18+, iPhone and iPad; Release device archive configuration.
- Automatic device signing; simulator signing remains disabled.
- App icon and display name included.
- `PrivacyInfo.xcprivacy` declares app-local UserDefaults usage (`CA92.1`) for the purchase simulator value. No tracking or collected data is declared for this build.
- `ITSAppUsesNonExemptEncryption = NO`: the current app has no custom cryptography or third-party SDKs; its future API boundary uses Apple's URLSession HTTPS. Reassess when integrations change.
- Internal TestFlight only, with explicit build numbers. An unsigned archive is a compile check, not an installable or uploaded build.

## Account requirements

Use an active Apple Developer Program team with App Store Connect access. Sign that account into **Xcode → Settings → Accounts**. An Apple ID or free Personal Team alone cannot distribute through TestFlight. This script does not enroll, purchase, accept new terms, or store credentials.

In App Store Connect, the app record must use this exact bundle identifier. Use Royz Media Group LLC only where the selected enrolled account's legal entity is actually that company; a project label cannot change Apple's registered seller entity. App record name, SKU, beta contact details, and internal tester membership are account setup fields, not invented release credentials.

## Release command

From the repository root, with the real ten-character team ID and an unused positive build number:

```sh
bash mobile/scripts/testflight.sh export TEAM_ID BUILD_NUMBER
# Authorized upload (also creates a new signed archive):
bash mobile/scripts/testflight.sh upload TEAM_ID BUILD_NUMBER
```

Replace the placeholders. The export mode produces a local distribution IPA. The upload mode sends the archive to App Store Connect. Xcode may create signing assets through automatic provisioning. Both modes require account access; output goes to ignored `mobile/build/` in a new timestamped directory. Never commit signing files or API keys.

After upload, inspect Apple's processing result and select the processed build for an internal tester group. Do not call an upload receipt a completed distribution. This internal-only archive cannot later become an external TestFlight or App Store release; create a separately reviewed release configuration for that audience.

## Beta notes

> FrameLedger is a financial workspace for creative businesses. This early evaluation uses synthetic records only. Explore safe-to-spend explanations, project wallets, invoices, and the purchase-impact simulator. Please check navigation, readability, small-screen layouts, and whether project costs and reserves are easy to understand. No real money moves and no sign-in is required.

## Verification

The release script syntax and privacy manifest are validated locally. Device archive evidence is recorded in the task handoff; Apple upload and processing must be verified separately. Existing simulator tests cover the main creator journey and money calculations.

## Sources checked September 28, 2026

- [Apple required API reasons](https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacyaccessedapitypes/nsprivacyaccessedapitypereasons): CA92.1 applies to information accessible only to this app.
- [Apple encryption export guidance](https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations): OS-provided HTTPS typically qualifies for the exempt flag; no custom cryptography is present.
- Installed `xcodebuild -help`: confirmed `app-store-connect`, `destination=upload`, `teamID`, `signingStyle`, explicit build number control, and `testFlightInternalTestingOnly` keys.
