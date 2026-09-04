#!/bin/bash
# Roll back the deployed app to a previous git tag.
# Usage: rollback.sh <tag>
# Rebuilds server + web from that tag and restarts PM2.

set -euo pipefail

TARGET="${1:-}"
if [ -z "$TARGET" ]; then
  echo "Usage: $0 <tag>   e.g. v1.0.4"
  exit 1
fi

cd /opt/documentflow

if ! git rev-parse "$TARGET" >/dev/null 2>&1; then
  echo "Tag $TARGET does not exist"
  exit 1
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
CURRENT_HEAD=$(git rev-parse --short HEAD)

echo "Current HEAD: $CURRENT_HEAD on $CURRENT_BRANCH"
echo "Rolling back to: $TARGET"
echo

# Stash anything uncommitted so it survives the checkout.
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Stashing uncommitted changes..."
  git stash push -m "auto-stash before rollback to $TARGET"
fi

git checkout "$TARGET"

echo "Rebuilding server..."
(cd apps/server && npm run build)

echo "Rebuilding web..."
(cd apps/web && npm run build)

echo "Restarting PM2 processes..."
pm2 restart documentflow-api --update-env >/dev/null

echo
echo "Rolled back to $TARGET"
echo "Tip: run \`git checkout feature-billy\` to get back to your latest working state."