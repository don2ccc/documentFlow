#!/bin/bash
set -euo pipefail

CERT_FILE=/etc/nginx/ssl/documentflow.crt
KEY_FILE=/etc/nginx/ssl/documentflow.key

if [ ! -f "$CERT_FILE" ]; then
  printf "%s\n" "{\"exists\":false,\"error\":\"certificate file missing\"}"
  exit 0
fi

NOT_BEFORE=$(openssl x509 -in "$CERT_FILE" -noout -startdate | cut -d= -f2)
NOT_AFTER=$(openssl x509 -in "$CERT_FILE" -noout -enddate | cut -d= -f2)
SUBJECT=$(openssl x509 -in "$CERT_FILE" -noout -subject | sed "s/^subject=//")
ISSUER=$(openssl x509 -in "$CERT_FILE" -noout -issuer | sed "s/^issuer=//")
SERIAL=$(openssl x509 -in "$CERT_FILE" -noout -serial | cut -d= -f2)
FINGERPRINT=$(openssl x509 -in "$CERT_FILE" -noout -fingerprint -sha256 | cut -d= -f2)

NOT_AFTER_TS=$(date -d "$NOT_AFTER" +%s 2>/dev/null || echo 0)
NOW_TS=$(date +%s)
DAYS_LEFT=$(( (NOT_AFTER_TS - NOW_TS) / 86400 ))

if [ "$DAYS_LEFT" -lt 0 ]; then STATUS="expired"
elif [ "$DAYS_LEFT" -le 30 ]; then STATUS="expiring"
elif [ "$DAYS_LEFT" -le 90 ]; then STATUS="warning"
else STATUS="ok"; fi

SELF_SIGNED="false"
if [ "$SUBJECT" = "$ISSUER" ]; then SELF_SIGNED="true"; fi

NOT_BEFORE_ISO=$(date -d "$NOT_BEFORE" -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo "")
NOT_AFTER_ISO=$(date -d "$NOT_AFTER" -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo "")

KEY_FILE_STATUS="missing"
if [ -f "$KEY_FILE" ]; then KEY_FILE_STATUS="ok"; fi

cat <<JSON
{"exists":true,"path":"$CERT_FILE","keyPath":"$KEY_FILE","keyStatus":"$KEY_FILE_STATUS","subject":"$SUBJECT","issuer":"$ISSUER","selfSigned":$SELF_SIGNED,"serial":"$SERIAL","fingerprint":"$FINGERPRINT","notBefore":"$NOT_BEFORE_ISO","notAfter":"$NOT_AFTER_ISO","daysLeft":$DAYS_LEFT,"status":"$STATUS"}
JSON

