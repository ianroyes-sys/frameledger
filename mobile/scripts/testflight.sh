#!/bin/bash
set -euo pipefail
# Uses the account already signed in through Xcode. Never accepts a password.
# export creates a local IPA; upload sends this demo build to App Store Connect.
mode="${1:-export}"
team="${2:-}"
build="${3:-1}"
if [[ "$mode" != export && "$mode" != upload ]] || [[ ! "$team" =~ ^[A-Z0-9]{10}$ ]] || [[ ! "$build" =~ ^[1-9][0-9]*$ ]]; then
  echo 'Usage: bash mobile/scripts/testflight.sh export|upload APPLE_TEAM_ID BUILD_NUMBER' >&2
  exit 2
fi
root="$(cd "$(dirname "$0")/.." && pwd)"
release="$root/build/testflight-$build-$(date -u +%Y%m%dT%H%M%SZ)-$$"
mkdir -p "$release"
umask 077
cat > "$release/ExportOptions.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>method</key><string>app-store-connect</string>
<key>destination</key><string>$mode</string>
<key>teamID</key><string>$team</string>
<key>signingStyle</key><string>automatic</string>
<key>manageAppVersionAndBuildNumber</key><false/>
<key>uploadSymbols</key><true/>
<key>testFlightInternalTestingOnly</key><true/>
</dict></plist>
PLIST
xcodebuild -project "$root/FrameLedger.xcodeproj" -scheme FrameLedger \
  -configuration Release -destination 'generic/platform=iOS' \
  -archivePath "$release/FrameLedger.xcarchive" \
  -derivedDataPath "$release/DerivedData" -allowProvisioningUpdates \
  DEVELOPMENT_TEAM="$team" CURRENT_PROJECT_VERSION="$build" \
  CODE_SIGNING_ALLOWED=YES CODE_SIGN_STYLE=Automatic archive
xcodebuild -exportArchive -archivePath "$release/FrameLedger.xcarchive" \
  -exportOptionsPlist "$release/ExportOptions.plist" \
  -exportPath "$release/export" -allowProvisioningUpdates
printf '\nFinished %s. Release artifacts: %s\n' "$mode" "$release"
printf 'Verify processing and internal group availability in App Store Connect before calling this distributed.\n'
