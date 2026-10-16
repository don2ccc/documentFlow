#!/usr/bin/env bash
#
# DocumentFlow 备份
#
# 由 systemd timer 每日调用（documentflow-backup.timer），也可手动执行。
#
# 设计原则：**宁可报错，不要假装成功。**
#   上一版每一步都带 `2>/dev/null || true`，tar 打包了一个不存在的目录，
#   照样打印 [INFO] 并退出 0，生成一个 45 字节的空壳。
#   从错误退出码里把「失败」抹掉，等于把备份变成了摆设。
#   所以这里：
#     - set -euo pipefail，任何一步失败立即中止
#     - 每个目录的存在与产出大小都要显式校验
#     - 校验不过就 exit 1，让 systemd 标记为失败
#
set -euo pipefail

APP_DIR=/opt/documentflow
BACKUP_ROOT=/var/backups/documentflow
# 保留 15 天。备份有 14 天延迟压缩比 7 天更有意义 ——
# 7 天只能覆盖「上周忘了拷」这种失误，14 天才能覆盖「两周前才发现问题」。
# 每次约 8.6 MB，15 份约 130 MB，相对 400+ GB 可用空间可以忽略。
KEEP=15
STAMP=$(date +%Y%m%d-%H%M%S)
DEST="${BACKUP_ROOT}/${STAMP}"

DB_NAME=documentflow

log()  { echo "[$(date '+%F %T')] $*"; }
die()  { echo "[$(date '+%F %T')] FATAL: $*" >&2; exit 1; }

# 上一版把 PG_BIN 写死成 /usr/lib/postgresql/14/bin，
# 而这台机器上装的是 18 —— 脚本一执行就 command not found 直接退出，
# 再叠加前面的路径错误，脚本从来没成功跑过一次。
# 现在从实际安装的最高版本目录里取，顺带扛住将来升级。
PG_BIN=""
for d in /usr/lib/postgresql/*/bin; do
  [ -x "${d}/pg_dump" ] && PG_BIN="$d"
done
[ -n "$PG_BIN" ] || die "找不到 pg_dump，检查 /usr/lib/postgresql/*/bin"
log "使用 PostgreSQL 客户端：${PG_BIN}"

# ---------------------------------------------------------------- 前置校验

[ "$(id -u)" -eq 0 ] || die "必须以 root 运行（systemd service 里是 root）"
[ -d "$APP_DIR" ] || die "应用目录不存在：$APP_DIR"

# 这些目录必须有文件。不是为了备份它们，而是为了在**开始备份之前**
# 就发现路径写错了 —— 上一版的问题正是备份了一个不存在的目录而无人察觉。
DATA_DIRS=(
  "${APP_DIR}/data/documents"
  "${APP_DIR}/data/previews"
  "${APP_DIR}/data/hr-photos"
  "${APP_DIR}/uploads/signatures"
)

log "检查待备份目录"
MISSING=0
for d in "${DATA_DIRS[@]}"; do
  if [ ! -d "$d" ]; then
    echo "  [缺失] $d  <- 目录不存在" >&2
    MISSING=$((MISSING + 1))
  else
    echo "  [正常] $d  ($(find "$d" -type f | wc -l) 个文件)"
  fi
done
# 全部缺失才中止：新建站点时前几个目录本来就没建好，
# 不该因为它们就完全备份不了（数据库那份仍然有价值）。
if [ "$MISSING" -eq "${#DATA_DIRS[@]}" ]; then
  die "所有数据目录都不存在，路径配置可能已过时，拒绝生成一个空备份"
fi

mkdir -p "$DEST"
MANIFEST="${DEST}/MANIFEST.txt"
: > "$MANIFEST"

# 记录每个目录的源文件数，备份后再数一次打包结果，对不上就失败。
declare -A EXPECTED_FILES
for d in "${DATA_DIRS[@]}"; do
  [ -d "$d" ] && EXPECTED_FILES["$d"]=$(find "$d" -type f | wc -l)
done

# ---------------------------------------------------------------- 1. 数据库

log "备份数据库 ${DB_NAME}"
DB_DUMP="${DEST}/documentflow.dump"

# 注意这里不用 pg_dump --file=...：那样是 postgres 进程自己去写，
# 而 /var/backups/documentflow 归 root，postgres 无权写入。
# 改成 stdout 重定向，由 root 进程落盘。
sudo -u postgres env HOME=/var/lib/postgresql "${PG_BIN}/pg_dump" -Fc "$DB_NAME" > "$DB_DUMP" \
  || die "pg_dump 失败，退出（没有生成任何可用的数据库备份）"

[ -s "$DB_DUMP" ] || die "pg_dump 生成了 0 字节文件"

# 只验证能读到目录结构，不真正导入 —— 真导入要建临时库，开销大，
# 由 restore.sh --verify 做完整校验。
"${PG_BIN}/pg_restore" --list "$DB_DUMP" > /dev/null \
  || die "dump 文件损坏，pg_restore --list 读不出来"
DB_SIZE=$(stat -c %s "$DB_DUMP")
DB_ENTRIES=$("${PG_BIN}/pg_restore" --list "$DB_DUMP" | grep -c 'TABLE DATA' || true)
log "  数据库 ${DB_SIZE} 字节，${DB_ENTRIES} 张表有数据"

# ---------------------------------------------------------------- 2. 业务文件

log "打包业务文件"
ARCHIVE_LIST=()
for d in "${DATA_DIRS[@]}"; do
  [ -d "$d" ] || continue
  n=${EXPECTED_FILES["$d"]}
  if [ "$n" -eq 0 ]; then
    echo "  [跳过] $d  （空目录）"
    continue
  fi
  rel="${d#"${APP_DIR}"/}"          # 转成相对路径，备份里保留目录结构
  out="${DEST}/$(echo "$rel" | tr '/' '_').tgz"
  # 不用 || true：tar 失败就是失败
  tar czf "$out" -C "$APP_DIR" "$rel"
  [ -s "$out" ] || die "$rel 打包结果为空"
  # 打包进去的文件数必须和源目录一致
  packed=$(tar tzf "$out" | grep -vc '/$' || true)
  [ "$packed" -eq "$n" ] \
    || die "$rel 文件数对不上：源 $n 个，包内 $packed 个"
  ARCHIVE_LIST+=("$out")
  echo "  $rel -> $(basename "$out")  ${n} 个文件, $(stat -c %s "$out") 字节"
done

if [ "${#ARCHIVE_LIST[@]}" -eq 0 ]; then
  die "没有任何业务文件被打包，只有数据库备份不构成完整备份"
fi

# ---------------------------------------------------------------- 3. 配置

log "备份配置"
# 现在用 systemd，不是 pm2。备 unit 文件即可，不需要整个 home 目录。
if [ -d /etc/systemd/system ]; then
  UNIT_LIST=$(ls /etc/systemd/system/documentflow-*.service 2>/dev/null | tr '\n' ' ' || true)
  if [ -n "$UNIT_LIST" ]; then
    REL_UNITS=""
    for u in $UNIT_LIST; do
      REL_UNITS="${REL_UNITS} etc/systemd/system/$(basename "$u")"
    done
    # 用 -C / 传相对路径。否则 tar 会为每个成员打印
    # "Removing leading '/' from member names"，一屏告警把真正的错误淹掉。
    # shellcheck disable=SC2086
    tar czf "${DEST}/systemd-units.tgz" -C / $REL_UNITS
    [ -s "${DEST}/systemd-units.tgz" ] || die "systemd unit 打包为空"
    echo "  systemd units: $(echo $REL_UNITS | wc -w) 个"
  else
    echo "  [警告] 没有找到 documentflow-*.service"
  fi
fi

[ -f /etc/nginx/sites-enabled/documentflow ] \
  && cp /etc/nginx/sites-enabled/documentflow "${DEST}/nginx-documentflow.conf"

# .env 含数据库密码与 JWT 密钥：恢复时必须要有，但不能是 644。
if [ -f "${APP_DIR}/.env" ]; then
  install -m 600 "${APP_DIR}/.env" "${DEST}/app.env"
  echo "  .env 已备份（权限 600，含密钥）"
else
  echo "  [警告] ${APP_DIR}/.env 不存在"
fi

# ---------------------------------------------------------------- 4. 清单

{
  echo "stamp=${STAMP}"
  echo "app_dir=${APP_DIR}"
  echo "db_name=${DB_NAME}"
  echo "db_dump_bytes=${DB_SIZE}"
  echo "db_tables_with_data=${DB_ENTRIES}"
  echo ""
  echo "# 文件清单"
  for d in "${DATA_DIRS[@]}"; do
    [ -d "$d" ] && echo "${d#${APP_DIR}/} : ${EXPECTED_FILES["$d"]} 个文件"
  done
  echo ""
  echo "# 本次产出"
  du -sh "${DEST}"/* 2>/dev/null | sed 's/^/  /'
} > "$MANIFEST"

# 清单必须自洽：声明了几个产出，就真有几个
ARTIFACT_COUNT=$(find "$DEST" -type f | wc -l)
[ "$ARTIFACT_COUNT" -ge 4 ] \
  || die "本次只产出了 ${ARTIFACT_COUNT} 个文件，少于预期的 4 个，判定为失败"
log "本次产出 ${ARTIFACT_COUNT} 个文件"

# ---------------------------------------------------------------- 5. 轮转

log "清理旧备份，保留最近 ${KEEP} 份"
mapfile -t OLD < <(ls -1dt "${BACKUP_ROOT}"/*/ 2>/dev/null | tail -n +$((KEEP + 1)))
for d in "${OLD[@]:-}"; do
  [ -n "$d" ] || continue
  log "  删除 ${d}"
  rm -rf "$d"
done

log "完成：${DEST}"
echo "$DEST"
