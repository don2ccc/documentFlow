# 文档发起与审批系统 — 设计文档

- 日期：2026-08-26
- 状态：已与用户逐节确认
- 技术栈：React 18 + Ant Design 5 + NestJS 10 + PostgreSQL 16（全栈 TypeScript）

## 1. 背景与目标

企业内部文档发起与审批应用：用户上传文档、选择审批流程并分发给审批人；管理员配置文档分类、审批流程、用户与角色。

v1 核心目标（1~2 个月）：打通 **上传 → 审批 → 归档** 核心链路，系统真正可被日常使用；管理端以"极简配置页"形式先行提供，完整画布编辑器等增强能力放二期。

## 2. 关键决策记录

| 决策点 | 结论 |
| --- | --- |
| 部署形态 | 独立 Web 系统，浏览器访问，站内通知（不集成企业微信/钉钉/飞书） |
| 审批载体 | 纯文档 + 通用字段（标题、说明、分类、金额），不做可配置表单引擎 |
| 规模 | 几百人、2~3 层部门树、按部门 + 角色授权；用户批量导入放二期 |
| 流程能力包 | 标准包：顺序审批、会签/或签、审批人规则（指定角色/指定人员/直属主管/发起人自选）、条件分支、超时处理、抄送节点、转办、撤回、催办 |
| 文档能力包 | 标准包：PDF 在线预览、Office 转 PDF（LibreOffice headless）、版本管理（驳回后重新提交） |
| 流程选择方式 | 上传时手动选择审批流程；分类仅作标签，不绑定流程 |
| 分类结构 | 平铺列表 |
| 文档可见性 | 最小可见：发起人 + 当前/历史审批人 + 管理员 |
| 角色模型 | 自定义角色 RBAC（菜单/操作权限点），用户可挂多个角色 |
| 技术栈 | React + Ant Design 5 + NestJS + PostgreSQL |
| 容器化 | 不使用 Docker，直接部署到服务器 |
| 部署环境 | 本地开发 Windows；生产 Ubuntu（pm2 + Nginx 反代 HTTPS） |
| 时间预期 | 1~2 个月 MVP，按 3.1 顺序交付 |

**假设**：未指定试点部门，按全公司通用场景设计；`金额` 作为通用字段存于文档上，供条件分支使用。

## 3. 范围

### 3.1 MVP（一期）

1. 账号与登录：种子管理员，管理员创建用户、分配角色、重置密码
2. 我的文档：上传（分类/标题/说明/金额）→ 列表/筛选 → 详情/预览 → 提交审批
3. 审批引擎：节点流转、会签/或签、条件分支、超时处理、转办、撤回、催办、驳回后重新提交
4. 审批中心：待办列表（紧急度/超时倒计时）+ 审批处理页（同意/驳回/意见/下载/转办）
5. 站内通知 + 基础仪表盘（待办数、我的申请状态）
6. 极简管理端：用户管理、角色管理（权限点配置）、分类管理、流程配置（表单式节点配置，非拖拽画布）、审计日志查看

### 3.2 二期（按需排期）

- 拖拽画布编辑器、流程版本管理、画布测试运行
- 委托代理审批、电子签章标记、SLA 按工作日计时
- 用户批量导入、审批任务改派、完整仪表盘（分布图/趋势）
- 全文检索、邮件通知、在线协同编辑、可配置表单引擎

## 4. 总体架构

### 4.1 仓库结构

单仓库（monorepo）：

```
apps/
  web/       React 18 + Vite + Ant Design 5 + TypeScript
  server/    NestJS 10 + TypeORM + PostgreSQL 16
packages/
  shared/    前后端共享的类型与枚举（流程节点类型、任务状态、条件表达式等）
docs/
  superpowers/specs/   设计文档
```

### 4.2 关键组件选型

- 认证：JWT + bcrypt 密码散列
- 文件存储：服务器本地磁盘（如 `/data/documents`），元数据入数据库；配额按库内文件大小汇总
- 文档预览：LibreOffice headless 将 Office 文件转换为 PDF，前端 pdf.js 预览
- 转换任务：`conversion_jobs` 表持久化任务，同进程内 worker 轮询处理；**不引入 Redis**
- 站内通知：`notifications` 表 + 顶部铃铛红点/列表
- 部署：Ubuntu + pm2（API 与转换 worker 两个进程）+ Nginx 反代 HTTPS

### 4.3 后端模块划分

每个模块单一职责、通过明确的接口（Service/Controller）相互调用，可独立测试：

| 模块 | 职责 |
| --- | --- |
| `auth` | 登录、JWT 签发与校验 |
| `users` | 用户账号、状态、密码管理 |
| `roles` | RBAC 角色与权限点 |
| `departments` | 部门树（2~3 层） |
| `categories` | 平铺文档分类 |
| `documents` | 文档本体、版本管理、配额 |
| `workflows` | 流程定义（节点、连线、条件、版本） |
| `approvals` | 审批实例、任务、流转引擎（核心） |
| `notifications` | 站内信 |
| `audit` | 操作审计日志 |
| `converter` | 文档转 PDF |
| `dashboard` | 仪表盘聚合查询 |

## 5. 数据模型

按域分组：

### 5.1 用户与权限域

- `users`：id、username、password_hash、name、avatar、employee_no、email、phone、department_id、status（正常/停用/待激活）、created_at
- `departments`：id、parent_id（树形）、name、manager_id（部门经理，可选）
- `roles`：id、name、code、description
- `user_roles`：用户-角色多对多
- `permissions`：权限点（如 `document:upload`、`approval:handle`、`workflow:manage`、`user:manage`、`category:manage`）
- `role_permissions`：角色-权限点多对多

### 5.2 配置域

- `categories`：id、name、sort_order
- `workflows`：id、name、description、status（草稿/已启用/已停用）、version
- `workflow_nodes`：id、workflow_id、node_type（开始/审批/办理/条件/抄送/结束）、name、approver_rule（指定角色/指定人员/直属主管/发起人自选）、approval_method（会签/或签）、timeout_hours、timeout_action（自动催办/自动同意/自动驳回）、config（JSON）
- `workflow_edges`：id、workflow_id、from_node_id、to_node_id、condition_expr（JSON，如 `{"field":"amount","op":">=","value":10000}`）

### 5.3 文档域

- `documents`：id、title、description、category_id、owner_id、amount、status（草稿/审批中/已驳回/已归档；"已通过"作为对外展示文案，与"已归档"同源）、current_instance_id、created_at、updated_at
- `document_versions`：id、document_id、version_no、file_name、file_path、mime_type、size、checksum、uploaded_by、reason、created_at
- `conversion_jobs`：id、document_version_id、status（待处理/成功/失败）、error、created_at

### 5.4 审批域

- `approval_instances`：id、workflow_id、workflow_version（发起时快照）、document_id、initiator_id、status（审批中/已通过/已驳回/已撤回）、current_node_id、started_at、finished_at
- `approval_tasks`：id、instance_id、node_id、assignee_type（指定人员/指定角色/直属主管/发起人自选）、assignee_id（指定人员时）、assignee_role_id（指定角色时）、claimed_by（抢单/实际处理人，可空）、status（待处理/已同意/已驳回/已转办/已抄送/已作废）、due_at、created_at、processed_at
- `approval_records`：id、instance_id、task_id、actor_id、action（同意/驳回/转办/催办/撤回/抄送/系统超时）、comment、created_at

> 审批时间线由 `approval_records` 驱动，与文档详情页的"流程进度"一致。

### 5.5 支撑域

- `notifications`：id、user_id、type（新任务/催办/结果通知/抄送）、title、content、related_id、read_at、created_at
- `audit_logs`：id、actor_id、action、target_type、target_id、detail（JSON）、ip、created_at；只追加不删除

### 5.6 关键约束

- 流程发起时**快照**节点与连线配置（`workflow_version`），之后修改流程不影响已运行的实例
- 一个文档同一时刻只能有一个运行中的审批实例
- 审批记录只追加、不修改；驳回后用户重新提交将生成新版本 + 新实例，旧实例完整保留
- 金额字段存于 `documents`，供条件分支求值

## 6. 审批引擎设计

### 6.1 节点流转

- 节点进入时按配置生成 `approval_tasks`：
  - 指定角色：该角色全体成员可见此任务，**先到先得**，谁先处理算谁的
  - 指定人员/直属主管/发起人自选：仅被指定人可见
- 会签：所有审批人同意才通过；或签：任一审批人同意即通过
- 任一审批人驳回 → 实例进入"已驳回"，其余任务作废，通知发起人
- 条件分支：进入分支节点后按 `workflow_edges` 的条件求值，命中后走对应连线（只支持通用字段：金额、分类；MVP 不做表单变量）
- 抄送节点：仅生成通知与时间线记录，无操作项
- 办理节点：承担"办理/确认"动作，规则同审批节点但动作语义为"办理完成"

### 6.2 超时处理

- 任务进入待处理时计算 `due_at = now + timeout_hours`
- 定时任务扫描超时未处理任务，按节点配置执行：自动催办（发站内信）/ 自动同意 / 自动驳回
- 定时任务失败记录日志，可手动补跑

### 6.3 转办 / 撤回 / 催办

- 转办：审批人将任务转给指定同事，原审批人退出，记录流水；转办后任务仍受超时规则约束
- 撤回：实例"审批中"且尚无任何节点被操作时，发起人可撤回；文档回到草稿态，可修改后重新提交
- 催办：发起人对当前待处理任务催办，向审批人发站内信并记录流水

### 6.4 并发与一致性

- 会签并发操作：数据库行锁 + 任务状态校验，后到者提示"任务已被处理"
- 所有状态变更以数据库事务包裹；任务状态迁移通过乐观锁/版本号防重

## 7. 核心数据流

1. **上传**：选分类 + 填标题/说明/金额 → 生成文档（草稿态）+ 首版本，异步转 PDF 预览
2. **提交**：选已启用的审批流程 → 校验 → 创建审批实例（快照流程）+ 首个节点任务 → 文档状态"审批中"
3. **流转**：审批人同意/驳回 → 按节点规则与条件推进下一节点或结束
4. **结束**：全部节点通过 → 文档自动"已归档"（记录归档时间，界面展示"已通过"）；驳回 → 文档"已驳回"
5. **重新提交**：驳回后用户上传新版本或修改说明 → 再次发起，开启新实例，旧实例保留

## 8. 权限模型

- 登录后按角色渲染菜单与操作按钮；权限点见 `permissions` 表
- 种子角色：系统管理员（全部权限）、部门经理、普通员工；管理员可自建角色并配置权限点
- 数据权限（最小可见）：文档可见范围 = 发起人 + 当前/历史审批人 + 管理员；"指定角色"任务对该角色全体成员可见

## 9. 页面清单与行为

| 页面 | 关键行为 |
| --- | --- |
| 登录 | 用户名 + 密码 |
| 仪表盘 | 待办数、我的申请状态、快捷入口（MVP 基础版） |
| 我的文档 | 上传、状态统计（待审批/已通过/已驳回）、列表/筛选、详情 |
| 文档详情 | PDF 预览、版本列表、审批时间线、操作区（撤回/催办/重新提交/下载） |
| 审批中心 | 待我处理列表（直接指派 + 角色可见），紧急度/超时倒计时 |
| 审批处理页 | 文档摘要、流程进度、历史反馈、同意/驳回/意见/转办 |
| 通知中心 | 站内信列表 + 未读红点 |
| 用户管理 | 建用户、分配角色/部门、重置密码、停用/激活（MVP 极简版） |
| 角色管理 | 建角色、配置权限点 |
| 分类管理 | 分类增删改（平铺） |
| 流程配置 | 流程列表 + 表单式节点配置（MVP）；拖拽画布二期 |
| 审计日志 | 管理员查看操作记录 |

按钮随文档状态变化：
- 审批中 → 撤回 / 催办
- 已驳回 → 修改后重新提交
- 已通过/已归档 → 只读 + 下载 + 查看时间线

## 10. 通知

- 事件：新任务分配、任务被催办、审批结果（通过/驳回）、抄送、超时自动处理结果
- 形式：站内信，顶部铃铛未读红点；MVP 不做邮件/短信/企微推送

## 11. 错误处理

- 转换失败：文档仍可提交审批，预览区显示"预览生成失败，可下载原件"，后台可重试
- 并发审批：提示任务已被处理，不做重复流转
- 定时任务：失败记录日志并可补跑
- 文件校验：大小/类型白名单在前端与后端双重校验
- 支持格式：PDF、Word、Excel、PPT、常见图片；单文件 ≤ 20MB

## 12. 测试策略

- 引擎纯逻辑单测（vitest）：节点流转、条件求值、会签/或签、超时动作
- API 集成测试（supertest + 测试数据库）：核心链路冒烟（上传 → 提交 → 同意 → 归档；驳回 → 重新提交）
- 前端：关键页面组件测试 + 手动验收清单
- 验收方式：按清单逐项验收（见交付物）

## 13. 部署与运维

- 生产：Ubuntu + PostgreSQL 16 + LibreOffice headless + pm2（API、converter worker）+ Nginx HTTPS 反代
- 文件目录：`/data/documents`（可配）；权限最小化
- 初始化：数据库迁移 + 种子脚本（管理员账号、种子角色、示例流程）+ 目录与 LibreOffice 安装脚本
- 本地开发：Windows 直接运行 Node/PostgreSQL（或 WSL）

## 14. 交付物

- 完整可运行的前后端代码
- pm2 ecosystem 配置、Nginx 配置、数据库迁移与种子脚本、初始化脚本
- 部署文档 + 验收清单（按清单逐项验收）

## 15. 风险与开放问题

- 未指定试点部门：按全公司通用场景设计，首批需求如有侧重可再调整优先级
- 指定角色任务"先到先得"已确认；如需改为仅指定人可见，需调整任务分配逻辑
- 金额条件仅支持通用字段；如需按表单字段做条件，属于表单引擎范畴（二期）
- 本地磁盘存储：如需水平扩展或多节点部署，需迁移到对象存储（二期评估）
