#!/usr/bin/env bash
set -euo pipefail

# Build, sign, and notarize the AGI desktop app locally.
#
# Prerequisites (macOS):
#   1. Apple Developer Certificate installed in Keychain
#   2. Create .env.desktop-signing with:
#        APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
#        APPLE_ID="your@email.com"
#        APPLE_PASSWORD="app-specific-password"
#        APPLE_TEAM_ID="TEAMID"
#   3. Rust + Tauri CLI installed
#
# Usage:
#   ./scripts/build-desktop-release.sh               # Build for current arch
#   ./scripts/build-desktop-release.sh --universal    # Build universal (arm64+x64)
#   ./scripts/build-desktop-release.sh --skip-notarize  # Sign only, skip notarization
#   ./scripts/build-desktop-release.sh --skip-cli     # Skip CLI binary rebuild

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DESKTOP_DIR="$ROOT/apps/desktop"
CLI_DIR="$ROOT/apps/cli"
BINARIES_DIR="$DESKTOP_DIR/src-tauri/resources/binaries"
ENV_FILE="$ROOT/.env.desktop-signing"

UNIVERSAL=false
SKIP_NOTARIZE=false
SKIP_CLI=false

for arg in "$@"; do
  case "$arg" in
    --universal) UNIVERSAL=true ;;
    --skip-notarize) SKIP_NOTARIZE=true ;;
    --skip-cli) SKIP_CLI=true ;;
    --help|-h)
      echo "Usage: $0 [--universal] [--skip-notarize] [--skip-cli]"
      exit 0
      ;;
  esac
done

if [[ "$(uname)" != "Darwin" ]]; then
  echo "Error: This script only supports macOS builds with signing/notarization."
  exit 1
fi

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck source=/dev/null
  source "$ENV_FILE"
fi

: "${APPLE_SIGNING_IDENTITY:?Set APPLE_SIGNING_IDENTITY in $ENV_FILE or env}"
: "${APPLE_ID:?Set APPLE_ID in $ENV_FILE or env}"
: "${APPLE_PASSWORD:?Set APPLE_PASSWORD (app-specific password) in $ENV_FILE or env}"
: "${APPLE_TEAM_ID:?Set APPLE_TEAM_ID in $ENV_FILE or env}"

echo "=== AGI Desktop Release Build ==="
echo "Signing identity: $APPLE_SIGNING_IDENTITY"
echo "Team ID:          $APPLE_TEAM_ID"
echo "Universal:        $UNIVERSAL"
echo "Notarize:         $([[ $SKIP_NOTARIZE == true ]] && echo 'no' || echo 'yes')"
echo ""

ARCH="$(uname -m)"
if [[ "$ARCH" == "arm64" ]]; then
  CURRENT_TARGET="aarch64-apple-darwin"
  CURRENT_PLATFORM="darwin-arm64"
else
  CURRENT_TARGET="x86_64-apple-darwin"
  CURRENT_PLATFORM="darwin-x64"
fi

if [[ "$SKIP_CLI" == false ]]; then
  echo "--- Building CLI binary ($CURRENT_PLATFORM) ---"
  mkdir -p "$BINARIES_DIR"
  cd "$CLI_DIR"
  bun run prebuild
  bun build --compile --minify --target="bun-$CURRENT_PLATFORM" ./index.ts --outfile "dist/agi-$CURRENT_PLATFORM"
 cp "dist/agi-$CURRENT_PLATFORM" "$BINARIES_DIR/agi-$CURRENT_PLATFORM"
  chmod +x "$BINARIES_DIR/agi-$CURRENT_PLATFORM"

 echo "--- Signing CLI binary with hardened runtime ---"
  ENTITLEMENTS="$DESKTOP_DIR/src-tauri/resources/entitlements.plist"
  codesign --force --options runtime --timestamp \
    --sign "$APPLE_SIGNING_IDENTITY" \
    --entitlements "$ENTITLEMENTS" \
    "$BINARIES_DIR/agi-$CURRENT_PLATFORM"
 echo "CLI binary signed and ready."
fi

echo ""
echo "--- Building Tauri app ---"
cd "$DESKTOP_DIR"

export APPLE_SIGNING_IDENTITY
export APPLE_ID
export APPLE_PASSWORD
export APPLE_TEAM_ID

TARGETS=("$CURRENT_TARGET")
if [[ "$UNIVERSAL" == true ]]; then
  TARGETS=("aarch64-apple-darwin" "x86_64-apple-darwin")
fi

for TARGET in "${TARGETS[@]}"; do
  echo ""
  echo "--- Building for target: $TARGET ---"
  npm run tauri build -- --target "$TARGET"
done

BUNDLE_DIR="$DESKTOP_DIR/src-tauri/target/$CURRENT_TARGET/release/bundle"

if [[ "$SKIP_NOTARIZE" == true ]]; then
  echo ""
  echo "=== Build complete (notarization skipped) ==="
else
  echo ""
  echo "=== Build + notarization complete ==="
fi

echo ""
echo "Output:"
if [[ -d "$BUNDLE_DIR/dmg" ]]; then
  echo "  DMG: $(ls "$BUNDLE_DIR/dmg/"*.dmg 2>/dev/null || echo 'none')"
fi
if [[ -d "$BUNDLE_DIR/macos" ]]; then
  echo "  App: $(ls "$BUNDLE_DIR/macos/"*.app.tar.gz 2>/dev/null || echo 'none')"
fi

echo ""
echo "Share the .dmg file — it's signed and notarized, ready for distribution."
