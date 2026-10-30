#!/bin/sh
# Installs the Tangent Local Agent VS Code / Cursor extension from a Tangle
# deployment: resolves the latest build, downloads the .vsix, and installs it
# with the cursor (or code) CLI.
#
#   curl -fsSL <origin>/extension/install.sh | sh -s -- <origin>
set -eu

BASE="${1:-${TANGENT_BASE_URL:-}}"
if [ -z "$BASE" ]; then
  echo "Usage: install.sh <tangle-base-url>" >&2
  echo "  curl -fsSL https://app.example.com/extension/install.sh | sh -s -- https://app.example.com" >&2
  exit 1
fi
BASE="${BASE%/}"

# The .vsix is executable code, so only fetch it over https or from loopback,
# never plain http against a remote host.
case "$BASE" in
  https://*) ;;
  http://localhost | http://localhost:* | http://127.0.0.1 | http://127.0.0.1:* | "http://[::1]" | "http://[::1]:"*) ;;
  *)
    echo "Refusing to install over an insecure base URL: $BASE" >&2
    echo "Use an https:// URL (or a loopback address for local testing)." >&2
    exit 1
    ;;
esac

if command -v cursor >/dev/null 2>&1; then
  CLI=cursor
elif command -v code >/dev/null 2>&1; then
  CLI=code
else
  echo "Neither 'cursor' nor 'code' is on your PATH." >&2
  echo "In the editor, run 'Shell Command: Install ... command in PATH' from the command palette, then re-run this." >&2
  exit 1
fi

fetch() {
  if command -v curl >/dev/null 2>&1; then
    if [ -n "${2:-}" ]; then curl -fsSL "$1" -o "$2"; else curl -fsSL "$1"; fi
  elif command -v wget >/dev/null 2>&1; then
    if [ -n "${2:-}" ]; then wget -qO "$2" "$1"; else wget -qO- "$1"; fi
  else
    echo "Need curl or wget to download." >&2
    exit 1
  fi
}

manifest=$(fetch "$BASE/extension/latest.json")
rel_url=$(printf '%s' "$manifest" | sed -n 's/.*"url"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
version=$(printf '%s' "$manifest" | sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
if [ -z "$rel_url" ]; then
  echo "Could not read the extension URL from $BASE/extension/latest.json" >&2
  exit 1
fi

# Keep only the manifest URL's path and resolve it under $BASE, so the download
# can never be redirected to another origin (or downgraded to plain http).
case "$rel_url" in
  *://*) rel_path=$(printf '%s' "$rel_url" | sed -e 's#^[a-zA-Z][a-zA-Z0-9+.-]*://[^/]*##') ;;
  /*) rel_path="$rel_url" ;;
  *) rel_path="/$rel_url" ;;
esac
[ -n "$rel_path" ] || rel_path="/"
vsix_url="$BASE$rel_path"

tmpdir=$(mktemp -d 2>/dev/null || mktemp -d -t tangent)
tmp="$tmpdir/tangent-local-agent.vsix"
trap 'rm -rf "$tmpdir"' EXIT INT TERM

echo "Downloading Tangent Local Agent ${version:-latest}..."
fetch "$vsix_url" "$tmp"

echo "Installing into $CLI..."
"$CLI" --install-extension "$tmp" --force

echo "Done. Reload or restart $CLI to activate the extension."
