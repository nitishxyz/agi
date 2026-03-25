#!/usr/bin/env bash
set -euo pipefail

# Build, sign, and notarize the otto canvas app locally.
#
# Prerequisites (macOS):
#   1. Apple Developer Certificate installed in Keychain
#   2. Create .env.desktop-signing with:
#        APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
#        APPLE_ID="your@email.com"
#        APPLE_PASSWORD="app-specific-password"
#        APPLE_TEAM_ID="TEAMID"
#        TAURI_SIGNING_PRIVATE_KEY="...optional updater key..."
#        TAURI_SIGNING_PRIVATE_KEY_PASSWORD="...optional updater key password..."
#   3. Initialize vendor/ghostty:
#        git submodule update --init --recursive vendor/ghostty
#   4. Rust + Tauri CLI + Zig installed
#
# Usage:
#   ./scripts/build-canvas-release.sh
#   ./scripts/build-canvas-release.sh --universal
#   ./scripts/build-canvas-release.sh --skip-cli
#   ./scripts/build-canvas-release.sh --skip-ghostty

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env.desktop-signing"

UNIVERSAL=false
SKIP_CLI=false
SKIP_GHOSTTY=false
OPTIMIZE="${OTTO_CANVAS_LIBGHOSTTY_VT_OPTIMIZE:-ReleaseFast}"

for arg in "$@"; do
  case "$arg" in
    --universal) UNIVERSAL=true ;;
    --skip-cli) SKIP_CLI=true ;;
    --skip-ghostty) SKIP_GHOSTTY=true ;;
    --help|-h)
      echo "Usage: $0 [--universal] [--skip-cli] [--skip-ghostty]"
      exit 0
      ;;
  esac
done

if [[ "$(uname)" != "Darwin" ]]; then
  echo "Error: This script only supports macOS canvas release builds."
  exit 1
fi

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck source=/dev/null
  source "$ENV_FILE"
fi

: "${APPLE_SIGNING_IDENTITY:?Set APPLE_SIGNING_IDENTITY in $ENV_FILE or env}"
: "${APPLE_ID:?Set APPLE_ID in $ENV_FILE or env}"
: "${APPLE_PASSWORD:?Set APPLE_PASSWORD in $ENV_FILE or env}"
: "${APPLE_TEAM_ID:?Set APPLE_TEAM_ID in $ENV_FILE or env}"

GHOSTTY_SOURCE_DIR="${OTTO_CANVAS_GHOSTTY_SOURCE_DIR:-$ROOT/vendor/ghostty}"

if [[ "$SKIP_GHOSTTY" == false && ! -d "$GHOSTTY_SOURCE_DIR" ]]; then
  echo "Error: Ghostty source not found at $GHOSTTY_SOURCE_DIR"
  echo "Run: git submodule update --init --recursive vendor/ghostty"
  exit 1
fi

echo "=== Otto Canvas Release Build ==="
echo "Signing identity: $APPLE_SIGNING_IDENTITY"
echo "Team ID:          $APPLE_TEAM_ID"
echo "Universal:        $UNIVERSAL"
echo "Ghostty source:   $GHOSTTY_SOURCE_DIR"
echo "Optimize:         $OPTIMIZE"
echo ""

ARCH="$(uname -m)"
if [[ "$ARCH" == "arm64" ]]; then
  CURRENT_TARGET="aarch64-apple-darwin"
else
  CURRENT_TARGET="x86_64-apple-darwin"
fi

TARGETS=("$CURRENT_TARGET")
if [[ "$UNIVERSAL" == true ]]; then
  TARGETS=("aarch64-apple-darwin" "x86_64-apple-darwin")
fi

export APPLE_SIGNING_IDENTITY
export APPLE_ID
export APPLE_PASSWORD
export APPLE_TEAM_ID
export TAURI_SIGNING_PRIVATE_KEY="${TAURI_SIGNING_PRIVATE_KEY:-}"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:-}"

for TARGET in "${TARGETS[@]}"; do
  echo ""
  echo "--- Building Otto Canvas for target: $TARGET ---"
  CMD=(bun run scripts/build-canvas.ts --sign --target "$TARGET" --optimize "$OPTIMIZE")
  if [[ "$SKIP_CLI" == true ]]; then
    CMD+=(--skip-cli)
  fi
  if [[ "$SKIP_GHOSTTY" == true ]]; then
    CMD+=(--skip-ghostty)
  else
    CMD+=(--ghostty-source "$GHOSTTY_SOURCE_DIR")
  fi
  (cd "$ROOT" && "${CMD[@]}")
done

BUNDLE_DIR="$ROOT/apps/canvas/src-tauri/target/$CURRENT_TARGET/release/bundle"

echo ""
echo "=== Canvas build complete ==="
echo ""
echo "Output:"
if [[ -d "$BUNDLE_DIR/dmg" ]]; then
  echo "  DMG: $(ls "$BUNDLE_DIR/dmg/"*.dmg 2>/dev/null || echo 'none')"
fi
if [[ -d "$BUNDLE_DIR/macos" ]]; then
  echo "  App: $(ls "$BUNDLE_DIR/macos/"*.app.tar.gz 2>/dev/null || echo 'none')"
fi

echo ""
echo "Otto Canvas artifacts are ready in apps/canvas/src-tauri/target/."
