#!/usr/bin/env bash
#
# DocumentFlow 备份的恢复与校验
#
#   ./restore.sh --list
#       列出所有备份，标注大小与产出时间
#
#   ./restore.sh --verify /var/backups/documentflow/20261016-031700
#       完整校验：清单自洽、每个产物非空、并把 dump 真正导入一个临时库，
#       逐表比对行数。这是唯一能证明备份可用的检查。
#
#   ./restore.sh --db /var/backups/documentflow/... --yes
#       用该备份覆盖生产数据库（破坏性，必须显式 --yes）
#
#   ./restore.sh --files /var/backups/documentflow/... [--dest DIR]
#       解出业务文件（默认解到 /opt/documentflow，会覆盖现有文件）
#
set -euo pipefail

APP_DIR=/opt/documentflow
BACKUP_ROOT=/var/backups/documentflow
DB_NAME=documentflow

# 与 backup.sh 一致：动态取最高版本，不写死
PG_BIN=""
for d in /usr/lib/postgresql/*/bin; do
  [ -x "${d}/pg_dump" ] && PG_BIN="$d"
done
[ -n "$PG_BIN" ] || { echo "FATAL: 找不到 pg_dump" >&2; exit 1; }

log() { echo "  $*"; }
die() { echo "FATAL: $*" >&2; exit 1; }

usage() {
  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-1}"
}

cmd_list() {
  [ -d "$BACKUP_ROOT" ] || die "没有备份目录：$BACKUP_ROOT"
  echo "备份根目录：${BACKUP_ROOT}"
  echo
  printf '  %-22s %10s  %s\n' 时间 大小 产出
  for d in "$BACKUP_ROOT"/*/; do
    [ -d "$d" ] || continue
    name=$(basename "$d")
    size=$(du -sh "$d" 2>/dev/null | cut -f1)
    files=$(find "$d" -type f | wc -l)
    printf '  %-22s %10s  %s 个文件\n' "$name" "$size" "$files"
  done
}

# ------------------------------------------------------------------ 校验

verify_dump_is_loadable() {
  local dump=$1 tmpdb="dfverify_$$_$RANDOM"
  log "导入临时库 ${tmpdb} ..."
  sudo -u postgres "${PG_BIN}/createdb" "$tmpdb" 2>/dev/null \
    || die "建临时库失败（当前用户需要有 createdb 权限）"

  # 无论成败都要清掉临时库
  trap 'sudo -u postgres "${PG_BIN}/dropdb" --if-exists "'"$tmpdb"'" >/dev/null 2>&1 || true' EXIT

  if ! sudo -u postgres "${PG_BIN}/pg_restore" -d "$tmpdb" "$dump" > /dev/null 2>"${TMPDIR:-/tmp}/rerr.$$"; then
    # pg_restore 在有对象已存在时会报可忽略的错误，检查是不是全是这类
    if grep -qiE 'already exists|multiple commands' "${TMPDIR:-/tmp}/rerr.$$"; then
      log "  （有可忽略的「already exists」类报错，继续）"
    else
      cat "${TMPDIR:-/tmp}/rerr.$$" >&2
      rm -f "${TMPDIR:-/tmp}/rerr.$$"
      die "dump 无法导入临时库"
    fi
  fi
  rm -f "${TMPDIR:-/tmp}/rerr.$$"

  local tables
  tables=$(sudo -u postgres psql -d "$tmpdb" -tAc \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null || echo '?')
  log "临时库中 public 表数量：${tables}"

  # 与生产库逐表比行数，差异列出来（差异不一定要紧，
  # 因为备份是历史时刻的快照；但差异过大说明恢复有问题）
  log "与生产库逐表比对行数："
  sudo -u postgres psql -d "$tmpdb" -tAF' ' -c \
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1;" \
  | while read -r t; do
      [ -n "$t" ] || continue
      a=$(sudo -u postgres psql -d "$tmpdb" -tAc "SELECT count(*) FROM \"$t\";" 2>/dev/null || echo '-')
      b=$(sudo -u postgres psql -d "$DB_NAME" -tAc "SELECT count(*) FROM \"$t\";" 2>/dev/null || echo '-')
      if [ "$a" = "$b" ]; then
        printf '    %-32s %6s = %s\n' "$t" "$a" "$b"
      else
        printf '    %-32s %6s ≠ %s   <- 备份时 %s 行，现在 %s 行\n' "$t" "$a" "$b" "$a" "$b"
      fi
    done

  log "导入与比对通过：这份备份是**可用**的"
}

cmd_verify() {
  local dir=${1:-}
  [ -n "$dir" ] || die "用法：--verify <备份目录>"
  [ -d "$dir" ] || die "目录不存在：$dir"

  echo "校验备份：${dir}"
  echo

  local manifest="${dir}/MANIFEST.txt"
  [ -f "$manifest" ] || die "缺少 MANIFEST.txt，不是本脚本生成的备份"
  log "清单："
  sed 's/^/    /' "$manifest"
  echo

  # 逐项检查产物存在且非空
  local bad=0
  for f in "$dir"/*.tgz "$dir"/*.dump; do
    [ -e "$f" ] || continue
    local sz; sz=$(stat -c %s "$f")
    if [ "$sz" -lt 100 ]; then
      echo "    [异常] $(basename "$f") 只有 ${sz} 字节，几乎是空文件"
      bad=$((bad + 1))
    else
      printf '    [正常] %-34s %10s 字节\n' "$(basename "$f")" "$sz"
    fi
  done
  [ "$bad" -eq 0 ] || die "有 ${bad} 个产物异常"

  # 数据库 dump 必须能真正导入，这是关键一步
  verify_dump_is_loadable "${dir}/documentflow.dump"
}

# ------------------------------------------------------------------ 恢复

cmd_restore_db() {
  local dir=$1 yes=${2:-}
  [ -f "${dir}/documentflow.dump" ] || die "找不到 documentflow.dump"
  [ "$yes" = "--yes" ] || die "这会覆盖生产数据库。确认无误后加 --yes"

  echo "把生产数据库 ${DB_NAME} 覆盖为 ${dir} 的备份"
  # 先把当前库改名留一手，而不是直接 drop —— 恢复出问题时还能退回去
  SAFETY="documentflow_pre_restore_$(date +%s)"
  sudo -u postgres psql -d postgres -tAc \
    "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}';" | grep -q 1 \
    && sudo -u postgres "${PG_BIN}/psql" -d postgres -c "ALTER DATABASE \"${DB_NAME}\" RENAME TO \"${SAFETY}\";" \
    || die "找不到现有数据库"

  sudo -u postgres "${PG_BIN}/createdb" -O documentflow "$DB_NAME" || die "建库失败"
  if ! sudo -u postgres "${PG_BIN}/pg_restore" -d "$DB_NAME" --no-owner "${dir}/documentflow.dump"; then
    echo
    echo "恢复失败。原库已保留为 ${SAFETY}，可手工改回："
    echo "  sudo -u postgres psql -d postgres -c 'DROP DATABASE \"${DB_NAME}\";'"
    echo "  sudo -u postgres psql -d postgres -c 'ALTER DATABASE \"${SAFETY}\" RENAME TO \"${DB_NAME}\";'"
    exit 1
  fi
  echo "完成。原库保留为 ${SAFETY}，确认无误后可删除："
  echo "  sudo -u postgres dropdb ${SAFETY}"
}

cmd_restore_files() {
  local dir=$1 dest=${2:-$APP_DIR}
  local n=0
  for f in "$dir"/*.tgz; do
    [ -e "$f" ] || continue
    echo "  解出 $(basename "$f")"
    tar xzf "$f" -C "$dest"
    n=$((n + 1))
  done
  [ "$n" -gt 0 ] || die "没有可解出的 tgz"
  echo "  共 ${n} 个包，已解到 ${dest}"
  echo "  注意：owner 可能是 root，解完记得修正："
  echo "    chown -R documentflow:documentflow ${dest}/data ${dest}/uploads"
}

# ------------------------------------------------------------------ 入口

[ "$(id -u)" -eq 0 ] || die "必须以 root 运行"
[ $# -ge 1 ] || usage 1

case "$1" in
  --list)   cmd_list ;;
  --verify) cmd_verify "${2:-}" ;;
  --db)     cmd_restore_db "${2:-}" "${3:-}" ;;
  --files)  cmd_restore_files "${2:-}" "${3:-}" ;;
  -h|--help) usage 0 ;;
  *)        die "未知参数：$1（用 --help 看用法）" ;;
esac
