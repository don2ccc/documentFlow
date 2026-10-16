#!/usr/bin/env bash
#
# 把最近一次备份打成一个便于手动拷贝的单文件
#
#   ./deploy/export-backup.sh              # 打包最近一次
#   ./deploy/export-backup.sh 20261016-201836   # 打包指定那次
#   ./deploy/export-backup.sh --list       # 看有哪些可打包的
#
# 产出在 /opt/documentflow/backup-export/，一个 .tar.gz 加一个 .sha256。
# 拷到本机后用 sha256 校验，再按包内的「恢复说明.txt」操作。
#
set -euo pipefail

APP_DIR=/opt/documentflow
BACKUP_ROOT=/var/backups/documentflow
EXPORT_DIR="${APP_DIR}/backup-export"

die() { echo "错误：$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "请用 sudo 运行"

case "${1:-}" in
  --list)
    [ -d "$BACKUP_ROOT" ] || die "还没有任何备份"
    echo "可导出的备份："
    for d in $(ls -1dt "${BACKUP_ROOT}"/*/ 2>/dev/null); do
      printf '  %-20s %6s  %s 个文件  %s\n' \
        "$(basename "$d")" "$(du -sh "$d" | cut -f1)" \
        "$(find "$d" -type f | wc -l)" "$(date -r "$d" '+%F %T')"
    done
    exit 0
    ;;
esac

# 选哪一次
if [ -n "${1:-}" ]; then
  SRC="${BACKUP_ROOT}/$1"
  [ -d "$SRC" ] || die "没有这次备份：$1（用 --list 看可用的）"
else
  SRC=$(ls -1dt "${BACKUP_ROOT}"/*/ 2>/dev/null | head -1)
  [ -n "$SRC" ] || die "还没有任何备份，先跑 systemctl start documentflow-backup.service"
fi

STAMP=$(basename "$SRC")
OUT="${EXPORT_DIR}/documentflow-${STAMP}.tar.gz"

echo "打包：${SRC}"
echo

# 先在里面放一份恢复说明，拷到本机后不用回来查文档
cat > "${SRC}/恢复说明.txt" <<EOF
DocumentFlow 备份恢复说明
生成时间：$(date '+%F %T')
备份时刻：${STAMP}

这个包里有什么
  documentflow.dump        数据库整库（pg_dump 自定义格式，用 pg_restore 恢复）
  data_documents.tgz       上传的文档
  data_previews.tgz        PDF 预览缓存（可重新生成，丢了不影响）
  data_hr-photos.tgz       员工照片
  uploads_signatures.tgz   手写签名
  systemd-units.tgz        服务单元文件
  nginx-documentflow.conf  nginx 站点配置
  app.env                  旧机器的 .env（权限 600，含数据库密码与 JWT 密钥）
  MANIFEST.txt             清单：各目录文件数、数据库表数

重要
  照片、文档、签名都在这些 tgz 里。只恢复 databaseflow.dump 是不够的。
  app.env 里是旧环境的密钥。恢复到新机器时按需改，不要直接覆盖线上正在用的。

在目标机器上恢复
  1. 校验包没坏（拷过来之后做）
       sha256sum -c documentflow-${STAMP}.tar.gz.sha256

  2. 解开
       tar xzf documentflow-${STAMP}.tar.gz
       cd documentflow-${STAMP}

  3. 数据库
       sudo -u postgres createdb -O documentflow documentflow
       sudo -u postgres pg_restore -d documentflow --no-owner documentflow.dump

  4. 业务文件（注意 tar 里带的是相对路径，解到应用根目录）
       sudo tar xzf data_documents.tgz  -C /opt/documentflow
       sudo tar xzf data_hr-photos.tgz -C /opt/documentflow
       sudo tar xzf data_previews.tgz  -C /opt/documentflow
       sudo tar xzf uploads_signatures.tgz -C /opt/documentflow
       sudo chown -R documentflow:documentflow /opt/documentflow/data /opt/documentflow/uploads

  5. 配置（按需）
       sudo cp app.env /opt/documentflow/.env    # 先核对里面的地址和密码
       sudo systemctl restart documentflow-api documentflow-worker

不需要恢复预览缓存的话，跳过 data_previews.tgz 即可，worker 会重新生成。
EOF

mkdir -p "$EXPORT_DIR"
rm -f "$OUT" "$OUT.sha256"

tar czf "$OUT" -C "$BACKUP_ROOT" "$STAMP" || die "打包失败"
[ -s "$OUT" ] || die "打包结果是空文件"

cd "$EXPORT_DIR"
sha256sum "$(basename "$OUT")" > "$(basename "$OUT").sha256"

echo "产出："
ls -la "${EXPORT_DIR}" | awk 'NR>3{printf "  %10s  %s %s %s  %s\n", $5, $6, $7, $8, $9}'
echo
echo "校验和："
cat "${OUT}.sha256" | sed 's/^/  /'
echo
echo "在你自己的 Windows 电脑上执行（把路径换成实际存放目录）："
cat <<EOF

  :: 在 PowerShell 里
  cd \$env:USERPROFILE\\Downloads
  scp admindoc@172.17.161.26:/opt/documentflow/backup-export/$(basename "$OUT") .
  scp admindoc@172.17.161.26:/opt/documentflow/backup-export/$(basename "$OUT").sha256 .

  :: 校验（必须显示 OK，不一致说明传输损坏，别用）
  Get-FileHash -Algorithm SHA256 $(basename "$OUT").sha256 | ForEach-Object { \$_.Hash.ToLower() }

  :: 或者直接用工具：WinSCP / SFTP 客户端，地址 172.17.161.26，用户名 admindoc

EOF
