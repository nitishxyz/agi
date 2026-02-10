#!/usr/bin/env sh
set -e

# otto installer (downloads GitHub release binary)
# Usage: curl -fsSL https://install.ottocode.io | sh
# Optional: OTTO_VERSION=v0.1.8 curl -fsSL https://install.ottocode.io | sh

REPO="nitishxyz/otto"
BIN_NAME="otto"
VERSION="${OTTO_VERSION:-latest}"

info() { printf "\033[1;34m[i]\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m[!]\033[0m %s\n" "$*"; }
err()  { printf "\033[1;31m[x]\033[0m %s\n" "$*" 1>&2; }

version_to_num() {
  echo "$1" | sed 's/^v//' | awk -F. '{ printf "%04d%04d%04d", $1, $2, $3 }'
}

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

# Resolve CLI release tag
if [ "$VERSION" = "latest" ]; then
  info "Fetching latest CLI release..."
  
  releases_json=$(http_get "https://api.github.com/repos/$REPO/releases?per_page=30")

  download_urls=$(echo "$releases_json" \
    | grep -o '"browser_download_url" *: *"[^"]*'"/${asset}"'"' \
    | sed 's/.*"browser_download_url" *: *"//;s/"$//')

  VERSION=""
  for url in $download_urls; do
    tag=$(echo "$url" | sed 's|.*/download/\([^/]*\)/.*|\1|')
    if [ -z "$VERSION" ]; then
      VERSION="$tag"
    else
      cur=$(version_to_num "$VERSION")
      new=$(version_to_num "$tag")
      if [ "$new" -gt "$cur" ]; then
        VERSION="$tag"
      fi
    fi
  done
  
  if [ -z "$VERSION" ]; then
    err "Could not find a CLI release with binaries"
    exit 1
  fi
  info "Latest CLI version: $VERSION"
  base="https://github.com/$REPO/releases/download/$VERSION"
else
  base="https://github.com/$REPO/releases/download/$VERSION"
fi

if [ "${OTTO_FORCE:-}" != "1" ]; then
  local_bin=$(command -v "$BIN_NAME" 2>/dev/null || true)
  if [ -n "$local_bin" ]; then
    local_ver=$("$local_bin" --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || true)
    if [ -n "$local_ver" ]; then
      remote_ver=$(echo "$VERSION" | sed 's/^v//')
      local_num=$(version_to_num "$local_ver")
      remote_num=$(version_to_num "$remote_ver")
      if [ "$local_num" -ge "$remote_num" ]; then
        info "✓ $BIN_NAME v$local_ver is already installed and up to date (remote: $VERSION)"
        info "Location: $local_bin"
        info "To force reinstall: OTTO_FORCE=1 curl -fsSL https://install.ottocode.io | sh"
        exit 0
      fi
      info "Upgrading $BIN_NAME from v$local_ver to $VERSION"
    fi
  fi
fi

url="$base/$filename"

info "Installing $BIN_NAME ($os/$arch) from: $url"

# Download
tmpdir=${TMPDIR:-/tmp}
tmpfile="$tmpdir/$filename"
http_down "$url" "$tmpfile"

# Make executable
chmod +x "$tmpfile"

# Install to user bin directory
install_dir="$HOME/.local/bin"
mkdir -p "$install_dir"
info "Installing $BIN_NAME to $install_dir"
mv "$tmpfile" "$install_dir/$BIN_NAME"

# Verify installation
if "$install_dir/$BIN_NAME" --version >/dev/null 2>&1; then
  ver=$("$install_dir/$BIN_NAME" --version 2>/dev/null || true)
  info "✓ $BIN_NAME installed successfully!"
  info "Version: $ver"
  info "Location: $install_dir/$BIN_NAME"
else
  warn "Installed, but failed to run --version"
fi

# Update PATH in shell profile
case ":$PATH:" in
  *":$install_dir:"*) 
    info "✓ $install_dir already in PATH"
    ;;
  *)
    # Detect shell and config file
    shell_name="$(basename "${SHELL:-sh}")"
    case "$shell_name" in
      zsh)
        config_file="$HOME/.zshrc"
        shell_type="zsh"
        ;;
      bash)
        config_file="$HOME/.bashrc"
        shell_type="bash"
        ;;
      *)
        config_file="$HOME/.profile"
        shell_type="shell"
        ;;
    esac
    
    path_export="export PATH=\"\$HOME/.local/bin:\$PATH\""
    
    # Check if .local/bin is already in the config file
    if grep -q "\.local/bin" "$config_file" 2>/dev/null; then
      info "✓ PATH already configured in $config_file"
    else
      echo "$path_export" >> "$config_file"
      info "✓ Added $install_dir to PATH in $config_file"
      info "✓ Restart your $shell_type or run: source $config_file"
    fi
    
    warn "⚠️  Add $install_dir to your PATH:"
    printf "   echo '%s' >> %s\n" "$path_export" "$config_file"
    printf "   Or for %s: echo '%s' >> ~/.%src\n" "$shell_type" "$path_export" "$shell_type"
    ;;
esac

info "Run: $BIN_NAME --help"
