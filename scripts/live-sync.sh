#!/usr/bin/env bash
# Fetches the latest election results every 3 minutes, commits result.json
# when it changed, and pushes to GitHub so the GitHub Pages deploy workflow
# rebuilds automatically.
#
# Usage:
#   ./scripts/live-sync.sh            # runs forever, Ctrl+C to stop
#   ./scripts/live-sync.sh --once     # runs a single fetch+push cycle
#
# Requirements: git must already be configured with push access to the repo
# (SSH key or a credential helper) since this script never prompts for auth.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
URL="https://resultat.val.se/data/resultat/val2026/RD_P.json"
TARGET="$REPO_DIR/result.json"
TMP="$TARGET.tmp"
INTERVAL_SECONDS=180   # 3 minutes — see chat for why this is the sweet spot
BRANCH="master"

cd "$REPO_DIR"

sync_once() {
  if ! curl --fail --silent --show-error "$URL" -o "$TMP"; then
    echo "$(date '+%H:%M:%S') fetch failed, will retry next cycle" >&2
    rm -f "$TMP"
    return 0
  fi

  # Skip the commit entirely if the data didn't actually change.
  if [ -f "$TARGET" ] && cmp -s "$TMP" "$TARGET"; then
    rm -f "$TMP"
    echo "$(date '+%H:%M:%S') no changes, skipping commit"
    return 0
  fi

  mv "$TMP" "$TARGET"

  git add result.json
  if git diff --cached --quiet; then
    echo "$(date '+%H:%M:%S') nothing staged, skipping commit"
    return 0
  fi

  git commit -m "Update election results ($(date '+%Y-%m-%d %H:%M:%S'))" --quiet

  # Pull with rebase first in case something else touched the branch,
  # then push normally (no --force, no --amend).
  if ! git pull --rebase --quiet origin "$BRANCH"; then
    echo "$(date '+%H:%M:%S') rebase failed, resolve manually" >&2
    return 1
  fi

  if git push --quiet origin "$BRANCH"; then
    echo "$(date '+%H:%M:%S') pushed updated result.json"
  else
    echo "$(date '+%H:%M:%S') push failed, will retry next cycle" >&2
  fi
}

if [ "${1:-}" = "--once" ]; then
  sync_once
  exit 0
fi

echo "Starting live sync loop (every ${INTERVAL_SECONDS}s). Press Ctrl+C to stop."
while true; do
  sync_once
  sleep "$INTERVAL_SECONDS"
done
