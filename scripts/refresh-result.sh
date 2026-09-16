#!/usr/bin/env bash
# Fetches the latest election results and overwrites result.json locally.
# Run this in a loop (see below) while `npm run dev` or `npm run preview` is running.
# No git commit/push involved — purely local file refresh for live-ish local viewing.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
URL="https://resultat.val.se/data/resultat/val2026/RD_P.json"
TARGET="$REPO_DIR/result.json"
TMP="$TARGET.tmp"

curl --fail --silent --show-error "$URL" -o "$TMP"
mv "$TMP" "$TARGET"
echo "$(date '+%H:%M:%S') result.json refreshed"
