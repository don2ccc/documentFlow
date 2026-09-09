#!/usr/bin/env bash
set -euo pipefail
BACKUP_ROOT=/var/backups/documentflow
STAMP=$(date +%Y%m%d-%H%M%S)
DEST=${BACKUP_ROOT}/${STAMP}
mkdir -p ${DEST}
echo "[INFO] backing up PostgreSQL database"
sudo -u postgres env HOME=/var/lib/postgresql /usr/lib/postgresql/14/bin/pg_dump -Fc documentflow > ${DEST}/documentflow.dump
echo "[INFO] backing up uploaded files"
tar czf ${DEST}/uploads.tgz -C /opt/documentflow apps/server/uploads 2>/dev/null || true
echo "[INFO] backing up nginx config and ssl"
tar czf ${DEST}/nginx.tgz -C /etc nginx 2>/dev/null
tar czf ${DEST}/ssl.tgz -C /etc/nginx ssl 2>/dev/null
echo "[INFO] backing up app configs and pm2"
cp /opt/documentflow/deploy/ecosystem.config.js ${DEST}/
cp /opt/documentflow/deploy/nginx.conf ${DEST}/
cp /opt/documentflow/deploy/init-ubuntu.sh ${DEST}/
cp /opt/documentflow/.env ${DEST}/app.env 2>/dev/null || true
tar czf ${DEST}/pm2-home.tgz -C /home/documentflow .pm2 2>/dev/null
echo "[INFO] writing manifest"
du -sh ${DEST}/* > ${DEST}/MANIFEST.txt
echo "stamp=${STAMP}" >> ${DEST}/MANIFEST.txt
echo "[INFO] rotating old backups (keep last 7)"
ls -1dt ${BACKUP_ROOT}/*/ 2>/dev/null | tail -n +8 | xargs -r rm -rf
echo "[DONE] ${DEST}"
