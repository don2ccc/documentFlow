#!/bin/bash
# Full release: bump version, build server, build web, restart PM2.
set -euo pipefail

cd /opt/documentflow

echo "[release] Bumping version..."
node scripts/release.mjs

echo "[release] Building server..."
(cd apps/server && npm run build)

echo "[release] Building web..."
(cd apps/web && npm run build)

echo "[release] Restarting PM2..."
pm2 restart documentflow-api --update-env >/dev/null

echo
echo "[release] Done. Latest tag:"
git tag --sort=-version:refname | head -1