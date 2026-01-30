#!/usr/bin/env bash
set -euo pipefail

RIPGREP_VERSION="14.1.1"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR_BIN="$ROOT/vendor/bin"

PLATFORMS=(
  "darwin-arm64:aarch64-apple-darwin"
  "darwin-x64:x86_64-apple-darwin"
  "linux-x64:x86_64-unknown-linux-musl"
  "linux-arm64:aarch64-unknown-linux-gnu"
  "windows-x64:x86_64-pc-windows-msvc"
)

echo "=== Downloading vendor binaries ==="
echo "ripgrep v${RIPGREP_VERSION}"
echo ""

for entry in "${PLATFORMS[@]}"; do
  PLATFORM="${entry%%:*}"
  RG_TARGET="${entry##*:}"

  DIR="$VENDOR_BIN/$PLATFORM"
  mkdir -p "$DIR"

  RG_BIN="$DIR/rg"
  EXT="tar.gz"
  if [[ "$PLATFORM" == windows-* ]]; then
    RG_BIN="$DIR/rg.exe"
    EXT="zip"
  fi

  if [[ -f "$RG_BIN" ]]; then
    echo "  ✓ $PLATFORM/rg (exists)"
    continue
  fi

  echo "  ↓ $PLATFORM/rg ..."
  RG_ARCHIVE="ripgrep-${RIPGREP_VERSION}-${RG_TARGET}"
  URL="https://github.com/BurntSushi/ripgrep/releases/download/${RIPGREP_VERSION}/${RG_ARCHIVE}.${EXT}"

  TMP_DIR=$(mktemp -d)
  trap "rm -rf $TMP_DIR" EXIT

  if [[ "$EXT" == "zip" ]]; then
    curl -fsSL "$URL" -o "$TMP_DIR/rg.zip"
    unzip -q "$TMP_DIR/rg.zip" -d "$TMP_DIR"
    cp "$TMP_DIR/${RG_ARCHIVE}/rg.exe" "$RG_BIN"
  else
    curl -fsSL "$URL" | tar -xz -C "$TMP_DIR"
    cp "$TMP_DIR/${RG_ARCHIVE}/rg" "$RG_BIN"
  fi

  chmod +x "$RG_BIN"
  echo "    ✓ done ($(du -h "$RG_BIN" | cut -f1))"
done

echo ""
echo "=== All vendor binaries downloaded ==="
echo "Location: $VENDOR_BIN"
ls -la "$VENDOR_BIN"/*/
