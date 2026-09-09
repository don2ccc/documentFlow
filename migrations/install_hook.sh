
echo "==> Applying SQL migrations"
sudo -n -u "$APP_USER" bash -c "DB_PASS='$DB_PASS' bash '$APP_DIR/migrations/run.sh'"
