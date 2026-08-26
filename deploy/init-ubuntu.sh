#!/usr/bin/env bash
# 文档审批系统 Ubuntu 初始化脚本（MVP）
set -euo pipefail

APP_DIR=/opt/documentflow
APP_USER=documentflow
DB_NAME=documentflow
DB_USER=documentflow
DB_PASSWORD="${DB_PASSWORD:-change-me-please}"

if [[ $EUID -ne 0 ]]; then
  echo "请以 root 运行: sudo bash deploy/init-ubuntu.sh"
  exit 1
fi

echo "==> 安装系统依赖"
apt-get update
apt-get install -y postgresql nginx libreoffice-core libreoffice-writer libreoffice-calc libreoffice-impress fonts-noto-cjk curl gnupg

echo "==> 安装 Node.js 20 LTS"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
npm install -g pm2

echo "==> 创建应用用户与目录"
id -u "$APP_USER" &>/dev/null || useradd -m -s /bin/bash "$APP_USER"
mkdir -p "$APP_DIR"
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"

echo "==> 初始化数据库"
su - postgres -c "psql -c \"CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';\""
su - postgres -c "psql -c \"CREATE DATABASE $DB_NAME OWNER $DB_USER;\""

echo "==> 部署代码（将代码放置到 $APP_DIR 后执行）"
cd "$APP_DIR"
npm ci
npm run build
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"

echo "==> 首次启动（DB_SYNC=true 建表 + 种子管理员 admin/Admin@123）"
su - "$APP_USER" -c "cd $APP_DIR && DB_SYNC=true pm2 start deploy/ecosystem.config.js"
pm2 save
pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" || true

echo "==> 配置 Nginx"
cp deploy/nginx.conf /etc/nginx/sites-available/documentflow
ln -sf /etc/nginx/sites-available/documentflow /etc/nginx/sites-enabled/documentflow
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "==> 完成。请修改 $APP_DIR/.env 中的 JWT_SECRET 与数据库密码，并执行 pm2 restart documentflow-api"