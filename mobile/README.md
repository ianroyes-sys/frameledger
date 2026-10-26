# FrameLedger for iOS

Native SwiftUI preview for iOS18+, with visible synthetic records and no live financial connection.

Open **FrameLedger.xcodeproj** → scheme **FrameLedger** → choose an iPhone simulator → Run.

- `FrameLedger/Sources`: native screens and read-only future API boundary.
- `FrameLedgerCore`: integer-money package with tests.
- `FrameLedgerUITests`: native creator journey.
- `screenshots`: actual simulator captures, generated from the UI test.

Run `swift test --package-path mobile/FrameLedgerCore` from the repository root. See [implementation and release gaps](../docs/mobile-implementation.md).

No account enrollment, paid services, production authentication, signing or App Store submission was performed. The app does not issue cards, collect payments or simulate a live connection.

## TestFlight preparation

See [internal TestFlight instructions](TESTFLIGHT.md) for the release script, exact bundle identifier, privacy manifest, signing requirements, and synthetic-data beta notes. The script supports local signed export or authorized upload using an existing Xcode account; release preparation alone does not mean Apple has received or distributed the build.
