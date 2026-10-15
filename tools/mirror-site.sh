#!/usr/bin/env bash
set -euo pipefail

SOURCE_URL="${1:-https://cadpad-egress-monitor.papaa.chatgpt.site/}"
OUTPUT_DIR="${2:-site}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

command -v wget >/dev/null 2>&1 || { echo 'wget is required.' >&2; exit 1; }

# Mirror the published site and all same-origin page requisites.  --no-host-directories
# keeps the result directly runnable from OUTPUT_DIR with a basic static server.
wget \
  --mirror \
  --page-requisites \
  --convert-links \
  --adjust-extension \
  --no-parent \
  --no-host-directories \
  --directory-prefix "$TMP_DIR" \
  --execute robots=off \
  "$SOURCE_URL"

if [[ ! -f "$TMP_DIR/index.html" ]]; then
  echo 'Mirror did not produce index.html; refusing to replace the existing snapshot.' >&2
  exit 1
fi

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"
cp -a "$TMP_DIR"/. "$OUTPUT_DIR"/

printf 'Mirrored %s into %s\n' "$SOURCE_URL" "$OUTPUT_DIR"
