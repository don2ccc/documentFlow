# 部署说明（MVP，无 Docker）

## 环境变量（/opt/documentflow/.env）

| 变量 | 说明 |
| --- | --- |
| PORT | API 端口，默认 3000 |
| DATABASE_URL | 形如 `postgres://documentflow:密码@localhost:5432/documentflow` |
| JWT_SECRET | 用 `openssl rand -hex 32` 生成，勿用默认值 |
| UPLOAD_DIR | 文档存储目录，默认 `./data/documents` |
| PREVIEW_DIR | PDF 预览缓存目录，默认 `./data/previews` |
| DB_SYNC | 首次部署设为 true 建表；日常运行不要设置 |

## 部署步骤

1. 构建产物：本地 `npm run build` 后把 `apps/`、`packages/`、`deploy/`、`package.json`、`package-lock.json` 上传到服务器 `/opt/documentflow`
2. 首次执行：`sudo bash deploy/init-ubuntu.sh`（会安装依赖、建库、建表、启动 pm2、配置 Nginx）
3. 修改 `/opt/documentflow/.env` 中的 `JWT_SECRET` 与数据库密码，`pm2 restart documentflow-api`

## 常用运维

- 日志：`journalctl -u documentflow-api -f` / `journalctl -u documentflow-worker -f`
- LibreOffice 转换：Word/Excel/PPT 由 worker 进程调用 `libreoffice --headless` 转 PDF，中文字体需 `fonts-noto-cjk`

## 备份与恢复

**不要只跑 `pg_dump`。** 照片、文档、签名都存在文件系统里，
数据库里只有一个文件名，`pg_dump` 看不到它们。

备份由 systemd timer 每天 03:17 自动执行（`documentflow-backup.timer`），
脚本是 `deploy/backup.sh`，产出在 `/var/backups/documentflow/<时间戳>/`：

| 产物 | 内容 |
| --- | --- |
| `documentflow.dump` | 整库，`pg_dump -Fc` |
| `data_documents.tgz` | 上传的文档 |
| `data_previews.tgz` | PDF 预览缓存 |
| `data_hr-photos.tgz` | 员工照片 |
| `uploads_signatures.tgz` | 手写签名 |
| `systemd-units.tgz` | 服务单元文件 |
| `nginx-documentflow.conf` | nginx 站点配置 |
| `app.env` | `.env` 备份（含密钥，权限 600） |
| `MANIFEST.txt` | 清单，记录每个目录的文件数 |

保留最近 **15 份**（约 15 天，130 MB），多余的自动删除。

### 常用命令

```sh
# 看有哪些备份
./deploy/restore.sh --list

# 校验某份备份能不能用（会建临时库导入并逐表比对行数，不影响生产）
./deploy/restore.sh --verify /var/backups/documentflow/20261017-031700

# 恢复文件
./deploy/restore.sh --files /var/backups/documentflow/20261017-031700

# 恢复数据库（破坏性；原库会先改名保留为 documentflow_pre_restore_<时间戳>）
./deploy/restore.sh --db /var/backups/documentflow/20261017-031700 --yes
```

手动触发一次备份：

```sh
systemctl start documentflow-backup.service
journalctl -u documentflow-backup -n 50
systemctl show documentflow-backup.service -p Result   # 必须是 success
```

### 为什么脚本里到处都是 `die`

历史上这个脚本每一步都带 `2>/dev/null || true`，
它打包的是一个**已经不存在的目录** `apps/server/uploads`，
照样打印 `[INFO]` 并以 0 退出，生成一个 45 字节的空壳。
加上 `PG_BIN` 写死成 `postgresql/14`（实际是 18），
这个脚本从来没有成功执行过一次，而 `/var/backups/documentflow` 一直不存在。

所以现在的规则是：**宁可报错，不要假装成功。**
路径不对、产出为空、文件数对不上、dump 读不出来 —— 任何一项不过就 exit 1，
让 systemd 标记为失败。定期看一眼 `systemctl list-timers` 确认 `NEXT` 有时间，
比什么都强。

## 本地开发（Windows）

- PostgreSQL 16+ 本地运行，复制 `apps/server/.env.example` 为 `apps/server/.env` 填真实连接串
- `npm run dev:server`（NestJS :3000）+ `npm run dev:web`（Vite :5173，代理 /api）
- 测试：`npm run test:server`（需本地 `documentflow_test` 库）、`npm run test:web`