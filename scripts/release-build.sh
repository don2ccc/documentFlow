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

echo "[release] Copying pdfjs CMaps and standard fonts into dist..."
mkdir -p apps/web/dist/cmaps apps/web/dist/standard_fonts
cp -f /opt/documentflow/node_modules/pdfjs-dist/cmaps/*.bcmap apps/web/dist/cmaps/
cp -f /opt/documentflow/node_modules/pdfjs-dist/standard_fonts/*.pfb apps/web/dist/standard_fonts/
chown -R documentflow:documentflow apps/web/dist/cmaps apps/web/dist/standard_fonts
chmod -R a+rX apps/web/dist/cmaps apps/web/dist/standard_fonts
echo "[release] Copied $(ls apps/web/dist/cmaps | wc -l) CMaps and $(ls apps/web/dist/standard_fonts | wc -l) standard fonts."

echo "[release] Restarting PM2..."
su -s /bin/bash documentflow -c "pm2 restart documentflow-api --update-env >/dev/null"

echo
echo "[release] Done. Latest tag:"
git tag --sort=-version:refname | head -1