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

- 日志：`pm2 logs documentflow-api` / `pm2 logs documentflow-worker`
- 备份：`pg_dump documentflow > backup.sql`；文档目录 `rsync -a /opt/documentflow/data/ backup/`
- LibreOffice 转换：Word/Excel/PPT 由 worker 进程调用 `libreoffice --headless` 转 PDF，中文字体需 `fonts-noto-cjk`

## 本地开发（Windows）

- PostgreSQL 16+ 本地运行，复制 `apps/server/.env.example` 为 `apps/server/.env` 填真实连接串
- `npm run dev:server`（NestJS :3000）+ `npm run dev:web`（Vite :5173，代理 /api）
- 测试：`npm run test:server`（需本地 `documentflow_test` 库）、`npm run test:web`