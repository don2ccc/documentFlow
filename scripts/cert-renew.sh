#!/bin/bash
# Renew self-signed SSL certificate and reload nginx.
# Intended to be invoked as root via sudo from the documentflow user.
# Configurable via env vars.

set -euo pipefail

CERT_DIR=/etc/nginx/ssl
CERT_FILE="$CERT_DIR/documentflow.crt"
KEY_FILE="$CERT_DIR/documentflow.key"
BACKUP_DIR=/opt/documentflow/backups/ssl
LOG_DIR=/opt/documentflow/logs

DAYS="${DAYS:-3650}"
COUNTRY="${COUNTRY:-CN}"
STATE="${STATE:-Guangdong}"
CITY="${CITY:-Dongguan}"
ORG="${ORG:-YAGEO}"
OU="${OU:-SPO}"
CN="${CN:-172.17.161.26}"

# Validate days
if ! [[ "$DAYS" =~ ^[0-9]+$ ]] || [ "$DAYS" -lt 1 ] || [ "$DAYS" -gt 36500 ]; then
  echo "Invalid DAYS value: $DAYS" >&2
  exit 2
fi

mkdir -p "$LOG_DIR" "$BACKUP_DIR"
LOG_FILE="$LOG_DIR/ssl-renew.log"

log() {
  local msg
  msg="$(date -Is) [ssl-renew] $1"
  echo "$msg" | tee -a "$LOG_FILE"
}

log "===== ssl-renew start (days=$DAYS cn=$CN) ====="

# Step 1: backup old cert (tolerate missing files)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
if [ -f "$CERT_FILE" ]; then
  cp -f "$CERT_FILE" "$BACKUP_DIR/documentflow.crt.$TIMESTAMP"
  log "backed up cert to $BACKUP_DIR/documentflow.crt.$TIMESTAMP"
fi
if [ -f "$KEY_FILE" ]; then
  cp -f "$KEY_FILE" "$BACKUP_DIR/documentflow.key.$TIMESTAMP"
  log "backed up key to $BACKUP_DIR/documentflow.key.$TIMESTAMP"
fi

# Step 2: generate new cert in a temp dir
TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT
TMP_CRT="$TMPDIR/documentflow.crt"
TMP_KEY="$TMPDIR/documentflow.key"

log "generating new RSA-2048 self-signed cert (validity=$DAYS days)..."
openssl req -x509 -nodes -newkey rsa:2048 -days "$DAYS" \
  -keyout "$TMP_KEY" -out "$TMP_CRT" \
  -subj "/C=$COUNTRY/ST=$STATE/L=$CITY/O=$ORG/OU=$OU/CN=$CN" \
  2>>"$LOG_FILE"

if [ ! -s "$TMP_CRT" ] || [ ! -s "$TMP_KEY" ]; then
  log "ERROR: openssl did not produce expected files"
  exit 3
fi

# Step 3: install new cert
log "installing new cert to $CERT_FILE"
mv -f "$TMP_CRT" "$CERT_FILE"
mv -f "$TMP_KEY" "$KEY_FILE"
chown root:root "$CERT_FILE" "$KEY_FILE"
chmod 644 "$CERT_FILE"
chmod 600 "$KEY_FILE"

# Step 4: test nginx config and reload
log "testing nginx config..."
if ! nginx -t >>"$LOG_FILE" 2>&1; then
  log "ERROR: nginx -t failed; rolling back"
  if [ -f "$BACKUP_DIR/documentflow.crt.$TIMESTAMP" ]; then
    cp -f "$BACKUP_DIR/documentflow.crt.$TIMESTAMP" "$CERT_FILE"
    cp -f "$BACKUP_DIR/documentflow.key.$TIMESTAMP" "$KEY_FILE"
  fi
  exit 4
fi

log "reloading nginx..."
systemctl reload nginx 2>>"$LOG_FILE" || nginx -s reload 2>>"$LOG_FILE"

# Step 5: report
NEW_SUBJECT=$(openssl x509 -in "$CERT_FILE" -noout -subject | sed "s/^subject=//")
NEW_NOT_AFTER=$(openssl x509 -in "$CERT_FILE" -noout -enddate | cut -d= -f2)
NEW_NOT_AFTER_ISO=$(date -d "$NEW_NOT_AFTER" -u +%Y-%m-%dT%H:%M:%SZ)
NEW_FP=$(openssl x509 -in "$CERT_FILE" -noout -fingerprint -sha256 | cut -d= -f2)
NEW_NOT_BEFORE=$(openssl x509 -in "$CERT_FILE" -noout -startdate | cut -d= -f2)
NEW_NOT_BEFORE_ISO=$(date -d "$NEW_NOT_BEFORE" -u +%Y-%m-%dT%H:%M:%SZ)
NEW_DAYS_LEFT=$(( ( $(date -d "$NEW_NOT_AFTER" +%s) - $(date +%s) ) / 86400 ))

log "SUCCESS new subject=$NEW_SUBJECT"
log "       new notBefore=$NEW_NOT_BEFORE_ISO"
log "       new notAfter=$NEW_NOT_AFTER_ISO"
log "       new fingerprint=$NEW_FP"

cat <<JSON
{"ok":true,"subject":"$NEW_SUBJECT","notBefore":"$NEW_NOT_BEFORE_ISO","notAfter":"$NEW_NOT_AFTER_ISO","fingerprint":"$NEW_FP","days":$DAYS,"daysLeft":$NEW_DAYS_LEFT,"backupTimestamp":"$TIMESTAMP"}
JSON

log "===== ssl-renew done ====="

