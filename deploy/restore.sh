#!/usr/bin/env bash
# documentFlow restore script
# Usage: ./restore.sh /path/to/backup/YYYYMMDD-HHMMSS
set -euo pipefail
SRC=""
if [[ -z "" || ! -d "" ]]; then
  echo "Usage:  /path/to/backup/YYYYMMDD-HHMMSS" >&2
  exit 1
fi
echo "[INFO] restoring from "
if [[ ! -f "/documentflow.dump" ]]; then
  echo "[ERROR] missing documentflow.dump in backup" >&2
  exit 2
fi
echo "[STEP] stopping services"
pm2 stop all 2>/dev/null || true
echo "[STEP] recreating database"
sudo -u postgres psql -c "DROP DATABASE IF EXISTS documentflow" >/dev/null 2>&1 || true
sudo -u postgres psql -c "CREATE DATABASE documentflow OWNER postgres" >/dev/null 2>&1
sudo -u postgres psql -d documentflow -c "CREATE EXTENSION IF NOT EXISTS pgcrypto" >/dev/null 2>&1 || true
echo "[STEP] restoring database"
sudo -u postgres env HOME=/var/lib/postgresql /usr/lib/postgresql/14/bin/pg_restore -d documentflow --no-owner --role=postgres "/documentflow.dump" >/dev/null 2>&1 || true
echo "[INFO] DB restore issued"
echo "[STEP] restoring uploaded files"
rm -rf /opt/documentflow/data/documents /opt/documentflow/data/previews
mkdir -p /opt/documentflow/data
if [[ -f "/uploads.tgz" ]]; then
  tar xzf "/uploads.tgz" -C /opt/documentflow 2>/dev/null || true
fi
echo "[STEP] restoring configs"
for f in app.env ecosystem.config.js nginx.conf init-ubuntu.sh; do
  src="/"
  dest=""
  case "" in
    app.env) dest=/opt/documentflow/.env ;;
    ecosystem.config.js|nginx.conf|init-ubuntu.sh) dest=/opt/documentflow/deploy/ ;;
  esac
  if [[ -n "" && -f "" ]]; then cp -f "" ""; fi
done
echo "[STEP] restoring nginx and ssl"
if [[ -f "/nginx.tgz" ]]; then
  mv /etc/nginx /etc/nginx.bak 2>/dev/null || true
  tar xzf "/nginx.tgz" -C /etc 2>/dev/null || true
fi
if [[ -f "/ssl.tgz" ]]; then
  mkdir -p /etc/nginx
  tar xzf "/ssl.tgz" -C /etc/nginx 2>/dev/null || true
fi
nginx -t 2>/dev/null && (systemctl reload nginx 2>/dev/null || nginx -s reload 2>/dev/null) || true
echo "[STEP] restoring pm2 home"
if [[ -f "/pm2-home.tgz" ]]; then
  tar xzf "/pm2-home.tgz" -C /home/documentflow 2>/dev/null || true
fi
echo "[STEP] data ownership"
chown -R documentflow:documentflow /opt/documentflow/data 2>/dev/null || true
echo "[STEP] starting services"
(pm2 start /opt/documentflow/deploy/ecosystem.config.js 2>/dev/null && pm2 save 2>/dev/null) || (pm2 restart all 2>/dev/null && pm2 save 2>/dev/null) || true
echo "[STEP] verifying health"
sleep 5
code=
if [[ "" == 200 ]]; then echo "[OK] documentflow restored and healthy"; else echo "[WARN] health check returned ; inspect pm2 logs"; fi
echo "[DONE] restore from  finished"
cat "/MANIFEST.txt" 2>/dev/null || true
