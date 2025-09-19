#!/usr/bin/env sh
set -e

# AGI installer (downloads GitHub release binary)
# Usage: curl -fsSL https://install.agi.nitish.sh | sh
# Optional: AGI_VERSION=v0.1.8 curl -fsSL https://install.agi.nitish.sh | sh

REPO="nitishxyz/agi"
BIN_NAME="agi"
VERSION="${AGI_VERSION:-latest}"

info() { printf "\033[1;34m[i]\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m[!]\033[0m %s\n" "$*"; }
err()  { printf "\033[1;31m[x]\033[0m %s\n" "$*" 1>&2; }

# Detect downloader
http_get() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$1"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO- "$1"
  else
    err "Need 'curl' or 'wget' to download binaries"
    exit 1
  fi
}

http_down() {
  dest="$2"
  if command -v curl >/dev/null 2>&1; then
    curl -fL --progress-bar -o "$dest" "$1"
  else
    wget -qO "$dest" "$1"
  fi
}

# OS/arch detection
uname_s=$(uname -s 2>/dev/null || echo unknown)
uname_m=$(uname -m 2>/dev/null || echo unknown)

case "$uname_s" in
  Linux)  os="linux" ;;
  Darwin) os="darwin" ;;
  *) err "Unsupported OS: $uname_s"; exit 1 ;;
esac

case "$uname_m" in
  x86_64|amd64) arch="x64" ;;
  arm64|aarch64) arch="arm64" ;;
  *) err "Unsupported architecture: $uname_m"; exit 1 ;;
esac

asset="${BIN_NAME}-${os}-${arch}"
ext=""
filename="$asset$ext"

# Build URL
if [ "$VERSION" = "latest" ]; then
  base="https://github.com/$REPO/releases/latest/download"
else
  base="https://github.com/$REPO/releases/download/$VERSION"
fi

url="$base/$filename"

info "Installing $BIN_NAME ($os/$arch) from: $url"

# Download
tmpdir=${TMPDIR:-/tmp}
tmpfile="$tmpdir/$filename"
http_down "$url" "$tmpfile"

# Make executable
chmod +x "$tmpfile"

# Choose install dir
install_dir="/usr/local/bin"
if [ ! -w "$install_dir" ]; then
  if command -v sudo >/dev/null 2>&1; then
    sudo_cmd="sudo"
  else
    sudo_cmd=""
  fi
fi

if [ -n "$sudo_cmd" ] && [ -d "$install_dir" ] && [ ! -w "$install_dir" ]; then
  info "Moving binary to $install_dir (requires sudo)"
  $sudo_cmd mv "$tmpfile" "$install_dir/$BIN_NAME"
else
  # Fallback to user bin
  user_bin="$HOME/.local/bin"
  mkdir -p "$user_bin"
  info "Moving binary to $user_bin"
  mv "$tmpfile" "$user_bin/$BIN_NAME"
  install_dir="$user_bin"
fi

# Verify
if "$install_dir/$BIN_NAME" --version >/dev/null 2>&1; then
  ver=$("$install_dir/$BIN_NAME" --version 2>/dev/null || true)
  info "$BIN_NAME installed: $ver"
else
  warn "Installed, but failed to run --version"
fi

# PATH hint
case ":$PATH:" in
  *":$install_dir:"*) :;;
  *) warn "Add $install_dir to your PATH to use '$BIN_NAME'" ;;
esac

info "Done. Run: $BIN_NAME --help"
