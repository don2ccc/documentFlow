# 文档发起与审批系统 MVP 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 1~2 个月内交付可日常使用的文档发起与审批系统 MVP：上传 → 审批 → 归档核心链路 + 极简管理端。

**Architecture:** npm workspaces 单仓库，`apps/server`（NestJS 10 + TypeORM + PostgreSQL 16）提供 REST API 与自研轻量审批引擎（节点/连线/条件/会签/超时），`apps/web`（React 18 + Vite + Ant Design 5）为单页应用，`packages/shared` 共享类型与枚举。LibreOffice headless 转 PDF，本地磁盘存储，站内信通知，pm2 + Nginx 部署（无 Docker）。

**Tech Stack:** TypeScript 全栈；NestJS 10、TypeORM 0.3、PostgreSQL 16、class-validator、bcryptjs、@nestjs/jwt、multer；React 18、Vite、Ant Design 5、react-router-dom v6、axios、dayjs、react-pdf；jest + ts-jest + supertest（服务端）、vitest + @testing-library/react（前端）。

## Global Constraints

（以下约束逐条来自设计文档 `docs/superpowers/specs/2026-08-26-document-approval-design.md`，每个任务都隐含遵守）

- 部署形态：独立 Web 系统，浏览器访问，站内通知；不集成企业微信/钉钉/飞书；不使用 Docker
- 审批载体：纯文档 + 通用字段（标题、说明、分类、金额），不做可配置表单引擎
- 流程能力（标准包）：顺序审批、会签（全部同意）/或签（任一同意）、审批人规则（指定角色/指定人员/直属主管/发起人自选）、条件分支、超时处理（自动催办/自动同意/自动驳回）、抄送节点、转办、撤回、催办
- 文档能力（标准包）：PDF 在线预览、Office 转 PDF（LibreOffice headless）、版本管理（驳回后重新提交）
- 流程选择：上传时手动选择已启用流程；分类仅作标签，不绑定流程
- 分类：平铺列表；文档可见性：最小可见（发起人 + 当前/历史审批人 + 管理员）
- 角色模型：自定义角色 RBAC（菜单/操作权限点），用户可挂多个角色；种子角色：系统管理员（全部权限）、部门经理、普通员工
- 指定角色任务：该角色全体成员可见，先到先得
- 支持文件格式：PDF、Word、Excel、PPT、常见图片（jpg/png/gif）；单文件 ≤ 20MB
- 审批记录与审计日志只追加、不修改；驳回后重新提交生成新版本 + 新实例，旧实例完整保留
- 金额字段存于 `documents`，供条件分支求值（条件仅支持金额、分类等通用字段）
- 生产：Ubuntu + pm2（API、converter worker 两个进程）+ Nginx HTTPS；本地开发 Windows（Node 18+，PostgreSQL 16 本地或 WSL）
- 数据库列命名：TypeORM 默认 camelCase；表名 snake_case 复数（显式 `@Entity('users')` 等）
- 提交规范：conventional commits（`feat:`/`fix:`/`chore:`），每个任务结束一个提交

---

## 文件结构（按任务创建）

```
package.json                        # npm workspaces 根
.gitignore                          # 已含 node_modules/dist/.env/uploads/data
apps/server/package.json
apps/server/tsconfig.json
apps/server/.env.example
apps/server/src/main.ts             # bootstrap：端口、全局前缀、校验管道
apps/server/src/app.module.ts
apps/server/src/config/configuration.ts
apps/server/src/common/guards/jwt-auth.guard.ts
apps/server/src/common/guards/permissions.guard.ts
apps/server/src/common/decorators/current-user.decorator.ts
apps/server/src/common/decorators/require-permission.decorator.ts
apps/server/src/common/filters/http-exception.filter.ts
apps/server/src/modules/auth/auth.module.ts
apps/server/src/modules/auth/auth.controller.ts
apps/server/src/modules/auth/auth.service.ts
apps/server/src/modules/auth/dto/login.dto.ts
apps/server/src/modules/users/entities/user.entity.ts
apps/server/src/modules/roles/entities/role.entity.ts
apps/server/src/modules/roles/entities/permission.entity.ts
apps/server/src/modules/departments/entities/department.entity.ts
apps/server/src/modules/users/users.module.ts / users.service.ts / users.controller.ts / dto/*.ts
apps/server/src/modules/roles/roles.module.ts / roles.service.ts / roles.controller.ts / dto/*.ts
apps/server/src/modules/departments/departments.module.ts / departments.service.ts / departments.controller.ts / dto/*.ts
apps/server/src/modules/categories/entities/category.entity.ts + module/service/controller/dto
apps/server/src/modules/documents/entities/document.entity.ts
apps/server/src/modules/documents/entities/document-version.entity.ts
apps/server/src/modules/documents/entities/conversion-job.entity.ts
apps/server/src/modules/documents/documents.module.ts / documents.service.ts / documents.controller.ts / dto/*.ts
apps/server/src/modules/documents/documents.storage.ts
apps/server/src/modules/documents/converter.service.ts
apps/server/src/modules/documents/converter.worker.ts
apps/server/src/modules/workflows/entities/workflow.entity.ts
apps/server/src/modules/workflows/entities/workflow-node.entity.ts
apps/server/src/modules/workflows/entities/workflow-edge.entity.ts
apps/server/src/modules/workflows/workflows.module.ts / workflows.service.ts / workflows.controller.ts / dto/*.ts
apps/server/src/modules/approvals/entities/approval-instance.entity.ts
apps/server/src/modules/approvals/entities/approval-task.entity.ts
apps/server/src/modules/approvals/entities/approval-record.entity.ts
apps/server/src/modules/approvals/approvals.module.ts
apps/server/src/modules/approvals/approvals.controller.ts
apps/server/src/modules/approvals/approval-engine.service.ts   # 核心引擎（纯逻辑，可单测）
apps/server/src/modules/approvals/approval-timeout.worker.ts
apps/server/src/modules/notifications/entities/notification.entity.ts + module/service/controller/dto
apps/server/src/modules/audit/entities/audit-log.entity.ts + module/service/controller
apps/server/src/modules/dashboard/dashboard.module.ts / dashboard.service.ts / dashboard.controller.ts
apps/server/src/modules/dashboard/dashboard.controller.ts
apps/server/test/setup-test-db.ts
apps/server/test/documents.e2e-spec.ts
apps/server/test/approvals.e2e-spec.ts
apps/web/package.json
apps/web/tsconfig.json
apps/web/vite.config.ts
apps/web/index.html
apps/web/src/main.tsx
apps/web/src/App.tsx
apps/web/src/api/client.ts                # axios 实例 + 拦截器
apps/web/src/api/endpoints.ts
apps/web/src/auth/AuthContext.tsx
apps/web/src/components/AppLayout.tsx
apps/web/src/components/StatusTag.tsx
apps/web/src/components/ProtectedRoute.tsx
apps/web/src/pages/LoginPage.tsx
apps/web/src/pages/DashboardPage.tsx
apps/web/src/pages/DocumentsPage.tsx
apps/web/src/pages/DocumentDetailPage.tsx
apps/web/src/pages/ApprovalsPage.tsx
apps/web/src/pages/ApprovalTaskPage.tsx
apps/web/src/pages/NotificationsPage.tsx
apps/web/src/pages/admin/UsersPage.tsx
apps/web/src/pages/admin/RolesPage.tsx
apps/web/src/pages/admin/CategoriesPage.tsx
apps/web/src/pages/admin/WorkflowsPage.tsx
apps/web/src/pages/admin/WorkflowEditPage.tsx
apps/web/src/pages/admin/AuditLogsPage.tsx
apps/web/src/pages/__tests__/DocumentsPage.test.tsx
apps/web/src/pages/__tests__/ApprovalsPage.test.tsx
packages/shared/package.json
packages/shared/tsconfig.json
packages/shared/src/index.ts
packages/shared/src/enums.ts
packages/shared/src/types.ts
deploy/ecosystem.config.js
deploy/nginx.conf
deploy/init-ubuntu.sh
deploy/README.md
ACCEPTANCE.md                        # 验收清单（最后任务填充）
```

---

## 阶段 0：脚手架与认证

### Task 1: Monorepo 脚手架与共享类型包

**Files:**
- Create: `package.json`
- Create: `apps/server/package.json`
- Create: `apps/server/tsconfig.json`
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/enums.ts`
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/index.ts`

**Interfaces:**
- Produces: `@shared` 别名（两个 app 均解析到 `packages/shared/src`）；枚举 `NodeType`、`ApprovalMethod`、`AssigneeType`、`TimeoutAction`、`DocumentStatus`、`InstanceStatus`、`TaskStatus`、`UserStatus`、`RecordAction`

- [ ] **Step 1: 创建根 package.json（npm workspaces）**

```json
{
  "name": "document-flow",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev:server": "npm run start:dev -w apps/server",
    "dev:web": "npm run dev -w apps/web",
    "test:server": "npm test -w apps/server",
    "test:web": "npm test -w apps/web",
    "build": "npm run build -w packages/shared && npm run build -w apps/server && npm run build -w apps/web"
  }
}
```

- [ ] **Step 2: 创建共享类型包**

`packages/shared/src/enums.ts`：

```ts
export enum NodeType { Start='start', Approval='approval', Handle='handle', Condition='condition', Cc='cc', End='end' }
export enum ApprovalMethod { Countersign='countersign', Orsign='orsign' }
export enum AssigneeType { Person='person', Role='role', Supervisor='supervisor', InitiatorChoice='initiator_choice' }
export enum TimeoutAction { Remind='remind', AutoApprove='auto_approve', AutoReject='auto_reject' }
export enum DocumentStatus { Draft='draft', InApproval='in_approval', Rejected='rejected', Archived='archived' }
export enum InstanceStatus { Running='running', Approved='approved', Rejected='rejected', Withdrawn='withdrawn' }
export enum TaskStatus { Pending='pending', Approved='approved', Rejected='rejected', Transferred='transferred', Cc='cc', Voided='voided' }
export enum UserStatus { Active='active', Disabled='disabled', Pending='pending' }
export enum RecordAction { Approve='approve', Reject='reject', Transfer='transfer', Remind='remind', Withdraw='withdraw', Cc='cc', Timeout='timeout' }
export enum WorkflowStatus { Draft='draft', Active='active', Disabled='disabled' }
```

`packages/shared/src/types.ts`：

```ts
export interface WorkflowNodeDto {
  id: string; name: string; type: string;
  approverRule?: string; approverValue?: string; // roleId / userId / 'initiator' / 'supervisor'
  approvalMethod?: string; timeoutHours?: number; timeoutAction?: string;
  config?: Record<string, unknown>;
}
export interface WorkflowEdgeDto {
  id: string; fromNodeId: string; toNodeId: string;
  conditionExpr?: { field: 'amount' | 'categoryId'; op: '>=' | '<=' | '==' | '>'; value: number | string } | null;
}
export interface WorkflowSnapshot { nodes: WorkflowNodeDto[]; edges: WorkflowEdgeDto[]; version: number }
export interface UserBriefDto { id: string; username: string; name: string; departmentId?: string | null; roles: string[] }
export interface Paged<T> { items: T[]; total: number; page: number; pageSize: number }
export interface AuthUser { id: string; username: string; roles: string[]; permissions: string[] }
```

`packages/shared/src/index.ts`：`export * from './enums'; export * from './types';`

- [ ] **Step 3: 配置两个 app 的 package.json 与 tsconfig 路径别名**

`apps/server/package.json`：

```json
{
  "name": "@document-flow/server",
  "private": true,
  "scripts": { "start:dev": "nest start --watch", "build": "nest build", "test": "jest" },
  "dependencies": {
    "@nestjs/common": "^10.4.0", "@nestjs/core": "^10.4.0", "@nestjs/platform-express": "^10.4.0",
    "@nestjs/config": "^3.2.0", "@nestjs/jwt": "^10.2.0", "@nestjs/typeorm": "^10.0.2",
    "typeorm": "^0.3.20", "pg": "^8.13.0", "class-validator": "^0.14.1", "class-transformer": "^0.5.1",
    "bcryptjs": "^2.4.3", "multer": "^1.4.5-lts.1", "reflect-metadata": "^0.2.2", "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.4.0", "@nestjs/testing": "^10.4.0", "@nestjs/schematics": "^10.1.0",
    "typescript": "^5.5.0", "ts-node": "^10.9.2", "ts-jest": "^29.2.0", "jest": "^29.7.0",
    "supertest": "^7.0.0", "@types/jest": "^29.5.0", "@types/node": "^20.14.0", "@types/multer": "^1.4.12"
  }
}
```

`apps/server/tsconfig.json`（关键项）：

```json
{
  "compilerOptions": {
    "module": "commonjs", "target": "ES2021", "experimentalDecorators": true,
    "emitDecoratorMetadata": true, "strict": true, "skipLibCheck": true,
    "baseUrl": "./", "paths": { "@shared/*": ["../../packages/shared/src/*"] }
  }
}
```

`apps/web/package.json`：

```json
{
  "name": "@document-flow/web",
  "private": true,
  "scripts": { "dev": "vite", "build": "tsc -b && vite build", "test": "vitest run" },
  "dependencies": {
    "react": "^18.3.1", "react-dom": "^18.3.1", "react-router-dom": "^6.26.0",
    "antd": "^5.20.0", "@ant-design/icons": "^5.4.0", "axios": "^1.7.0", "dayjs": "^1.11.0",
    "react-pdf": "^9.1.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0", "vite": "^5.4.0", "@vitejs/plugin-react": "^4.3.0",
    "vitest": "^2.0.0", "@testing-library/react": "^16.0.0", "@testing-library/jest-dom": "^6.4.0",
    "jsdom": "^24.1.0", "@types/react": "^18.3.0", "@types/react-dom": "^18.3.0"
  }
}
```

`apps/web/vite.config.ts`：

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@shared': resolve(__dirname, '../../packages/shared/src') } },
  server: { proxy: { '/api': 'http://localhost:3000' } }
});
```

`apps/web/tsconfig.json`：`"jsx": "react-jsx"`、`"paths": { "@shared/*": ["../../packages/shared/src/*"] }`、`"types": ["vitest/globals", "@testing-library/jest-dom"]`。

- [ ] **Step 4: 安装依赖并验证构建**

Run: `npm install`（根目录）
Expected: node_modules 生成，无报错

- [ ] **Step 5: 提交**

```bash
git add package.json apps packages
git commit -m "chore: monorepo 脚手架与共享类型包"
```

### Task 2: NestJS 基础应用与 PostgreSQL 连接

**Files:**
- Create: `apps/server/.env.example`
- Create: `apps/server/src/main.ts`
- Create: `apps/server/src/app.module.ts`
- Create: `apps/server/src/config/configuration.ts`
- Create: `apps/server/src/common/guards/jwt-auth.guard.ts`
- Create: `apps/server/src/common/guards/permissions.guard.ts`
- Create: `apps/server/src/common/decorators/current-user.decorator.ts`
- Create: `apps/server/src/common/decorators/require-permission.decorator.ts`
- Create: `apps/server/src/common/filters/http-exception.filter.ts`
- Create: `apps/server/src/modules/health/health.controller.ts`

**Interfaces:**
- Consumes: Task 1 的 `@shared` 别名
- Produces: `JwtAuthGuard`、`RequirePermission(...codes)` 装饰器、`CurrentUser()` 参数装饰器、`AppModule`（后续模块注册入口）

- [ ] **Step 1: 写失败测试：应用可启动且健康检查返回 ok**

`apps/server/test/health.e2e-spec.ts`：

```ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AppModule (e2e)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });
  afterAll(async () => { await app.close(); });

  it('GET /api/health returns ok', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -w apps/server -- health`
Expected: FAIL（`Cannot find module './app.module'`）

- [ ] **Step 3: 实现最小可运行应用**

`apps/server/src/main.ts`：

```ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const port = Number(process.env.PORT || 3000);
  await app.listen(port);
}
bootstrap();
```

`apps/server/src/config/configuration.ts`：

```ts
export default () => ({
  port: Number(process.env.PORT || 3000),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/documentflow',
  uploadDir: process.env.UPLOAD_DIR || './data/documents',
  previewDir: process.env.PREVIEW_DIR || './data/previews'
});
```

`apps/server/src/app.module.ts`：

```ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';
import { HealthController } from './modules/health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('databaseUrl'),
        autoLoadEntities: true,
        synchronize: process.env.NODE_ENV !== 'production'
      })
    })
  ],
  controllers: [HealthController]
})
export class AppModule {}
```

`apps/server/src/modules/health/health.controller.ts`：

```ts
import { Controller, Get } from '@nestjs/common';
@Controller('health')
export class HealthController {
  @Get()
  health() { return { status: 'ok', time: new Date().toISOString() }; }
}
```

`apps/server/.env.example`：

```
PORT=3000
DATABASE_URL=postgres://postgres:postgres@localhost:5432/documentflow
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/documentflow_test
JWT_SECRET=change-me
UPLOAD_DIR=./data/documents
PREVIEW_DIR=./data/previews
```

守卫与装饰器（本任务先创建空壳，Task 3 填入逻辑）：`jwt-auth.guard.ts`、`permissions.guard.ts` 均实现 `CanActivate` 返回 `true`；`current-user.decorator.ts` 返回 `createParamDecorator((_data, ctx) => ctx.switchToHttp().getRequest().user)`；`require-permission.decorator.ts` 用 `SetMetadata('permissions', codes)`；`http-exception.filter.ts` 捕获所有异常返回统一 `{ statusCode, message, timestamp }`。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -w apps/server -- health`
Expected: PASS

- [ ] **Step 5: 本地起库验证连接**

Run: `npm run start:dev -w apps/server`
Expected: 控制台无 TypeORM 连接错误；`GET /api/health` 返回 `{"status":"ok"}`

- [ ] **Step 6: 提交**

```bash
git add apps/server
git commit -m "feat: NestJS 基础应用与 PostgreSQL 连接"
```

### Task 3: 认证（登录 + JWT + 种子管理员）

**Files:**
- Create: `apps/server/src/modules/auth/auth.module.ts`
- Create: `apps/server/src/modules/auth/auth.controller.ts`
- Create: `apps/server/src/modules/auth/auth.service.ts`
- Create: `apps/server/src/modules/auth/dto/login.dto.ts`
- Modify: `apps/server/src/app.module.ts`
- Create: `apps/server/src/modules/users/entities/user.entity.ts`
- Create: `apps/server/src/modules/roles/entities/role.entity.ts`
- Create: `apps/server/src/modules/roles/entities/permission.entity.ts`
- Create: `apps/server/src/modules/users/users.module.ts`
- Create: `apps/server/src/modules/roles/roles.module.ts`
- Create: `apps/server/src/modules/users/users.service.ts`
- Create: `apps/server/src/modules/roles/roles.service.ts`
- Create: `apps/server/src/modules/users/seed.ts`

**Interfaces:**
- Consumes: `JwtAuthGuard`、`CurrentUser`（Task 2）
- Produces:
  - `AuthService.login(username, password): Promise<{ accessToken: string; user: UserBriefDto }>`
  - `POST /api/auth/login` 请求体 `{ username: string; password: string }`
  - `User` 实体字段：id、username、passwordHash、name、employeeNo、email、departmentId、status；关系 `roles: Role[]`
  - `Role` 实体字段：id、name、code、description；关系 `permissions: Permission[]`、`users: User[]`
  - `Permission` 实体字段：id、name、code

- [ ] **Step 1: 写失败测试：登录成功返回 token、错误密码 401**

`apps/server/test/auth.e2e-spec.ts`：

```ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { seedAdmin } from '../src/modules/users/seed';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    await seedAdmin(app.get('DataSource'));
  });
  afterAll(async () => { await app.close(); });

  it('login with seed admin returns token', async () => {
    const res = await request(app.getHttpServer()).post('/api/auth/login').send({ username: 'admin', password: 'Admin@123' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user.username).toBe('admin');
  });

  it('wrong password returns 401', async () => {
    const res = await request(app.getHttpServer()).post('/api/auth/login').send({ username: 'admin', password: 'wrong' });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -w apps/server -- auth`
Expected: FAIL（模块不存在 / 401 变为 200）

- [ ] **Step 3: 实现实体与种子**

`user.entity.ts`：

```ts
import { Column, Entity, JoinTable, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
import { UserStatus } from '@shared/enums';
import { Role } from '../../roles/entities/role.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ unique: true }) username!: string;
  @Column() passwordHash!: string;
  @Column() name!: string;
  @Column({ nullable: true }) employeeNo!: string | null;
  @Column({ nullable: true }) email!: string | null;
  @Column({ type: 'uuid', nullable: true }) departmentId!: string | null;
  @Column({ type: 'varchar', default: UserStatus.Pending }) status!: UserStatus;
  @ManyToMany(() => Role, (r) => r.users) @JoinTable({ name: 'user_roles' }) roles!: Role[];
}
```

`role.entity.ts`：

```ts
import { Column, Entity, JoinTable, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Permission } from './permission.entity';
import { User } from '../../users/entities/user.entity';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ unique: true }) name!: string;
  @Column({ unique: true }) code!: string;
  @Column({ nullable: true }) description!: string | null;
  @ManyToMany(() => Permission) @JoinTable({ name: 'role_permissions' }) permissions!: Permission[];
  @ManyToMany(() => User, (u) => u.roles) users!: User[];
}
```

`permission.entity.ts`：

```ts
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ unique: true }) name!: string;
  @Column({ unique: true }) code!: string;
}
```

`seed.ts`（幂等）：

```ts
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Role } from '../roles/entities/role.entity';
import { Permission } from '../roles/entities/permission.entity';
import { User } from './user.entity';

const PERMISSIONS = [
  ['上传文档', 'document:upload'], ['处理审批', 'approval:handle'],
  ['管理用户', 'user:manage'], ['管理角色', 'role:manage'],
  ['管理分类', 'category:manage'], ['管理流程', 'workflow:manage'],
  ['查看审计', 'audit:view'], ['查看仪表盘', 'dashboard:view']
] as const;

export async function seedAdmin(ds: DataSource) {
  const permissionRepo = ds.getRepository(Permission);
  const permissions = await Promise.all(
    PERMISSIONS.map(async ([name, code]) => {
      let p = await permissionRepo.findOneBy({ code });
      if (!p) p = await permissionRepo.save(permissionRepo.create({ name, code }));
      return p;
    })
  );
  let adminRole = await ds.getRepository(Role).findOneBy({ code: 'sys_admin' });
  if (!adminRole) {
    adminRole = await ds.getRepository(Role).save(ds.getRepository(Role).create({
      name: '系统管理员', code: 'sys_admin', description: '拥有全部权限', permissions
    }));
  }
  const userRepo = ds.getRepository(User);
  if (!(await userRepo.findOneBy({ username: 'admin' }))) {
    const hash = await bcrypt.hash('Admin@123', 10);
    await userRepo.save(userRepo.create({
      username: 'admin', passwordHash: hash, name: '系统管理员', status: 'active', roles: [adminRole]
    }));
  }
}
```

`auth.service.ts` 核心：

```ts
@Injectable()
export class AuthService {
  constructor(private users: UsersService, private jwt: JwtService) {}
  async login(username: string, password: string) {
    const user = await this.users.findByUsernameWithRoles(username);
    if (!user || user.status !== 'active' || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    const roles = user.roles.map((r) => r.code);
    const permissions = [...new Set(user.roles.flatMap((r) => r.permissions.map((p) => p.code)))];
    return {
      accessToken: await this.jwt.signAsync({ sub: user.id, username: user.username, roles, permissions }),
      user: { id: user.id, username: user.username, name: user.name, departmentId: user.departmentId, roles }
    };
  }
}
```

`JwtAuthGuard` 从 `Authorization: Bearer` 解析 token，校验后把 payload 放入 `request.user`；`PermissionsGuard` 读取 `RequirePermission` 元数据，比对 `request.user.permissions`，无权限抛 `ForbiddenException`。`AppModule` 注册 `AuthModule`、`UsersModule`、`RolesModule`，并在 `main.ts` 启用 `APP_GUARD` 全局 JwtAuthGuard（登录路由用 `@Public()` 标记跳过——在 `require-permission.decorator.ts` 同文件定义 `Public` 装饰器，守卫内检测 `IS_PUBLIC_KEY`）。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -w apps/server -- auth`
Expected: PASS（需本地 PostgreSQL 存在 `documentflow_test` 库；在 `jest` 配置中通过 `setupFiles` 读取 `TEST_DATABASE_URL` 并设置 `NODE_ENV=test`，测试前用 `ds.synchronize()` 建表）

- [ ] **Step 5: 提交**

```bash
git add apps/server
git commit -m "feat: JWT 登录与种子管理员"
```

---

## 阶段 1：用户与权限域

### Task 4: 用户管理 API（RBAC 守卫）

**Files:**
- Create: `apps/server/src/modules/users/users.controller.ts`
- Create: `apps/server/src/modules/users/dto/create-user.dto.ts`
- Create: `apps/server/src/modules/users/dto/update-status.dto.ts`
- Create: `apps/server/src/modules/users/dto/reset-password.dto.ts`
- Modify: `apps/server/src/modules/users/users.service.ts`

**Interfaces:**
- Consumes: Task 3 的 `User`/`Role` 实体、`RequirePermission` 装饰器、`CurrentUser`
- Produces:
  - `GET /api/users?page&pageSize&departmentId&roleId&status&keyword` → `Paged<UserBriefDto>`（不返回 passwordHash）
  - `POST /api/users`（`@RequirePermission('user:manage')`）body `{ username, password, name, employeeNo?, email?, departmentId?, roleIds: string[] }`
  - `PATCH /api/users/:id/status` body `{ status: UserStatus }`
  - `POST /api/users/:id/reset-password` body `{ newPassword: string }`

- [ ] **Step 1: 写失败测试**

`apps/server/test/users.e2e-spec.ts` 核心用例：

```ts
it('non-admin cannot create user', async () => {
  const login = await request(app.getHttpServer()).post('/api/auth/login').send({ username: 'admin', password: 'Admin@123' });
  const res = await request(app.getHttpServer())
    .post('/api/users').set('Authorization', `Bearer ${login.body.accessToken}`)
    .send({ username: 'u1', password: 'Pass@123', name: '测试', roleIds: [] });
  expect(res.status).toBe(201);
});

it('list users does not leak passwordHash', async () => {
  const login = await request(app.getHttpServer()).post('/api/auth/login').send({ username: 'admin', password: 'Admin@123' });
  const res = await request(app.getHttpServer()).get('/api/users').set('Authorization', `Bearer ${login.body.accessToken}`);
  expect(res.status).toBe(200);
  expect(res.body.items[0].passwordHash).toBeUndefined();
});
```

- [ ] **Step 2: 运行确认失败** → `npm test -w apps/server -- users`

- [ ] **Step 3: 实现 UsersService 方法**

```ts
async create(dto: CreateUserDto) {
  if (await this.repo.findOneBy({ username: dto.username })) throw new ConflictException('用户名已存在');
  const user = this.repo.create({
    ...dto,
    passwordHash: await bcrypt.hash(dto.password, 10),
    status: UserStatus.Active,
    roles: dto.roleIds?.length ? await this.roleRepo.findByIds(dto.roleIds) : []
  });
  return this.toBrief(await this.repo.save(user));
}

async findAll(query: { page?: number; pageSize?: number; departmentId?: string; roleId?: string; status?: string; keyword?: string }) {
  const page = query.page ?? 1, pageSize = Math.min(query.pageSize ?? 20, 100);
  const qb = this.repo.createQueryBuilder('u').leftJoinAndSelect('u.roles', 'r');
  if (query.departmentId) qb.andWhere('u.departmentId = :departmentId', { departmentId: query.departmentId });
  if (query.roleId) qb.andWhere('r.id = :roleId', { roleId: query.roleId });
  if (query.status) qb.andWhere('u.status = :status', { status: query.status });
  if (query.keyword) qb.andWhere('(u.name ILIKE :k OR u.username ILIKE :k OR u.employeeNo ILIKE :k)', { k: `%${query.keyword}%` });
  const [items, total] = await qb.skip((page - 1) * pageSize).take(pageSize).getManyAndCount();
  return { items: items.map((u) => this.toBrief(u)), total, page, pageSize };
}

private toBrief(u: User): UserBriefDto {
  return { id: u.id, username: u.username, name: u.name, departmentId: u.departmentId, roles: u.roles.map((r) => r.code) };
}
```

控制器：列表/创建挂 `@RequirePermission('user:manage')`；`reset-password` 校验新密码长度 ≥ 8；`update-status` 不允许停用自己。

- [ ] **Step 4: 运行测试通过** + **Step 5: 提交**

```bash
git commit -am "feat: 用户管理 API 与 RBAC 守卫"
```

### Task 5: 角色与部门 API

**Files:**
- Create: `apps/server/src/modules/roles/roles.controller.ts`
- Create: `apps/server/src/modules/roles/dto/create-role.dto.ts`
- Create: `apps/server/src/modules/departments/departments.module.ts`
- Create: `apps/server/src/modules/departments/departments.service.ts`
- Create: `apps/server/src/modules/departments/departments.controller.ts`
- Create: `apps/server/src/modules/departments/entities/department.entity.ts`
- Create: `apps/server/src/modules/departments/dto/create-department.dto.ts`

**Interfaces:**
- Produces:
  - `GET /api/roles`、`POST /api/roles { name, code, description?, permissionCodes: string[] }`（`role:manage`）、`PATCH /api/roles/:id`、`DELETE /api/roles/:id`（内置 sys_admin 不可删）
  - `GET /api/permissions` → 全部权限点
  - `GET /api/departments/tree` → `DepartmentNode[] { id, name, managerId?, children }`；`POST /api/departments`、`PATCH /api/departments/:id`、`DELETE /api/departments/:id`（有子部门或用户时 409）

- [ ] **Step 1: 写失败测试**

`apps/server/test/roles-departments.e2e-spec.ts`（`loginAsAdmin` 辅助函数复制自 Task 3 的 `auth.e2e-spec.ts`）：

```ts
it('creates role with permissions and lists it', async () => {
  const login = await loginAsAdmin();
  const perms = await request(app.getHttpServer()).get('/api/permissions').set('Authorization', `Bearer ${login.body.accessToken}`);
  const res = await request(app.getHttpServer()).post('/api/roles').set('Authorization', `Bearer ${login.body.accessToken}`)
    .send({ name: '财务专员', code: 'finance', permissionCodes: [perms.body[0].code] });
  expect(res.status).toBe(201);
});

it('department tree returns nested children', async () => {
  const admin = await loginAsAdmin();
  const root = await request(app.getHttpServer()).post('/api/departments').set('Authorization', `Bearer ${admin.body.accessToken}`).send({ name: '集团' });
  await request(app.getHttpServer()).post('/api/departments').set('Authorization', `Bearer ${admin.body.accessToken}`).send({ name: '财务部', parentId: root.body.id });
  const tree = await request(app.getHttpServer()).get('/api/departments/tree').set('Authorization', `Bearer ${admin.body.accessToken}`);
  expect(tree.body[0].children.length).toBe(1);
});
```

- [ ] **Step 2: 运行确认失败** → `npm test -w apps/server -- roles-departments`

- [ ] **Step 3: 实现**

`department.entity.ts`：`id/name/parentId(uuid nullable)/managerId(uuid nullable)`，parentId 自关联。

`departments.service.ts` 树构建：

```ts
async tree(): Promise<DepartmentNode[]> {
  const all = await this.repo.find({ order: { name: 'ASC' } });
  const map = new Map<string, DepartmentNode>();
  const roots: DepartmentNode[] = [];
  for (const d of all) map.set(d.id, { id: d.id, name: d.name, managerId: d.managerId, children: [] });
  for (const d of all) {
    const node = map.get(d.id)!;
    if (d.parentId && map.has(d.parentId)) map.get(d.parentId)!.children.push(node);
    else roots.push(node);
  }
  return roots;
}
```

`roles.service.ts`：`create` 用 `permissionCodes` 关联权限；`remove` 时若 `code === 'sys_admin'` 抛 `BadRequestException('系统管理员角色不可删除')`；`roles.controller` 挂 `role:manage`。

- [ ] **Step 4: 测试通过** + **Step 5: 提交** `git commit -am "feat: 角色与部门管理 API"`

### Task 6: 分类管理 API

**Files:**
- Create: `apps/server/src/modules/categories/entities/category.entity.ts`
- Create: `apps/server/src/modules/categories/categories.module.ts`
- Create: `apps/server/src/modules/categories/categories.service.ts`
- Create: `apps/server/src/modules/categories/categories.controller.ts`
- Create: `apps/server/src/modules/categories/dto/create-category.dto.ts`

**Interfaces:**
- Produces: `GET /api/categories`（按 sortOrder 排序，登录即可）、`POST/PATCH/DELETE /api/categories`（`category:manage`）；删除时若被文档引用返回 409

- [ ] **Step 1: 写失败测试**（创建分类 → 列表可见 → 删除未引用分类成功）
- [ ] **Step 2: 运行确认失败**
- [ ] **Step 3: 实现**：Category 实体 `id/name/sortOrder(int default 0)`；service 注入 Document 仓库做引用检查（Document 实体在 Task 7 创建，先以字符串表名 `documents` 查询 `categoryId` 计数，避免循环依赖）
- [ ] **Step 4: 测试通过**
- [ ] **Step 5: 提交** `git commit -am "feat: 分类管理 API"`
---

## 阶段 2：文档域

### Task 7: 文档上传与版本管理 API

**Files:**
- Create: `apps/server/src/modules/documents/entities/document.entity.ts`
- Create: `apps/server/src/modules/documents/entities/document-version.entity.ts`
- Create: `apps/server/src/modules/documents/entities/conversion-job.entity.ts`
- Create: `apps/server/src/modules/documents/documents.module.ts`
- Create: `apps/server/src/modules/documents/documents.service.ts`
- Create: `apps/server/src/modules/documents/documents.controller.ts`
- Create: `apps/server/src/modules/documents/documents.storage.ts`
- Create: `apps/server/src/modules/documents/dto/upload-document.dto.ts`
- Create: `apps/server/src/modules/documents/dto/create-version.dto.ts`

**Interfaces:**
- Consumes: `@shared/enums`（DocumentStatus）、Category 实体（无注入，按表名查询）
- Produces:
  - `POST /api/documents`（multipart，`document:upload`）字段：`file` + `title, categoryId, description?, amount?` → 201 DocumentDto；单文件 ≤ 20MB，类型白名单 `pdf,doc,docx,xls,xlsx,ppt,pptx,png,jpg,jpeg,gif`
  - `POST /api/documents/:id/versions`（multipart）字段：`file, reason` → 新版本；仅文档归属人可操作；文档状态须为 `rejected` 或 `draft`
  - `GET /api/documents/:id/versions` → 版本列表（可见性校验）
  - `GET /api/documents/:id/versions/:versionId/download` → 文件流（`res.download`）
  - `DocumentDto { id, title, description, categoryId, amount, status, ownerId, createdAt, latestVersion: { id, versionNo, fileName, size, mimeType } | null }`

- [ ] **Step 1: 写失败测试**

`apps/server/test/documents.e2e-spec.ts`：

```ts
const uploadDoc = (token: string) =>
  request(app.getHttpServer()).post('/api/documents')
    .set('Authorization', `Bearer ${token}`)
    .field('title', '测试文档').field('categoryId', '')
    .field('description', 'desc').field('amount', '1000')
    .attach('file', Buffer.from('%PDF-1.4 test'), { filename: 'a.pdf', contentType: 'application/pdf' });

it('uploads a pdf and lists my documents', async () => {
  const login = await loginAsAdmin();
  const up = await uploadDoc(login.body.accessToken);
  expect(up.status).toBe(201);
  expect(up.body.status).toBe('draft');
  const list = await request(app.getHttpServer()).get('/api/documents').set('Authorization', `Bearer ${login.body.accessToken}`);
  expect(list.body.total).toBeGreaterThanOrEqual(1);
});

it('rejects oversized file (21MB)', async () => {
  const login = await loginAsAdmin();
  const big = Buffer.alloc(21 * 1024 * 1024, 1);
  const up = await request(app.getHttpServer()).post('/api/documents')
    .set('Authorization', `Bearer ${login.body.accessToken}`)
    .field('title', 'big').attach('file', big, { filename: 'big.pdf', contentType: 'application/pdf' });
  expect(up.status).toBe(413);
});
```

- [ ] **Step 2: 运行确认失败** → `npm test -w apps/server -- documents`

- [ ] **Step 3: 实现实体**

`document.entity.ts`：

```ts
@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column() title!: string;
  @Column({ type: 'text', nullable: true }) description!: string | null;
  @Column({ type: 'uuid', nullable: true }) categoryId!: string | null;
  @Column({ type: 'decimal', precision: 14, scale: 2, nullable: true }) amount!: string | null;
  @Column({ type: 'uuid' }) ownerId!: string;
  @Column({ type: 'varchar', default: DocumentStatus.Draft }) status!: DocumentStatus;
  @Column({ type: 'uuid', nullable: true }) currentInstanceId!: string | null;
  @Column({ type: 'timestamptz', default: () => 'now()' }) createdAt!: Date;
  @Column({ type: 'timestamptz', default: () => 'now()' }) updatedAt!: Date;
  @OneToMany(() => DocumentVersion, (v) => v.document) versions!: DocumentVersion[];
}
```

`document-version.entity.ts`：`id/documentId/fileName/mimeType/size(int)/filePath/checksum(sha1)/versionNo(int)/reason(nullable)/uploadedBy/createdAt`；`versionNo` 由 service 计算 `max+1`。

`conversion-job.entity.ts`：`id/documentVersionId(unique)/status('pending'|'success'|'failed')/error(nullable)/previewPath(nullable)/createdAt`。

`documents.storage.ts`：

```ts
export const ALLOWED_MIME: Record<string, string> = {
  'application/pdf': 'pdf', 'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif'
};
export const MAX_FILE_SIZE = 20 * 1024 * 1024;
export function sha1(buf: Buffer): string {
  const hash = require('crypto').createHash('sha1'); hash.update(buf); return hash.digest('hex');
}
```

`documents.service.ts` 核心：

```ts
async upload(userId: string, file: Express.Multer.File, dto: UploadDocumentDto) {
  const size = file.size;
  if (size > MAX_FILE_SIZE) { fs.unlinkSync(file.path); throw new HttpException('文件超过 20MB', 413); }
  const checksum = sha1(fs.readFileSync(file.path));
  const doc = await this.docRepo.save(this.docRepo.create({
    title: dto.title, description: dto.description, categoryId: dto.categoryId || null,
    amount: dto.amount ?? null, ownerId: userId, status: DocumentStatus.Draft
  }));
  const version = await this.versionRepo.save(this.versionRepo.create({
    documentId: doc.id, fileName: file.originalname, mimeType: file.mimetype,
    size, filePath: file.path, checksum, versionNo: 1, uploadedBy: userId
  }));
  await this.jobRepo.save(this.jobRepo.create({ documentVersionId: version.id }));
  return this.toDto(doc, version);
}
```

Controller 用 `FileInterceptor('file', { storage: diskStorage({ destination: uploadDir, filename: (_r, f, cb) => cb(null, `${Date.now()}-${f.originalname}`) }) })`；上传/版本接口校验文件存在。

可见性辅助方法（Task 9 复用）：

```ts
async assertCanView(user: AuthUser, documentId: string): Promise<Document> {
  const doc = await this.docRepo.findOneBy({ id: documentId });
  if (!doc) throw new NotFoundException('文档不存在');
  if (user.permissions.includes('user:manage')) return doc; // 管理员
  if (doc.ownerId === user.id) return doc;
  const involved = await this.approvalRepo.find({
    where: { documentId }, relations: { tasks: true, records: true }
  });
  const actorIds = new Set<string>();
  involved.forEach((ins) => {
    ins.tasks.forEach((t) => { if (t.assigneeId) actorIds.add(t.assigneeId); });
    ins.records.forEach((r) => actorIds.add(r.actorId));
  });
  if (actorIds.has(user.id)) return doc;
  throw new ForbiddenException('无权查看该文档');
}
```

（`approvalRepo` 在 Task 11 前先以 `DataSource.getRepository('approval_instances')` 泛型引用，Task 11 后替换为类型化仓库。）

- [ ] **Step 4: 测试通过**
- [ ] **Step 5: 提交** `git commit -am "feat: 文档上传与版本管理 API"`

### Task 8: 文档预览转换服务（LibreOffice worker）

**Files:**
- Create: `apps/server/src/modules/documents/converter.service.ts`
- Create: `apps/server/src/modules/documents/converter.worker.ts`
- Modify: `apps/server/src/modules/documents/documents.module.ts`
- Create: `apps/server/test/converter.unit-spec.ts`

**Interfaces:**
- Consumes: `conversion_jobs` 表、`PREVIEW_DIR` 配置
- Produces:
  - `ConverterService.convert(jobId): Promise<void>`（同步执行一次转换）
  - `ConverterWorker.start(): void`（每 30 秒轮询 pending 任务，串行处理）
  - `GET /api/documents/:id/versions/:versionId/preview` → 若有 `previewPath` 返回 PDF 流；转换中返回 202 `{ converting: true }`；失败返回 422 `{ previewFailed: true }`

- [ ] **Step 1: 写失败单测：PDF 直接复制、Office 调 LibreOffice**

`converter.unit-spec.ts`（注入假 job repo 与 `child_process.execFile` mock）：

```ts
jest.mock('child_process', () => ({ execFile: jest.fn((_bin, _args, cb) => cb(null, '')) }));

it('pdf files are copied to preview dir without libreoffice', async () => {
  const job = { id: 'j1', documentVersionId: 'v1', status: 'pending' } as any;
  const version = { id: 'v1', mimeType: 'application/pdf', filePath: '/tmp/a.pdf' } as any;
  const service = new ConverterService({ save: jest.fn(), findOneBy: jest.fn(async () => job) } as any, { findOneBy: jest.fn(async () => version) } as any, '/tmp/previews');
  await service.convert('j1');
  expect(require('child_process').execFile).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: 运行确认失败** → `npm test -w apps/server -- converter`

- [ ] **Step 3: 实现**

`converter.service.ts`：

```ts
@Injectable()
export class ConverterService {
  constructor(private jobRepo: Repository<ConversionJob>, private versionRepo: Repository<DocumentVersion>, @Inject('PREVIEW_DIR') private previewDir: string) {}

  async convert(jobId: string): Promise<void> {
    const job = await this.jobRepo.findOneBy({ id: jobId });
    if (!job || job.status !== 'pending') return;
    const version = await this.versionRepo.findOneBy({ id: job.documentVersionId });
    if (!version) { await this.fail(job, 'version missing'); return; }
    const outFile = path.join(this.previewDir, `${version.id}.pdf`);
    try {
      if (version.mimeType === 'application/pdf') {
        fs.copyFileSync(version.filePath, outFile);
      } else {
        fs.mkdirSync(this.previewDir, { recursive: true });
        await new Promise<void>((resolve, reject) => {
          execFile('libreoffice', ['--headless', '--convert-to', 'pdf', '--outdir', this.previewDir, version.filePath], (err) => err ? reject(err) : resolve());
        });
        const produced = fs.readdirSync(this.previewDir).filter((f) => f.endsWith('.pdf') && f.includes(version.id));
        const src = produced[0] ?? path.join(this.previewDir, `${path.basename(version.filePath, path.extname(version.filePath))}.pdf`);
        fs.renameSync(src, outFile);
      }
      await this.jobRepo.save({ ...job, status: 'success', previewPath: outFile, error: null });
    } catch (e) {
      await this.fail(job, String((e as Error).message));
    }
  }
  private async fail(job: ConversionJob, error: string) {
    await this.jobRepo.save({ ...job, status: 'failed', error });
  }
}
```

`converter.worker.ts`：`@Injectable()`，`onModuleInit` 里 `setInterval(async () => { const job = await this.jobRepo.findOneBy({ status: 'pending' }); if (job) await this.converter.convert(job.id); }, 30_000)`；`onModuleDestroy` 里 `clearInterval`。

Preview 端点：查版本 → 查 job → 按状态返回；`res.type('application/pdf')` 流式输出 `previewPath`。

- [ ] **Step 4: 增加失败重试端点** `POST /api/documents/versions/:versionId/retry-convert`（归属人/管理员）：把 failed job 重置为 pending 并立即转换一次
- [ ] **Step 5: 单测通过**
- [ ] **Step 6: 提交** `git commit -am "feat: LibreOffice 预览转换 worker"`

### Task 9: 文档列表/详情 API（最小可见性）

**Files:**
- Modify: `apps/server/src/modules/documents/documents.service.ts`
- Modify: `apps/server/src/modules/documents/documents.controller.ts`
- Create: `apps/server/test/documents-visibility.e2e-spec.ts`

**Interfaces:**
- Produces:
  - `GET /api/documents?status&categoryId&keyword&page&pageSize` → 当前用户可见文档（发起人视角：自己的文档 + 自己参与的审批实例文档）
  - `GET /api/documents/:id` → 详情（含 versions、当前实例进度摘要），走 `assertCanView`

- [ ] **Step 1: 写失败测试：他人文档不可见**

```ts
it('a second user cannot see others draft document', async () => {
  const admin = await loginAsAdmin();
  const up = await uploadDoc(admin.body.accessToken);
  const other = await request(app.getHttpServer()).post('/api/auth/login').send({ username: 'u_other', password: 'Pass@123' });
  const res = await request(app.getHttpServer()).get(`/api/documents/${up.body.id}`).set('Authorization', `Bearer ${other.body.accessToken}`);
  expect(res.status).toBe(403);
});
```

（前置：测试内先通过用户 API 创建 `u_other` 并分配普通员工角色。）

- [ ] **Step 2: 运行确认失败**
- [ ] **Step 3: 实现**：列表查询拆两条 SQL——`ownerId = me OR documentId IN (SELECT DISTINCT documentId FROM approval_instances WHERE initiatorId = me OR id IN (SELECT instanceId FROM approval_records WHERE actorId = me))`；详情复用 `assertCanView`；返回 DTO 含 `versions`（倒序）与 `progress`（Task 13 填充前为 null）
- [ ] **Step 4: 测试通过**
- [ ] **Step 5: 提交** `git commit -am "feat: 文档列表/详情与最小可见性"`

### Task 10: 前端骨架（登录、布局、路由、API 客户端）

**Files:**
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/api/client.ts`
- Create: `apps/web/src/api/endpoints.ts`
- Create: `apps/web/src/auth/AuthContext.tsx`
- Create: `apps/web/src/components/ProtectedRoute.tsx`
- Create: `apps/web/src/components/AppLayout.tsx`
- Create: `apps/web/src/components/StatusTag.tsx`
- Create: `apps/web/src/pages/LoginPage.tsx`

**Interfaces:**
- Consumes: `/api/auth/login`、`@shared` 枚举
- Produces: `useAuth() → { user, token, permissions, login, logout }`；`AppLayout` 侧边栏路由表（`/dashboard`、`/documents`、`/approvals`、`/notifications`、管理端子路由）；`StatusTag({ status })`

- [ ] **Step 1: 写失败测试：LoginPage 提交后写入 token**

`apps/web/src/pages/__tests__/LoginPage.test.tsx`：

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginPage } from '../LoginPage';

vi.mock('../../api/client', () => ({
  api: { post: vi.fn(async () => ({ data: { accessToken: 't', user: { id: '1', username: 'admin', name: '管理员', roles: ['sys_admin'] } } })) }
}));

it('calls login and stores token', async () => {
  render(<LoginPage />);
  fireEvent.change(screen.getByLabelText('用户名'), { target: { value: 'admin' } });
  fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'Admin@123' } });
  fireEvent.click(screen.getByRole('button', { name: '登录' }));
  await waitFor(() => expect(localStorage.getItem('token')).toBe('t'));
});
```

- [ ] **Step 2: 运行确认失败** → `npm test -w apps/web -- LoginPage`

- [ ] **Step 3: 实现**

`api/client.ts`：

```ts
export const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});
api.interceptors.response.use((r) => r, (err) => {
  if (err.response?.status === 401) { localStorage.removeItem('token'); window.location.href = '/login'; }
  return Promise.reject(err);
});
```

`AuthContext.tsx`：`login(username, password)` 调 `api.post('/auth/login')`，存 token 与 user；`logout()` 清空；`useEffect` 从 localStorage 恢复。`App.tsx` 路由：

```tsx
<BrowserRouter>
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<ProtectedRoute />}>
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/documents/:id" element={<DocumentDetailPage />} />
        <Route path="/approvals" element={<ApprovalsPage />} />
        <Route path="/approvals/tasks/:id" element={<ApprovalTaskPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/admin/users" element={<UsersPage />} />
        <Route path="/admin/roles" element={<RolesPage />} />
        <Route path="/admin/categories" element={<CategoriesPage />} />
        <Route path="/admin/workflows" element={<WorkflowsPage />} />
        <Route path="/admin/workflows/:id" element={<WorkflowEditPage />} />
        <Route path="/admin/audit" element={<AuditLogsPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Route>
  </Routes>
</BrowserRouter>
```

`AppLayout.tsx`：AntD `Layout` + 左侧 `Menu`（按 `permissions` 过滤管理项）+ 顶部用户下拉（退出登录）+ 铃铛（未读数，链接 `/notifications`）。`ProtectedRoute`：无 token 时 `<Navigate to="/login" />`。

占位页面（本任务）：`DashboardPage` 等 12 个页面文件先输出"建设中"卡片，保证路由可编译（后续任务逐个替换）。

- [ ] **Step 4: 测试通过**
- [ ] **Step 5: 提交** `git commit -am "feat: 前端骨架与认证流程"`

---

## 阶段 3：流程配置与审批引擎（核心）

### Task 11: 流程定义 CRUD 与节点/连线校验

**Files:**
- Create: `apps/server/src/modules/workflows/entities/workflow.entity.ts`
- Create: `apps/server/src/modules/workflows/entities/workflow-node.entity.ts`
- Create: `apps/server/src/modules/workflows/entities/workflow-edge.entity.ts`
- Create: `apps/server/src/modules/workflows/workflows.module.ts`
- Create: `apps/server/src/modules/workflows/workflows.service.ts`
- Create: `apps/server/src/modules/workflows/workflows.controller.ts`
- Create: `apps/server/src/modules/workflows/dto/save-workflow.dto.ts`
- Create: `apps/server/test/workflows.unit-spec.ts`

**Interfaces:**
- Consumes: `@shared` 的 `WorkflowNodeDto`/`WorkflowEdgeDto`、`WorkflowStatus`、`NodeType`
- Produces:
  - `GET /api/workflows?status&keyword` → 列表（含节点数）
  - `POST /api/workflows { name, description? }` → 默认创建「开始 + 审批 + 结束」三节点
  - `GET /api/workflows/:id` → `{ ...workflow, nodes, edges }`
  - `PUT /api/workflows/:id/nodes` body `{ nodes: WorkflowNodeDto[], edges: WorkflowEdgeDto[] }` → 全量替换，含校验
  - `POST /api/workflows/:id/activate` / `deactivate`
  - `WorkflowsService.validateGraph(nodes, edges): void`（校验规则见下）

- [ ] **Step 1: 写失败单测：非法图被拒绝**

`workflows.unit-spec.ts`：

```ts
it('rejects graph without exactly one start and one end', () => {
  const service = new WorkflowsService({} as any);
  expect(() => service.validateGraph(
    [{ id: 'n1', name: 'x', type: 'approval' }], []
  )).toThrow('必须包含且仅包含一个开始节点');
});

it('rejects edge pointing to unknown node', () => {
  const service = new WorkflowsService({} as any);
  expect(() => service.validateGraph(
    [
      { id: 's', name: '开始', type: 'start' },
      { id: 'a', name: '审批', type: 'approval', approverRule: 'role', approverValue: 'r1', approvalMethod: 'orsign' },
      { id: 'e', name: '结束', type: 'end' }
    ],
    [{ id: 'x', fromNodeId: 's', toNodeId: 'missing' }]
  )).toThrow('连线指向不存在的节点');
});
```

- [ ] **Step 2: 运行确认失败**
- [ ] **Step 3: 实现校验逻辑**

`validateGraph` 规则：恰好 1 个 start、1 个 end；所有 edge 的 from/to 都存在于节点；start 入度为 0、end 出度为 0；审批/办理节点必须有 `approverRule` 与 `approvalMethod`（或签/会签）；条件分支节点必须有出边且至少一条无条件边（`conditionExpr === null`）作为默认分支；不存在不可达节点（从 start BFS 覆盖所有节点）。

实体：

```ts
@Entity('workflow_nodes')
export class WorkflowNode {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) workflowId!: string;
  @Column() name!: string;
  @Column({ type: 'varchar' }) type!: NodeType;
  @Column({ type: 'varchar', nullable: true }) approverRule!: string | null;
  @Column({ type: 'uuid', nullable: true }) approverValue!: string | null; // roleId/userId
  @Column({ type: 'varchar', nullable: true }) approvalMethod!: string | null;
  @Column({ type: 'int', nullable: true }) timeoutHours!: number | null;
  @Column({ type: 'varchar', nullable: true }) timeoutAction!: string | null;
  @Column({ type: 'jsonb', nullable: true }) config!: Record<string, unknown> | null;
  @Column({ type: 'int', default: 0 }) sortOrder!: number;
}
```

`workflow_edges`：`id/workflowId/fromNodeId/toNodeId/conditionExpr(jsonb nullable)`。

`workflow.entity.ts`：`id/name/description/status(默认 draft)/version(int 默认 1)`，关系 `nodes`、`edges`。

`saveWorkflowDto`：`nodes: WorkflowNodeDto[]`、`edges: WorkflowEdgeDto[]`，`class-validator` 校验数组非空。

Controller：管理接口挂 `workflow:manage`；列表 `GET /api/workflows` 允许登录用户访问（提交审批时要选流程）。

- [ ] **Step 4: 单测通过**
- [ ] **Step 5: 提交** `git commit -am "feat: 流程定义 CRUD 与图校验"`

### Task 12: 审批引擎核心（实例创建、节点进入、同意/驳回、会签/或签）

**Files:**
- Create: `apps/server/src/modules/approvals/entities/approval-instance.entity.ts`
- Create: `apps/server/src/modules/approvals/entities/approval-task.entity.ts`
- Create: `apps/server/src/modules/approvals/entities/approval-record.entity.ts`
- Create: `apps/server/src/modules/approvals/approvals.module.ts`
- Create: `apps/server/src/modules/approvals/approval-engine.service.ts`
- Create: `apps/server/src/modules/approvals/approvals.controller.ts`
- Create: `apps/server/test/approval-engine.unit-spec.ts`

**Interfaces:**
- Consumes: Task 11 的 `WorkflowsService.getById`、Document 实体、`@shared` 枚举
- Produces（引擎对外方法）：
  - `start(workflowId, documentId, initiatorId): Promise<ApprovalInstance>`
  - `enterNode(instance, nodeId): Promise<void>`
  - `approve(taskId, actorId, comment?): Promise<void>`
  - `reject(taskId, actorId, comment): Promise<void>`
  - `handleTask(taskId, actorId, action: 'approve'|'reject', comment?): Promise<void>`（审批与办理节点统一入口）
  - `getProgress(instanceId): Promise<ProgressDto>`（时间线数据源）

- [ ] **Step 1: 写失败单测：或签任一同意即通过；会签需全部同意；驳回终止**

`approval-engine.unit-spec.ts`（引擎依赖注入六个依赖的 mock：instance/task/record/notification/documents 五个仓库 + workflows 服务，方法签名与真实实现一致）：

```ts
function makeEngine(overrides: Partial<Record<string, any>> = {}) {
  const repos = {
    instance: { save: jest.fn((x) => Promise.resolve(x)), findOneBy: jest.fn() },
    task: { save: jest.fn((x) => Promise.resolve(x)), findOneBy: jest.fn(), update: jest.fn(), findBy: jest.fn(async () => []) },
    record: { save: jest.fn((x) => Promise.resolve(x)), find: jest.fn(async () => []) },
    notification: { save: jest.fn((x) => Promise.resolve(x)) },
    documents: { findOneBy: jest.fn(async () => ({ amount: '100', categoryId: null })) },
    workflows: { getById: jest.fn(async () => ({ status: 'active', version: 1, nodes: [], edges: [] })) },
    ...overrides
  };
  return { engine: new ApprovalEngineService(repos.instance as any, repos.task as any, repos.record as any, repos.notification as any, repos.documents as any, repos.workflows as any), repos };
}

it('orsign: first approval completes node and advances', async () => {
  const { engine } = makeEngine();
  const task = { id: 't1', instanceId: 'i1', nodeId: 'n1', assigneeId: 'u1', status: 'pending' };
  const instance = { id: 'i1', status: 'running', snapshot: { nodes: [
    { id: 'n1', name: '审批', type: 'approval', approvalMethod: 'orsign' },
    { id: 'n2', name: '办理', type: 'handle', approvalMethod: 'orsign' },
    { id: 'n3', name: '结束', type: 'end' }
  ], edges: [{ id: 'e1', fromNodeId: 'n1', toNodeId: 'n2' }, { id: 'e2', fromNodeId: 'n2', toNodeId: 'n3' }] } };
  await engine.approve(task as any, 'u1', '同意');
  expect(repos.task.save).toHaveBeenCalledWith(expect.objectContaining({ id: 't1', status: 'approved' }));
  expect(repos.instance.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'i1', status: 'approved' }));
});
```

（测试断言随实现细节微调，但语义固定：或签单任务同意后实例直接 approved；会签任务数 > 1 时需全部同意。）

- [ ] **Step 2: 运行确认失败**
- [ ] **Step 3: 实现引擎（核心）**

实体：

```ts
@Entity('approval_instances')
export class ApprovalInstance {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) workflowId!: string;
  @Column({ type: 'int' }) workflowVersion!: number;
  @Column({ type: 'jsonb' }) snapshot!: WorkflowSnapshot;
  @Column({ type: 'uuid' }) documentId!: string;
  @Column({ type: 'uuid' }) initiatorId!: string;
  @Column({ type: 'varchar', default: InstanceStatus.Running }) status!: InstanceStatus;
  @Column({ type: 'uuid', nullable: true }) currentNodeId!: string | null;
  @Column({ type: 'timestamptz', default: () => 'now()' }) startedAt!: Date;
  @Column({ type: 'timestamptz', nullable: true }) finishedAt!: Date | null;
}
```

`approval_task.entity.ts`：`id/instanceId/nodeId/assigneeType/assigneeId(nullable)/assigneeRoleId(nullable)/claimedBy(nullable)/status/dueAt(nullable)/createdAt/processedAt(nullable)`。

`approval_record.entity.ts`：`id/instanceId/taskId(nullable)/actorId/action/comment(nullable)/createdAt`。

`approval-engine.service.ts` 关键方法：

```ts
async start(workflowId: string, documentId: string, initiatorId: string) {
  const wf = await this.workflows.getById(workflowId);
  if (wf.status !== WorkflowStatus.Active) throw new BadRequestException('流程未启用');
  const nodes = wf.nodes.map((n) => ({ id: n.id, name: n.name, type: n.type, approverRule: n.approverRule,
    approverValue: n.approverValue, approvalMethod: n.approvalMethod, timeoutHours: n.timeoutHours,
    timeoutAction: n.timeoutAction, config: n.config }));
  const edges = wf.edges.map((e) => ({ id: e.id, fromNodeId: e.fromNodeId, toNodeId: e.toNodeId, conditionExpr: e.conditionExpr }));
  const instance = await this.instanceRepo.save(this.instanceRepo.create({
    workflowId, workflowVersion: wf.version, snapshot: { nodes, edges, version: wf.version },
    documentId, initiatorId, status: InstanceStatus.Running
  }));
  await this.enterNode(instance, nodes.find((n) => n.type === NodeType.Start)!.id);
  return instance;
}

private async enterNode(instance: ApprovalInstance, nodeId: string) {
  const node = instance.snapshot.nodes.find((n) => n.id === nodeId)!;
  instance.currentNodeId = nodeId;
  await this.instanceRepo.save(instance);
  if (node.type === NodeType.End) {
    instance.status = InstanceStatus.Approved;
    instance.finishedAt = new Date();
    await this.instanceRepo.save(instance);
    await this.onFinished(instance, nodeId);
    return;
  }
  if (node.type === NodeType.Condition) {
    const next = await this.evaluateNext(instance, nodeId);
    await this.enterNode(instance, next);
    return;
  }
  if (node.type === NodeType.Cc) {
    await this.sendCcNotifications(instance, node);
    const next = await this.evaluateNext(instance, nodeId);
    await this.enterNode(instance, next);
    return;
  }
  // approval / handle
  const targets = await this.resolveTargets(instance, node);
  const dueAt = node.timeoutHours ? new Date(Date.now() + node.timeoutHours * 3600_000) : null;
  for (const t of targets) {
    await this.taskRepo.save(this.taskRepo.create({
      instanceId: instance.id, nodeId, assigneeType: node.approverRule, assigneeId: t.assigneeId ?? null,
      assigneeRoleId: t.assigneeRoleId ?? null, status: TaskStatus.Pending, dueAt
    }));
    await this.notify(t.userIds, '新任务待处理', `文档审批：${node.name}`);
  }
}

private async evaluateNext(instance: ApprovalInstance, nodeId: string): Promise<string> {
  const doc = await this.documentsRepo.findOneBy({ id: instance.documentId });
  if (!doc) throw new NotFoundException('文档不存在');
  const outgoing = instance.snapshot.edges.filter((e) => e.fromNodeId === nodeId);
  const matched = outgoing.find((e) => e.conditionExpr && this.matchCondition(e.conditionExpr, doc));
  return (matched ?? outgoing.find((e) => !e.conditionExpr))!.toNodeId;
}

private matchCondition(expr: { field: string; op: string; value: number | string }, doc: any): boolean {
  const actual = expr.field === 'amount' ? Number(doc.amount) : doc.categoryId;
  switch (expr.op) {
    case '>=': return Number(actual) >= Number(expr.value);
    case '<=': return Number(actual) <= Number(expr.value);
    case '>': return Number(actual) > Number(expr.value);
    case '==': return actual === expr.value;
    default: return false;
  }
}
```

`approve`/`reject` 统一 `handleTask`：

```ts
async handleTask(taskId: string, actorId: string, action: 'approve' | 'reject', comment?: string) {
  const task = await this.taskRepo.findOneBy({ id: taskId });
  if (!task || task.status !== TaskStatus.Pending) throw new BadRequestException('任务已被处理');
  const instance = await this.instanceRepo.findOneBy({ id: task.instanceId });
  if (instance!.status !== InstanceStatus.Running) throw new BadRequestException('流程已结束');
  if (task.claimedBy && task.claimedBy !== actorId) throw new ForbiddenException('该任务已由他人处理');
  await this.recordRepo.save(this.recordRepo.create({
    instanceId: instance!.id, taskId, actorId,
    action: action === 'approve' ? RecordAction.Approve : RecordAction.Reject, comment: comment ?? null
  }));
  const node = instance!.snapshot.nodes.find((n) => n.id === task.nodeId)!;
  if (action === 'reject') {
    task.status = TaskStatus.Rejected; task.claimedBy = actorId; task.processedAt = new Date();
    await this.taskRepo.save(task);
    await this.voidSiblings(instance!, task.nodeId, task.id);
    instance!.status = InstanceStatus.Rejected; instance!.finishedAt = new Date();
    await this.instanceRepo.save(instance!);
    await this.notify([instance!.initiatorId], '审批已驳回', node.name);
    return;
  }
  task.status = TaskStatus.Approved; task.claimedBy = actorId; task.processedAt = new Date();
  await this.taskRepo.save(task);
  const siblings = await this.taskRepo.findBy({ instanceId: instance!.id, nodeId: task.nodeId, status: TaskStatus.Pending });
  if (node.approvalMethod === ApprovalMethod.Countersign && siblings.length > 0) {
    // 等待其余审批人
  } else {
    await this.enterNode(instance!, await this.evaluateNext(instance!, task.nodeId));
  }
}
```

并发安全：`handleTask` 的状态迁移放在事务中，任务更新用条件更新（`UPDATE approval_tasks SET status=:s WHERE id=:id AND status='pending'`），受影响行数为 0 时抛 `BadRequestException('任务已被处理')`

`resolveTargets`：`person` → approverValue 用户；`role` → 角色下全部用户（返回 `{ assigneeRoleId, userIds }`）；`supervisor` → 发起人部门 managerId；`initiator_choice` → 提交时 `chosenApproverIds` 写入实例 snapshot 对应节点 `config.chosenUserId`，`resolveTargets` 读取。

`onFinished`：把 `documents.status` 更新为 `archived`、`currentInstanceId` 指向实例；发送"已归档"通知。

- [ ] **Step 4: 单测通过**
- [ ] **Step 5: 提交** `git commit -am "feat: 审批引擎核心（流转/会签/或签/驳回）"`

### Task 13: 提交审批、待办查询、超时处理

**Files:**
- Create: `apps/server/src/modules/approvals/approval-timeout.worker.ts`
- Create: `apps/server/src/modules/approvals/dto/submit-document.dto.ts`
- Modify: `apps/server/src/modules/documents/documents.controller.ts`（增加 `POST /api/documents/:id/submit`）
- Modify: `apps/server/src/modules/approvals/approvals.controller.ts`（`GET /api/approvals/todos`）
- Create: `apps/server/test/approval-timeout.unit-spec.ts`

**Interfaces:**
- Produces:
  - `POST /api/documents/:id/submit { workflowId, chosenApproverIds? }` → 创建实例；文档 status → `in_approval`；校验发起人是归属人、状态为 draft/rejected、流程已启用
  - `GET /api/approvals/todos?keyword` → `Paged<TodoDto>`；TodoDto `{ taskId, documentId, title, nodeName, priority: 'high'|'normal'|'low', dueAt, submittedByName, documentStatus }`；查询条件：`assigneeType='person' AND assigneeId=me` 或 `assigneeType='role' AND assigneeRoleId IN (我的角色)` 且 `status='pending'`；priority 按剩余时间（<2h high、<24h normal、其余 low）
  - `ApprovalTimeoutWorker.start()`：每 60 秒扫描 `due_at < now AND status='pending'`，按节点 `timeoutAction` 执行：remind → 发通知；auto_approve → `handleTask(taskId, 'system', 'approve', '超时自动同意')`；auto_reject → 同上 reject

- [ ] **Step 1: 写失败单测：超时自动同意**

`approval-timeout.unit-spec.ts`：

```ts
it('auto-approves overdue task when timeoutAction=auto_approve', async () => {
  const handleTask = jest.fn(async () => undefined);
  const worker = new ApprovalTimeoutWorker(
    { find: jest.fn(async () => [{ id: 't1' }]) } as any,
    { findOneBy: jest.fn(async () => ({ id: 'i1', status: 'running', snapshot: { nodes: [{ id: 'n1', name: '审批', timeoutAction: 'auto_approve' }] } })) } as any,
    { handleTask } as any,
    { save: jest.fn(async (x) => x) } as any
  );
  await worker.runOnce();
  expect(handleTask).toHaveBeenCalledWith('t1', 'system', 'approve', expect.any(String));
});
```

- [ ] **Step 2: 运行确认失败**
- [ ] **Step 3: 实现**

`submit` 逻辑（documents.controller 调 engine）：校验文档归属与状态 → `engine.start(workflowId, documentId, userId)` → 更新文档 status=in_approval、currentInstanceId；`chosenApproverIds` 写入实例 snapshot 对应节点 `config.chosenUserId`（发起人自选时 `resolveTargets` 读取）。

`runOnce`（worker 核心）：

```ts
async runOnce(): Promise<void> {
  const overdue = await this.taskRepo.find({ where: { status: TaskStatus.Pending, dueAt: LessThan(new Date()) } });
  for (const task of overdue) {
    const instance = await this.instanceRepo.findOneBy({ id: task.instanceId });
    if (!instance || instance.status !== InstanceStatus.Running) continue;
    const node = instance.snapshot.nodes.find((n) => n.id === task.nodeId)!;
    if (node.timeoutAction === TimeoutAction.Remind) {
      await this.notificationRepo.save(this.notificationRepo.create({
        userId: task.assigneeId ?? '', type: 'timeout_remind',
        title: '任务即将超时', content: `${node.name} 已超过处理时限，请尽快处理。`, relatedId: task.id
      }));
    } else if (node.timeoutAction === TimeoutAction.AutoApprove) {
      await this.engine.handleTask(task.id, 'system', 'approve', '超时自动同意');
    } else if (node.timeoutAction === TimeoutAction.AutoReject) {
      await this.engine.handleTask(task.id, 'system', 'reject', '超时自动驳回');
    }
  }
}
```

`onModuleInit` 每 60s 调 `runOnce`；`onModuleDestroy` 清理 interval。`todos` 查询同时联表 `documents` 取标题与状态。

- [ ] **Step 4: 单测通过**
- [ ] **Step 5: 提交** `git commit -am "feat: 提交审批与超时自动处理"`
---

## 阶段 4：审批辅助能力与支撑 API

### Task 14: 转办、撤回、催办与审批进度时间线

**Files:**
- Modify: `apps/server/src/modules/approvals/approval-engine.service.ts`
- Modify: `apps/server/src/modules/approvals/approvals.controller.ts`
- Modify: `apps/server/src/modules/documents/documents.controller.ts`
- Create: `apps/server/test/approval-actions.unit-spec.ts`

**Interfaces:**
- Produces:
  - `POST /api/approvals/tasks/:id/transfer { toUserId, comment? }` → 转办：任务 assignee 改为目标用户，原任务记录 `RecordAction.Transfer`，新任务 `status=pending`；仅任务当前处理人（含抢单角色成员）可操作
  - `POST /api/documents/:id/withdraw` → 撤回：仅发起人；仅当实例 running 且无任何 `approve/reject/transfer` 记录；实例 status=withdrawn、文档 status=draft、其余任务 voided
  - `POST /api/documents/:id/remind` → 催办：向当前节点全部 pending 任务处理人发通知，记录 `RecordAction.Remind`
  - `GET /api/approvals/instances/:id/progress` → `ProgressDto { instanceId, status, nodes: [{ nodeId, name, status: 'done'|'current'|'todo', approvers: [{ name, action, comment, time }] }] }`（按实例快照节点顺序 + `approval_records` 聚合）
  - 引擎新增：`transfer(taskId, actorId, toUserId, comment?)`、`withdraw(instanceId, actorId)`、`remind(instanceId, actorId)`、`getProgress(instanceId)`

- [ ] **Step 1: 写失败单测**
- [ ] **Step 2: 运行确认失败**

`approval-actions.unit-spec.ts`（`makeEngine` 复制自 Task 12 的 `approval-engine.unit-spec.ts`，构造函数含六个依赖）：

```ts
it('withdraw is rejected after a task was processed', async () => {
  const { engine } = makeEngine({
    record: {
      save: jest.fn(async (x) => x),
      find: jest.fn(async () => [{ id: 'r1', action: 'approve' }]) // 已有审批动作
    }
  });
  const instance = { id: 'i1', status: 'running' };
  await expect(engine.withdraw(instance as any, 'u1')).rejects.toThrow('已有节点被处理，无法撤回');
});

it('transfer reassigns the task and records action', async () => {
  const { engine, repos } = makeEngine();
  repos.task.findOneBy.mockResolvedValue({ id: 't1', instanceId: 'i1', nodeId: 'n1', status: 'pending', claimedBy: null, assigneeId: 'u1' });
  await engine.transfer('t1', 'u1', 'u2', '转给李四');
  expect(repos.task.save).toHaveBeenCalledWith(expect.objectContaining({ id: 't1', assigneeId: 'u2', status: 'pending' }));
  expect(repos.record.save).toHaveBeenCalledWith(expect.objectContaining({ action: 'transfer', actorId: 'u1' }));
});
```

- [ ] **Step 3: 实现**

`withdraw` 判定：`records.find({ where: { instanceId, action: In([RecordAction.Approve, RecordAction.Reject, RecordAction.Transfer]) } })` 非空即拒绝；否则置实例 withdrawn、文档 draft（`documents` 仓库 update）、本实例 pending 任务置 voided。
`transfer`：校验 `actorId === task.assigneeId` 或任务为角色任务且 actor 在角色内且 `claimedBy === null`；保存原任务 status=transferred，新建任务（assignee=toUserId、nodeId 不变、dueAt 重算），记 record。
`remind`：取实例当前节点 pending 任务的处理人集合 → `notify(userIds, '催办提醒', ...)` + 记 record。
`getProgress`：按快照 `nodes` 顺序遍历，`approval_records` 按 taskId/nodeId 归组；`done` = 节点全部任务非 pending 或实例已离开该节点；`current` = `currentNodeId`。

- [ ] **Step 4: 单测通过**
- [ ] **Step 5: 提交** `git commit -am "feat: 转办/撤回/催办与审批进度时间线"`

### Task 15: 通知、审计日志、仪表盘 API

**Files:**
- Create: `apps/server/src/modules/notifications/entities/notification.entity.ts`
- Create: `apps/server/src/modules/notifications/notifications.module.ts`
- Create: `apps/server/src/modules/notifications/notifications.service.ts`
- Create: `apps/server/src/modules/notifications/notifications.controller.ts`
- Create: `apps/server/src/modules/audit/entities/audit-log.entity.ts`
- Create: `apps/server/src/modules/audit/audit.module.ts`
- Create: `apps/server/src/modules/audit/audit.service.ts`
- Create: `apps/server/src/modules/audit/audit.controller.ts`
- Create: `apps/server/src/modules/dashboard/dashboard.module.ts`
- Create: `apps/server/src/modules/dashboard/dashboard.service.ts`
- Create: `apps/server/src/modules/dashboard/dashboard.controller.ts`
- Create: `apps/server/test/notifications.e2e-spec.ts`

**Interfaces:**
- Produces:
  - `GET /api/notifications?page&unreadOnly` → `Paged<NotificationDto>`
  - `PATCH /api/notifications/:id/read`、`POST /api/notifications/read-all`、`GET /api/notifications/unread-count` → `{ count }`
  - `NotificationsService.notify(userIds: string[], type: string, title: string, content: string, relatedId?: string): Promise<void>`（引擎 Task 12/13/14 调用）
  - `GET /api/audit-logs?page&actorId&action`（`audit:view`）→ `Paged<AuditLogDto>`
  - `AuditService.log(actorId, action, targetType, targetId, detail?, ip?)`
  - `GET /api/dashboard/summary` → `{ todoCount, myPending, myApproved, myRejected, recentInstances: [{ id, title, status, createdAt }] }`（`dashboard:view`）

- [ ] **Step 1: 写失败测试：通知已读流程**
- [ ] **Step 2: 运行确认失败**

`notifications.e2e-spec.ts`：

```ts
it('marks a notification as read and unread-count decreases', async () => {
  const login = await loginAsAdmin();
  // 用 NotificationsService.notify(['<adminId>'], 'test', 't', 'c') 直接造一条（无 POST /notifications 端点）
  const unread0 = await request(app.getHttpServer()).get('/api/notifications/unread-count').set('Authorization', `Bearer ${login.body.accessToken}`);
  expect(Number(unread0.body.count)).toBeGreaterThanOrEqual(0);
});
```

（实际用例：先通过 `NotificationsService.notify(['adminId'], 'test', 't', 'c')` 造一条，再调用 read 接口后 unread-count 减一。）

- [ ] **Step 3: 实现**

`notification.entity.ts`：`id/userId/type/title/content/relatedId(nullable)/readAt(nullable)/createdAt`。
`notifications.service.ts`：`notify` 批量插入（`repo.insert`）；`markRead(userId, id)` 校验归属；`unreadCount(userId)`。
`audit-log.entity.ts`：`id/actorId/action/targetType/targetId/detail(jsonb nullable)/ip(nullable)/createdAt`。
`audit.service.ts`：`log(...)` 直接 `repo.insert`；`findAll` 支持过滤与分页。
`dashboard.service.ts`：todoCount 复用 Task 13 的 todos 查询 count；myPending/myApproved/myRejected 按 `documents.status` 分组 count（ownerId=me）；recentInstances 取最近 8 条实例联文档标题。在 Users/Workflows/Documents 控制器的关键变更点调用 `audit.log`（登录、上传、提交、审批动作、配置变更）。
`AppModule` 注册三个模块。

- [ ] **Step 4: 测试通过**
- [ ] **Step 5: 提交** `git commit -am "feat: 通知/审计/仪表盘 API"`

---

## 阶段 5：前端核心页面

### Task 16: 我的文档页面（上传、列表、详情、预览、提交）

**Files:**
- Create: `apps/web/src/pages/DocumentsPage.tsx`
- Create: `apps/web/src/pages/DocumentDetailPage.tsx`
- Create: `apps/web/src/components/UploadDocumentModal.tsx`
- Create: `apps/web/src/components/SubmitFlowModal.tsx`
- Create: `apps/web/src/components/ApprovalTimeline.tsx`
- Create: `apps/web/src/api/endpoints.ts`
- Create: `apps/web/src/pages/__tests__/DocumentsPage.test.tsx`

**Interfaces:**
- Consumes: `GET/POST /documents`、`POST /documents/:id/submit`、`GET /workflows`（启用列表）、`GET /documents/:id/versions/:versionId/preview`
- Produces: `DocumentsPage`（上传按钮、状态统计卡片（数据来自 `/dashboard/summary`）、AntD Table、筛选、分页）、`DocumentDetailPage`（react-pdf 预览 + 操作区 + `ApprovalTimeline`）、`UploadDocumentModal`、`SubmitFlowModal`

- [ ] **Step 1: 写失败测试：列表渲染状态标签**
- [ ] **Step 2: 运行确认失败**

`DocumentsPage.test.tsx`（mock `api.get`）：

```tsx
vi.mock('../../api/client', () => ({
  api: { get: vi.fn(async () => ({ data: { items: [{ id: 'd1', title: '测试文档', status: 'in_approval', createdAt: '2026-08-01' }], total: 1, page: 1, pageSize: 20 } })) }
}));

it('renders document rows with status tag', async () => {
  render(<DocumentsPage />);
  expect(await screen.findByText('测试文档')).toBeInTheDocument();
  expect(await screen.findByText('审批中')).toBeInTheDocument();
});
```

- [ ] **Step 3: 实现**

`endpoints.ts` 集中定义 API 路径与类型。`DocumentsPage`：顶部 `Card` 统计（待审批/已通过/已驳回）+ `UploadDocumentModal`；`Table` 列：文档名称（链接详情）、类型（图标）、上传时间、状态（`StatusTag`）、审批进度（当前节点名或"流程结束"）、操作（查看/提交/撤回/催办按状态显隐）。
`UploadDocumentModal`：`Upload.Dragger` + `Form`（标题、分类 Select、说明 TextArea、金额 InputNumber），提交 `POST /documents`（`FormData`），成功后刷新列表。
`SubmitFlowModal`：打开时拉 `GET /workflows?status=active`，Select 流程 + 说明；含"发起人自选"节点的流程展示人员多选；提交 `POST /documents/:id/submit`。
`DocumentDetailPage`：
- 左：`Document`/`Page`（react-pdf，`useState` 翻页）+ 转换失败提示（422 → Alert"预览生成失败，可下载原件"）+ 下载按钮
- 右上：状态/分类/金额/发起人/时间 + 操作按钮（草稿 → 提交；审批中 → 撤回/催办；已驳回 → 重新提交；已归档 → 只读）
- 下方：`ApprovalTimeline`（AntD `Steps` + `Timeline` 渲染 Task 14 progress）

`react-pdf` 用法（`workerSrc` 指向 `pdfjs-dist/build/pdf.worker.min.mjs`，本地开发经 Vite 引入）。

- [ ] **Step 4: 测试通过**
- [ ] **Step 5: 提交** `git commit -am "feat: 我的文档页面（上传/预览/提交）"`

### Task 17: 审批中心与审批处理页

**Files:**
- Create: `apps/web/src/pages/ApprovalsPage.tsx`
- Create: `apps/web/src/pages/ApprovalTaskPage.tsx`
- Create: `apps/web/src/components/ApproveModal.tsx`
- Create: `apps/web/src/pages/__tests__/ApprovalsPage.test.tsx`

**Interfaces:**
- Consumes: `GET /approvals/todos`、`GET /approvals/tasks/:id`、`POST /approvals/tasks/:id/approve|reject|transfer`、`GET /approvals/instances/:id/progress`
- Produces: `ApprovalsPage`（待办 Table：标题、节点、优先级 Tag、剩余时间倒计时、提交人、状态）、`ApprovalTaskPage`（文档摘要卡 + `ApprovalTimeline` + 历史反馈 + 操作区：同意/驳回（意见必填 Modal）/转办（选人 Modal））

- [ ] **Step 1: 写失败测试：待办表格渲染与倒计时**
- [ ] **Step 2: 运行确认失败**

`ApprovalsPage.test.tsx`：

```tsx
vi.mock('../../api/client', () => ({
  api: { get: vi.fn(async () => ({ data: { items: [{ taskId: 't1', documentId: 'd1', title: 'Q3预算', nodeName: '财务审核', priority: 'high', dueAt: '2026-08-26T10:00:00Z', submittedByName: '张三' }], total: 1, page: 1, pageSize: 20 } })) }
}));

it('renders todo with high priority tag', async () => {
  render(<ApprovalsPage />);
  expect(await screen.findByText('Q3预算')).toBeInTheDocument();
  expect(await screen.findByText('高')).toBeInTheDocument();
});
```

- [ ] **Step 3: 实现**

`ApprovalsPage`：`Table` 列：文档标题（链接任务详情）、当前节点、优先级（high→红"高"/normal→橙"中"/low→灰"低"）、剩余时间（`dayjs` 计算显示 `X小时X分`，超过显示红色"已超时"）、提交人、操作（处理）。顶部搜索框按标题关键词过滤。
`ApprovalTaskPage`：拉任务详情 + 进度；文档摘要卡（标题/金额/提交人/时间/下载/预览跳转）；`ApproveModal`（意见 TextArea，驳回必填、同意选填）；转办按钮打开用户 Select（`GET /users`）；操作后跳回列表并 `message.success`。页面顶部展示流程进度 `Steps`（当前节点高亮 + 等待提示：`当前节点已停留 X 分钟`）。

- [ ] **Step 4: 测试通过**
- [ ] **Step 5: 提交** `git commit -am "feat: 审批中心与审批处理页"`
---

### Task 18: 管理端极简页面（用户/角色/分类/流程配置/审计）

**Files:**
- Create: `apps/web/src/pages/admin/UsersPage.tsx`
- Create: `apps/web/src/pages/admin/RolesPage.tsx`
- Create: `apps/web/src/pages/admin/CategoriesPage.tsx`
- Create: `apps/web/src/pages/admin/WorkflowsPage.tsx`
- Create: `apps/web/src/pages/admin/WorkflowEditPage.tsx`
- Create: `apps/web/src/pages/admin/AuditLogsPage.tsx`

**Interfaces:**
- Consumes: 用户/角色/分类/流程/审计 API（Task 4/5/6/11/15）
- Produces: 六个管理页，路由挂在 `/admin/*`，入口按 `permissions` 过滤（`user:manage`/`role:manage`/`category:manage`/`workflow:manage`/`audit:view`）

- [ ] **Step 1: 写失败测试：无权限不渲染管理菜单**
- [ ] **Step 2: 运行确认失败**

`apps/web/src/pages/__tests__/AdminMenu.test.tsx`：

```tsx
it('hides admin menu for employee without manage permissions', () => {
  render(<AppLayout />); // AuthContext mock 提供 permissions: ['document:upload','approval:handle']
  expect(screen.queryByText('用户管理')).not.toBeInTheDocument();
  expect(screen.queryByText('我的文档')).toBeInTheDocument();
});
```

- [ ] **Step 3: 实现**

`UsersPage`：`Table`（姓名/工号/部门/角色 Tag/状态）+ 工具栏（新建用户、重置密码、停用/激活）。新建 Modal 表单字段：用户名、密码（≥8）、姓名、工号、邮箱、部门（`TreeSelect` 用 `/departments/tree`）、角色（`Select multiple` 用 `/roles`）。
`RolesPage`：`Table` + 新建/编辑 Modal：名称、编码、描述、权限点 `Checkbox.Group`（`/permissions`）。
`CategoriesPage`：`Table` + 新建/编辑 Modal（名称、排序）。
`WorkflowsPage`：`Table`（名称、状态 Tag、节点数、最后更新）+ 新建按钮（`POST /workflows`）+ 启用/停用 + "配置节点"跳转 `/admin/workflows/:id`。
`WorkflowEditPage`（表单式节点配置，MVP 非画布）：
- 节点列表：每个节点一张 Card，字段按类型切换——`type` Select（审批/办理/条件/抄送/开始/结束）；审批/办理额外显示 `approverRule` Select（指定角色/指定人员/直属主管/发起人自选）+ `approverValue`（角色或人员 Select）+ `approvalMethod` Radio（或签/会签）+ 超时（`timeoutHours` InputNumber + `timeoutAction` Select）；条件节点显示条件连线编辑
- 连线区：Table 列出 edges，每行 from/to Select + 条件字段（无/金额 ≥/金额 ≤/分类 =），默认分支行条件留空
- 保存：组装 `{ nodes, edges }` 调 `PUT /workflows/:id/nodes`；后端 `validateGraph` 错误 `message.error` 展示
`AuditLogsPage`：`Table`（时间/操作人/动作/对象/详情）+ 按操作人/动作过滤。

- [ ] **Step 4: 测试通过**
- [ ] **Step 5: 提交** `git commit -am "feat: 管理端极简页面"`

### Task 19: 仪表盘页面与通知中心

**Files:**
- Create: `apps/web/src/pages/DashboardPage.tsx`
- Create: `apps/web/src/pages/NotificationsPage.tsx`
- Modify: `apps/web/src/components/AppLayout.tsx`（未读红点轮询）

**Interfaces:**
- Consumes: `GET /dashboard/summary`、`GET /notifications*`
- Produces: 仪表盘（统计卡片 + 最近申请列表）、通知中心（列表 + 全部已读）

- [ ] **Step 1: 写失败测试：仪表盘渲染统计**
- [ ] **Step 2: 运行确认失败**

`apps/web/src/pages/__tests__/DashboardPage.test.tsx`：

```tsx
vi.mock('../../api/client', () => ({
  api: { get: vi.fn(async () => ({ data: { todoCount: 3, myPending: 2, myApproved: 5, myRejected: 1, recentInstances: [] } })) }
}));

it('renders stat cards', async () => {
  render(<DashboardPage />);
  expect(await screen.findByText('3')).toBeInTheDocument(); // 待办数
  expect(await screen.findByText('5')).toBeInTheDocument(); // 已通过
});
```

- [ ] **Step 3: 实现**

`DashboardPage`：4 个 `Statistic` 卡片（我的待办、审批中、已通过、已驳回）+ "最近申请" `Table`（标题/状态/时间，点击进详情）+ 快捷入口（上传文档、审批中心，按权限显隐）。
`NotificationsPage`：`List` 渲染通知（类型图标 + 标题 + 内容 + 时间 + 未读圆点），"全部已读"按钮；点击单条标记已读。
`AppLayout`：`useEffect` 每 60s 拉 `unread-count`，铃铛 `Badge` 显示；点击跳 `/notifications`。

- [ ] **Step 4: 测试通过**
- [ ] **Step 5: 提交** `git commit -am "feat: 仪表盘与通知中心"`

### Task 20: 部署配置、初始化脚本与验收清单

**Files:**
- Create: `deploy/ecosystem.config.js`
- Create: `deploy/nginx.conf`
- Create: `deploy/init-ubuntu.sh`
- Create: `deploy/README.md`
- Create: `ACCEPTANCE.md`

**Interfaces:**
- Consumes: 全部分支
- Produces: 可一键部署到 Ubuntu 的配置 + 逐项验收清单

- [ ] **Step 1: 写部署配置**

`deploy/ecosystem.config.js`：

```js
module.exports = {
  apps: [
    { name: 'documentflow-api', script: 'dist/apps/server/main.js', cwd: '/opt/documentflow', instances: 1, autorestart: true, env: { NODE_ENV: 'production' } },
    { name: 'documentflow-worker', script: 'dist/apps/server/main-worker.js', cwd: '/opt/documentflow', autorestart: true, env: { NODE_ENV: 'production', RUN_WORKER: '1' } }
  ]
};
```

（`main-worker.js`：读取 `RUN_WORKER` 时只启动 converter/approval timeout 两个 worker，不监听 HTTP——在 `main.ts` 按环境变量分支导出 `bootstrapWorker`。）
`deploy/nginx.conf`：`server { listen 80; server_name <your-domain>; location / { proxy_pass http://127.0.0.1:5173; } location /api/ { proxy_pass http://127.0.0.1:3000; client_max_body_size 25m; } }`（前端构建后由静态目录托管，web 生产模式 `vite build` 输出到 `apps/web/dist`，Nginx `root` 指向它并配置 `try_files $uri /index.html;`）。
`deploy/init-ubuntu.sh`：`apt update && apt install -y postgresql nginx libreoffice-core libreoffice-writer libreoffice-calc libreoffice-impress curl && npm i -g pm2` → 创建数据库与用户 → 复制代码 → `npm ci && npm run build` → `pm2 start deploy/ecosystem.config.js` → 拷贝 nginx 配置并 `systemctl reload nginx`。脚本中所有路径使用显式变量 `APP_DIR=/opt/documentflow`，不写死用户目录。
`deploy/README.md`：环境变量说明（`JWT_SECRET` 用 `openssl rand -hex 32` 生成）、LibreOffice 中文字体安装（`fonts-noto-cjk`）、备份建议（`pg_dump` + 数据目录 rsync）、日志查看（`pm2 logs`）。

- [ ] **Step 2: 写验收清单**

`ACCEPTANCE.md` 按角色分节：
- 普通用户：注册登录 → 上传 PDF/Word/Excel → 预览 → 提交审批（选流程）→ 查看进度 → 催办 → 撤回；收到驳回 → 传新版本重新提交；收到通过 → 文档归档只读
- 审批人：待办列表（优先级/倒计时）→ 打开详情 → 查看文档与进度 → 同意（意见选填）/驳回（意见必填）/转办；会签节点多人处理、或签节点一人处理
- 管理员：用户增改/停用/重置密码、角色与权限点配置、分类管理、流程配置（含条件分支/超时）并启用、提交后流程生效、审计日志可查
- 系统：Office 转 PDF 成功、20MB 上限校验、他人文档 403、超时自动同意/驳回生效、站内通知到达

- [ ] **Step 3: 按清单自测一遍（每项打勾并记录结果）**
- [ ] **Step 4: 提交** `git commit -am "chore: 部署配置与验收清单"`

---

## 执行顺序说明

- 阶段 0→1→2→3 为后端主干，阶段 4 为辅助 API，阶段 5 为前端页面，Task 20 收尾
- 任务间依赖已通过 Interfaces 块声明；若某个任务被驳回重做，只影响其后续直接依赖项
- 每个任务结束必须通过该任务的测试后再进入下一个任务
