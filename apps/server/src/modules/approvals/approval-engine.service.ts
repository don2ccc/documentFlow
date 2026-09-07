import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, In, Repository } from 'typeorm';
import * as fs from 'fs';
import {
  ApprovalMethod, AssigneeType, AuthUser, DocumentStatus, InstanceStatus, NodeType, RecordAction,
  TaskStatus, WorkflowStatus, WorkflowSnapshot
} from '@document-flow/shared';
import { Notification } from '../notifications/entities/notification.entity';
import { MailerService } from '../notifications/mailer.service';
import { WorkflowsService } from '../workflows/workflows.service';
import { AuditService } from '../audit/audit.service';
import { Document } from '../documents/entities/document.entity';
import { Application } from '../applications/entities/application.entity';
import { ApprovalInstance } from './entities/approval-instance.entity';
import { ApprovalRecord } from './entities/approval-record.entity';
import { ApprovalTask } from './entities/approval-task.entity';

interface ResolvedTarget { assigneeId?: string; assigneeRoleId?: string; userIds: string[] }

@Injectable()
export class ApprovalEngineService {
  constructor(
    @InjectRepository(ApprovalInstance) private readonly instanceRepo: Repository<ApprovalInstance>,
    @InjectRepository(ApprovalTask) private readonly taskRepo: Repository<ApprovalTask>,
    @InjectRepository(ApprovalRecord) private readonly recordRepo: Repository<ApprovalRecord>,
    @InjectRepository(Notification) private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(Document) private readonly documentsRepo: Repository<Document>,
    @InjectRepository(Application) private readonly applicationsRepo: Repository<Application>,
    private readonly workflows: WorkflowsService,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly mailer: MailerService
  ) {}

  async submit(workflowId: string, targetId: string, targetType: 'document' | 'application', initiatorId: string, options?: { chosenApproverIds?: Record<string, string> }) {
    const wf = await this.workflows.getById(workflowId);
    if (wf.status !== WorkflowStatus.Active) throw new BadRequestException('流程未启用');
    const nodes = wf.nodes.map((n) => {
      const chosen = options?.chosenApproverIds?.[n.id];
      return {
        id: n.id, name: n.name, type: n.type,
        approverRule: n.approverRule ?? undefined, approverValue: n.approverValue ?? undefined,
        approvalMethod: n.approvalMethod ?? undefined, timeoutDays: n.timeoutDays ?? 15,
        timeoutAction: n.timeoutAction ?? undefined,
        config: chosen ? { ...(n.config ?? {}), chosenUserId: chosen } : n.config ?? undefined
      };
    });
    const edges = wf.edges.map((e) => ({ id: e.id, fromNodeId: e.fromNodeId, toNodeId: e.toNodeId, conditionExpr: e.conditionExpr ?? null }));
    const instance = await this.instanceRepo.save(
      this.instanceRepo.create({
        workflowId, workflowVersion: wf.version,
        snapshot: { nodes, edges, version: wf.version } as WorkflowSnapshot,
        documentId: targetId, targetType, initiatorId, status: InstanceStatus.Running
      })
    );
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
      if (instance.targetType === 'application') {
        await this.applicationsRepo.update({ id: instance.documentId }, { status: DocumentStatus.Archived, currentInstanceId: instance.id });
        await this.notify([instance.initiatorId], 'approval_result', '审批已通过', '您的申请项目审批已全部通过，已自动归档。', instance.documentId);
      } else {
        await this.documentsRepo.update(
          { id: instance.documentId },
          { status: DocumentStatus.Archived, currentInstanceId: instance.id }
        );
        await this.notify([instance.initiatorId], 'approval_result', '审批已通过', '您的文档审批已全部通过，已自动归档。', instance.documentId);
      }
      void this.sendCompletionEmail(instance, 'approved', '[文档审批] 审批已通过', '您参与的审批已全部通过，已自动归档。');
      return;
    }
    if (node.type === NodeType.Start) {
      await this.enterNode(instance, await this.evaluateNext(instance, nodeId));
      return;
    }
    if (node.type === NodeType.Condition) {
      await this.enterNode(instance, await this.evaluateNext(instance, nodeId));
      return;
    }
    if (node.type === NodeType.Cc) {
      await this.sendCcNotifications(instance, node);
      await this.enterNode(instance, await this.evaluateNext(instance, nodeId));
      return;
    }
    const targets = await this.resolveTargets(instance, node);
    const dueAt = node.timeoutDays ? new Date(Date.now() + node.timeoutDays * 86_400_000) : null;
    for (const t of targets) {
      await this.taskRepo.save(
        this.taskRepo.create({
          instanceId: instance.id, nodeId, assigneeType: node.approverRule ?? AssigneeType.Person,
          assigneeId: t.assigneeId ?? null, assigneeRoleId: t.assigneeRoleId ?? null,
          status: TaskStatus.Pending, dueAt
        })
      );
    }
    await this.notify(targets.flatMap((t) => t.userIds), 'new_task', '新任务待处理', `文档审批：${node.name}`, instance.documentId);
  }

  async handleTask(taskId: string, actorId: string, action: 'approve' | 'reject', comment?: string) {
    const task = await this.taskRepo.findOneBy({ id: taskId });
    if (!task || task.status !== TaskStatus.Pending) throw new BadRequestException('任务已被处理');
    const instance = await this.instanceRepo.findOneBy({ id: task.instanceId });
    if (!instance || instance.status !== InstanceStatus.Running) throw new BadRequestException('流程已结束');
    const canAct =
      actorId === 'system'
        ? true
        : task.assigneeType === AssigneeType.Person
          ? task.assigneeId === actorId
          : task.assigneeRoleId
            ? await this.isInRole(actorId, task.assigneeRoleId)
            : false;
    if (!canAct) throw new ForbiddenException('无权处理该任务');
    if (task.claimedBy && task.claimedBy !== actorId) throw new ForbiddenException('该任务已由他人处理');
    await this.recordRepo.save(
      this.recordRepo.create({
        instanceId: instance.id, taskId: task.id, actorId,
        action: action === 'approve' ? RecordAction.Approve : RecordAction.Reject,
        comment: comment ?? null
      })
    );
    const node = instance.snapshot.nodes.find((n) => n.id === task.nodeId)!;
    await this.audit.log(actorId, action === 'approve' ? 'approval:approve' : 'approval:reject', 'approval_task', task.id, comment ? { comment } : undefined);
    task.claimedBy = actorId;
    task.processedAt = new Date();
    if (action === 'reject') {
      task.status = TaskStatus.Rejected;
      await this.taskRepo.save(task);
      await this.voidSiblings(instance, task.nodeId);
      instance.status = InstanceStatus.Rejected;
      instance.finishedAt = new Date();
      await this.instanceRepo.save(instance);
      if (instance.targetType === 'application') {
        await this.applicationsRepo.update({ id: instance.documentId }, { status: DocumentStatus.Rejected });
      } else {
        if (instance.targetType === 'application') {
      await this.applicationsRepo.update({ id: instance.documentId }, { status: DocumentStatus.Rejected });
    } else {
      await this.documentsRepo.update({ id: instance.documentId }, { status: DocumentStatus.Rejected });
    }
      }
      const rejectTpl = instance.targetType === 'application' ? `节点「${node.name}」驳回了您的申请项目。` : `节点「${node.name}」驳回了您的文档。`;
      await this.notify([instance.initiatorId], 'approval_result', '审批已驳回', rejectTpl, instance.documentId);
      void this.sendCompletionEmail(instance, 'rejected', '[文档审批] 审批已驳回', `节点「${node.name}」驳回了该单据，请查看附件并联系发起人。`);
      return;
    }
    task.status = TaskStatus.Approved;
    await this.taskRepo.save(task);
    const siblings = await this.taskRepo.findBy({ instanceId: instance.id, nodeId: task.nodeId, status: TaskStatus.Pending });
    if (node.approvalMethod === ApprovalMethod.Countersign && siblings.length > 0) return;
    await this.enterNode(instance, await this.evaluateNext(instance, task.nodeId));
  }

  async getTaskForDocument(user: AuthUser, documentId: string) {
    const instance = await this.instanceRepo.findOneBy({
      documentId,
      status: InstanceStatus.Running
    });
    if (!instance) {
      return { taskId: null, canApprove: false, canTransfer: false };
    }
    const tasks = await this.taskRepo.findBy({
      instanceId: instance.id,
      status: TaskStatus.Pending
    });
    for (const task of tasks) {
      const canAct = task.assigneeType === AssigneeType.Person
        ? task.assigneeId === user.id && (!task.claimedBy || task.claimedBy === user.id)
        : task.assigneeRoleId
          ? Boolean(user.roleIds?.includes(task.assigneeRoleId)) && (!task.claimedBy || task.claimedBy === user.id)
          : false;
      if (canAct) {
        return { taskId: task.id, canApprove: true, canTransfer: true };
      }
    }
    return { taskId: null, canApprove: false, canTransfer: false };
  }

  async getTaskDetail(user: AuthUser, taskId: string) {
    const task = await this.taskRepo.findOneBy({ id: taskId });
    if (!task) throw new NotFoundException('任务不存在');
    const instance = await this.instanceRepo.findOneBy({ id: task.instanceId });
    if (!instance) throw new NotFoundException('实例不存在');
    const isAdmin = user.permissions.includes('user:manage');
    const canAct =
      isAdmin ||
      (task.assigneeType === AssigneeType.Person
        ? task.assigneeId === user.id
        : task.assigneeRoleId
          ? task.claimedBy === user.id || (await this.isInRole(user.id, task.assigneeRoleId))
          : false);
    if (!isAdmin && !canAct && instance.initiatorId !== user.id) throw new ForbiddenException('无权查看该任务');
    const doc = instance.targetType === 'application' ? await this.applicationsRepo.findOneBy({ id: instance.documentId }) : await this.documentsRepo.findOneBy({ id: instance.documentId });
    const ownerRows = doc
      ? await this.dataSource.query('SELECT name FROM users WHERE id = $1', [doc.ownerId])
      : [];
    const fileRows = doc
      ? await this.dataSource.query(
          instance.targetType === 'application'
            ? 'SELECT count(*)::int AS count FROM application_files WHERE "applicationId" = $1'
            : 'SELECT count(*)::int AS count FROM document_versions WHERE "documentId" = $1',
          [doc.id]
        )
      : [];
    const ownerName = ownerRows[0]?.name ?? '-';
    const fileCount = Number(fileRows[0]?.count ?? 0);
    const node = instance.snapshot.nodes.find((n) => n.id === task.nodeId);
    const progress = await this.getProgress(user, instance.id);
    return {
      taskId: task.id,
      taskStatus: task.status,
      documentId: instance.documentId,
      document: doc
        ? {
          id: doc.id,
          title: doc.title,
          description: doc.description,
          amount: doc.amount,
          status: doc.status,
          ownerName,
          fileCount,
          createdAt: doc.createdAt.toISOString(),
          updatedAt: doc.updatedAt.toISOString()
        }
        : null,
      nodeName: node?.name ?? '审批',
      canApprove: canAct && task.status === 'pending' && instance.status === 'running',
      instanceStatus: instance.status,
      progress
    };
  }

  async todos(user: AuthUser, query: { keyword?: string; page?: number; pageSize?: number }) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const qb = this.taskRepo
      .createQueryBuilder('t')
      .innerJoin(ApprovalInstance, 'i', 'i.id = t.instanceId')
      .innerJoin(Application, 'd', 'd.id = i."documentId"')
      .where('t.status = :pending', { pending: TaskStatus.Pending })
      .andWhere(
        new Brackets((b) => {
          b.where('t."assigneeType" = :person AND t."assigneeId" = :uid', { person: AssigneeType.Person, uid: user.id });
          if (user.roleIds?.length) {
            b.orWhere('t."assigneeType" = :role AND t."assigneeRoleId" IN (:...roleIds)', { role: AssigneeType.Role, roleIds: user.roleIds });
          }
        })
      );
    if (query.keyword) qb.andWhere('d.title ILIKE :k', { k: `%${query.keyword}%` });
    const rows = await qb
      .select([
        't.id AS "taskId"', 'd.id AS "documentId"', 'd.title AS title', 'd.status AS "documentStatus"',
        'i.id AS "instanceId"', 'i."initiatorId" AS "initiatorId"', 't."dueAt" AS "dueAt"', 't."nodeId" AS "nodeId"',
        't."assigneeId" AS "assigneeId"', 't."assigneeRoleId" AS "assigneeRoleId"'
      ])
      .orderBy('t."createdAt"', 'ASC')
      .skip((page - 1) * pageSize).take(pageSize)
      .getRawMany();
    const total = await qb.clone().getCount();
    const instanceIds = [...new Set(rows.map((r) => r.instanceId))];
    const initiatorIds = [...new Set(rows.map((r) => r.initiatorId))];
    const instances = instanceIds.length ? await this.instanceRepo.findBy({ id: In(instanceIds) }) : [];
    const users = initiatorIds.length
      ? await this.dataSource.query('SELECT id, name FROM users WHERE id = ANY($1)', [initiatorIds])
      : [];
    const assigneeIds = [...new Set(rows.map((r) => r.assigneeId).filter(Boolean))];
    const assigneeRoleIds = [...new Set(rows.map((r) => r.assigneeRoleId).filter(Boolean))];
    const assigneeUsers = assigneeIds.length
      ? await this.dataSource.query('SELECT id, username FROM users WHERE id = ANY($1)', [assigneeIds])
      : [];
    const roleUsers = assigneeRoleIds.length
      ? await this.dataSource.query(
        'SELECT ur."roleId" AS "roleId", u.username FROM user_roles ur JOIN users u ON u.id = ur."userId" WHERE ur."roleId" = ANY($1) AND u.status = $2 ORDER BY u.username',
        [assigneeRoleIds, 'active']
      )
      : [];
    const initiatorNameMap = new Map(users.map((u: { id: string; name: string }) => [u.id, u.name]));
    const assigneeUsernameMap = new Map(assigneeUsers.map((u: { id: string; username: string }) => [u.id, u.username]));
    const roleUsernameMap = new Map<string, string[]>();
    for (const row of roleUsers as Array<{ roleId: string; username: string }>) {
      const names = roleUsernameMap.get(row.roleId) ?? [];
      names.push(row.username);
      roleUsernameMap.set(row.roleId, names);
    }
    const instanceMap = new Map(instances.map((i) => [i.id, i]));
    const items = rows.map((r: any) => {
      const inst = instanceMap.get(r.instanceId)!;
      const node = inst.snapshot.nodes.find((n) => n.id === r.nodeId);
      const reviewerUsernames = r.assigneeId
        ? [assigneeUsernameMap.get(r.assigneeId)].filter(Boolean) as string[]
        : (roleUsernameMap.get(r.assigneeRoleId) ?? []);
      const dueAt = r.dueAt ? new Date(r.dueAt) : null;
      const remaining = dueAt ? dueAt.getTime() - Date.now() : Number.POSITIVE_INFINITY;
      const priority = remaining < 2 * 3600_000 ? 'high' : remaining < 24 * 3600_000 ? 'normal' : 'low';
      return {
        taskId: r.taskId, documentId: r.documentId, title: r.title,
        nodeName: reviewerUsernames.length ? reviewerUsernames.join(', ') : (node?.name ?? '审批'),
        priority, dueAt: dueAt?.toISOString() ?? null, submittedByName: initiatorNameMap.get(r.initiatorId) ?? '未知',
        documentStatus: r.documentStatus
      };
    });
    return { items, total, page, pageSize };
  }

  async transfer(taskId: string, actorId: string, toUserId: string, comment?: string) {
    const task = await this.taskRepo.findOneBy({ id: taskId });
    if (!task || task.status !== TaskStatus.Pending) throw new BadRequestException('任务已被处理');
    const canAct =
      task.assigneeType === AssigneeType.Person
        ? task.assigneeId === actorId
        : task.assigneeRoleId
          ? task.claimedBy === actorId || (await this.isInRole(actorId, task.assigneeRoleId))
          : false;
    if (!canAct) throw new ForbiddenException('无权转办该任务');
    const instance = await this.instanceRepo.findOneBy({ id: task.instanceId });
    if (!instance || instance.status !== InstanceStatus.Running) throw new BadRequestException('流程已结束');
    const node = instance.snapshot.nodes.find((n) => n.id === task.nodeId)!;
    const dueAt = node.timeoutDays ? new Date(Date.now() + node.timeoutDays * 86_400_000) : null;
    task.status = TaskStatus.Transferred;
    await this.taskRepo.save(task);
    await this.taskRepo.save(
      this.taskRepo.create({
        instanceId: task.instanceId, nodeId: task.nodeId, assigneeType: AssigneeType.Person, assigneeId: toUserId,
        assigneeRoleId: null, status: TaskStatus.Pending, dueAt
      })
    );
    await this.recordRepo.save(
      this.recordRepo.create({ instanceId: task.instanceId, taskId: task.id, actorId, action: RecordAction.Transfer, comment: comment ?? null })
    );
    await this.audit.log(actorId, 'approval:transfer', 'approval_task', task.id, toUserId ? { toUserId } : undefined);
    await this.notify([toUserId], 'new_task', '任务已转办给您', `文档审批：${node.name}`, instance.documentId);
  }

  async wasWithdrawn(documentId: string, targetType: 'document' | 'application') {
    const rows = await this.dataSource.query(
      'SELECT 1 FROM approval_instances WHERE "documentId" = $1 AND "targetType" = $2 AND status = $3 LIMIT 1',
      [documentId, targetType, InstanceStatus.Withdrawn]
    );
    return rows.length > 0;
  }

  async withdraw(instanceId: string, actorId: string) {
    const instance = await this.instanceRepo.findOneBy({ id: instanceId });
    if (!instance) throw new NotFoundException('实例不存在');
    if (instance.initiatorId !== actorId) throw new ForbiddenException('只有发起人可以撤回');
    if (instance.status !== InstanceStatus.Running) throw new BadRequestException('当前状态不可撤回');
    const pendingTasks = await this.taskRepo.findBy({ instanceId, status: TaskStatus.Pending });
    const assigneeIds = pendingTasks.map((t) => t.assigneeId).filter((id): id is string => !!id);
    instance.status = InstanceStatus.Withdrawn;
    instance.finishedAt = new Date();
    await this.instanceRepo.save(instance);
    await this.taskRepo.update({ instanceId, status: TaskStatus.Pending }, { status: TaskStatus.Voided });
    if (instance.targetType === 'application') {
      await this.applicationsRepo.update({ id: instance.documentId }, { status: DocumentStatus.Draft });
    } else {
      await this.documentsRepo.update({ id: instance.documentId }, { status: DocumentStatus.Draft });
    }
    await this.recordRepo.save(this.recordRepo.create({ instanceId, actorId, action: RecordAction.Withdraw }));
    await this.audit.log(actorId, 'approval:withdraw', 'approval_instance', instanceId);
    if (assigneeIds.length) {
      await this.notify([...new Set(assigneeIds)], 'new_task', '新任务已经撤回', '', instance.documentId);
    }
  }

  async remind(instanceId: string, actorId: string) {
    const instance = await this.instanceRepo.findOneBy({ id: instanceId });
    if (!instance) throw new NotFoundException('实例不存在');
    if (instance.initiatorId !== actorId) throw new ForbiddenException('只有发起人可以催办');
    if (instance.status !== InstanceStatus.Running) throw new BadRequestException('当前状态不可催办');
    const tasks = await this.taskRepo.findBy({ instanceId, status: TaskStatus.Pending });
    const userIds = tasks.map((t) => t.assigneeId).filter((id): id is string => !!id);
    if (userIds.length) {
      await this.notify([...new Set(userIds)], 'remind', '催办提醒', '发起人正在催办，请尽快处理。', instance.documentId);
    }
    await this.recordRepo.save(this.recordRepo.create({ instanceId, actorId, action: RecordAction.Remind }));
    await this.audit.log(actorId, 'approval:remind', 'approval_instance', instanceId);
  }

  async getProgress(user: AuthUser, instanceId: string) {
    const instance = await this.instanceRepo.findOneBy({ id: instanceId });
    if (!instance) throw new NotFoundException('实例不存在');
    const [records, tasks] = await Promise.all([
      this.recordRepo.find({ where: { instanceId }, order: { createdAt: 'ASC' } }),
      this.taskRepo.find({ where: { instanceId } })
    ]);
    const isParticipant =
      instance.initiatorId === user.id ||
      user.permissions.includes('user:manage') ||
      records.some((r) => r.actorId === user.id) ||
      tasks.some((t) => t.assigneeId === user.id);
    if (!isParticipant) throw new ForbiddenException('无权查看该审批进度');
    const currentIndex = instance.snapshot.nodes.findIndex((n) => n.id === instance.currentNodeId);
    const resolvedTargets = await Promise.all(
      instance.snapshot.nodes.map(async (node) => {
        if (!node.approverRule) return [];
        try {
          return await this.resolveTargets(instance, node);
        } catch {
          return [];
        }
      })
    );
    const userIds = new Set<string>();
    tasks.forEach((task) => {
      if (task.assigneeId) userIds.add(task.assigneeId);
    });
    records.forEach((record) => userIds.add(record.actorId));
    resolvedTargets.forEach((targets) => {
      targets.forEach((target) => target.userIds.forEach((id) => userIds.add(id)));
    });
    const userNameMap = new Map<string, string>();
    if (userIds.size > 0) {
      const rows = await this.dataSource.query(
        'SELECT id, name FROM users WHERE id = ANY($1::uuid[])',
        [[...userIds]]
      );
      (rows as Array<{ id: string; name: string }>).forEach((row) => userNameMap.set(row.id, row.name));
    }
    const nodes = instance.snapshot.nodes.map((n, idx) => {
      const nodeTasks = tasks.filter((t) => t.nodeId === n.id);
      const nodeRecords = records.filter((r) => nodeTasks.some((t) => t.id === r.taskId));
      const status =
        n.id === instance.currentNodeId
          ? 'current'
          : currentIndex >= 0 && idx < currentIndex
            ? 'done'
            : nodeTasks.length > 0 && nodeTasks.every((t) => t.status !== TaskStatus.Pending)
              ? 'done'
              : 'todo';
      const approvers = nodeTasks.map((task) => {
        const record = nodeRecords.find((r) => r.taskId === task.id);
        const actorId = record?.actorId ?? task.assigneeId;
        return {
          actorId,
          name: actorId ? userNameMap.get(actorId) ?? "" : "",
          action: record?.action ?? null,
          comment: record?.comment ?? null,
          time: record?.createdAt.toISOString() ?? null
        };
      });
      const resolvedApprovers = (resolvedTargets[idx] ?? []).flatMap((target) =>
        target.userIds.map((userId) => ({
          actorId: userId,
          name: userNameMap.get(userId) ?? "",
          action: null,
          comment: null,
          time: null
        }))
      );
      const approverIds = new Set(approvers.map((approver) => approver.actorId));
      resolvedApprovers.forEach((approver) => {
        if (!approverIds.has(approver.actorId)) {
          approvers.push(approver);
          approverIds.add(approver.actorId);
        }
      });
      return { nodeId: n.id, name: n.name, status, approvers };
    });
    const currentReviewer = instance.currentNodeId
      ? await this.resolveCurrentReviewer(instance.currentNodeId, tasks)
      : [];
    return { instanceId, status: instance.status, nodes, currentReviewer };
  }

  async resolveCurrentReviewer(currentNodeId: string, tasks: ApprovalTask[]) {
    const pending = tasks.filter((t) => t.nodeId === currentNodeId && t.status === TaskStatus.Pending);
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const t of pending) {
      if (t.assigneeId && !seen.has(t.assigneeId)) { seen.add(t.assigneeId); ids.push(t.assigneeId); }
    }
    if (ids.length === 0) return [];
    const rows = await this.dataSource.query(
      'SELECT id, name FROM users WHERE id = ANY($1::uuid[])',
      [ids]
    );
    return (rows as Array<{ id: string; name: string }>).map((u) => ({ userId: u.id, name: u.name }));
  }

  async getCurrentReviewersForInstances(instanceIds: string[]) {
    const result = new Map<string, Array<{ userId: string; name: string }>>();
    if (instanceIds.length === 0) return result;
    const [instances, allTasks] = await Promise.all([
      this.instanceRepo.find({ where: { id: In(instanceIds) } }),
      this.taskRepo.find({ where: { instanceId: In(instanceIds), status: TaskStatus.Pending } })
    ]);
    const assigneeIds = new Set<string>();
    for (const inst of instances) {
      if (!inst.currentNodeId) { result.set(inst.id, []); continue; }
      const ids = allTasks
        .filter((t) => t.instanceId === inst.id && t.nodeId === inst.currentNodeId)
        .map((t) => t.assigneeId)
        .filter((id): id is string => !!id);
      const unique = Array.from(new Set(ids));
      if (unique.length === 0) { result.set(inst.id, []); continue; }
      result.set(inst.id, unique.map((id) => ({ userId: id, name: '' })));
      unique.forEach((id) => assigneeIds.add(id));
    }
    if (assigneeIds.size === 0) return result;
    const rows = await this.dataSource.query(
      'SELECT id, name FROM users WHERE id = ANY($1::uuid[])',
      [[...assigneeIds]]
    );
    const nameMap = new Map((rows as Array<{ id: string; name: string }>).map((u) => [u.id, u.name]));
    for (const [instId, placeholders] of result.entries()) {
      for (const p of placeholders) {
        p.name = nameMap.get(p.userId) ?? '';
      }
    }
    return result;
  }

  async returnToInitiator(taskId: string, instanceId: string, node: { name: string }) {
    const instance = await this.instanceRepo.findOneBy({ id: instanceId });
    if (!instance || instance.status !== InstanceStatus.Running) return;
    await this.taskRepo.update({ instanceId, status: TaskStatus.Pending }, { status: TaskStatus.Voided });
    await this.recordRepo.save(
      this.recordRepo.create({
        instanceId, taskId, actorId: 'system', action: RecordAction.Reject,
        comment: `超时未审批，已退回给发起人`
      })
    );
    instance.status = InstanceStatus.Rejected;
    instance.finishedAt = new Date();
    await this.instanceRepo.save(instance);
    if (instance.targetType === 'application') {
      await this.applicationsRepo.update({ id: instance.documentId }, { status: DocumentStatus.Rejected });
    } else {
      await this.documentsRepo.update({ id: instance.documentId }, { status: DocumentStatus.Rejected });
    }
    await this.notify(
      [instance.initiatorId],
      'approval_result',
      '审批已超时退回',
      `节点「${node.name}」超时未处理，文档已退回给您。`,
      instance.documentId
    );
    void this.sendCompletionEmail(instance, 'timeout', '[文档审批] 审批已超时退回', `节点「${node.name}」超时未处理，已自动退回发起人。`);
    await this.audit.log('system', 'approval:timeout-return', 'approval_instance', instanceId, { nodeName: node.name });
  }

  private async resolveTargets(instance: ApprovalInstance, node: { approverRule?: string; approverValue?: string; config?: Record<string, unknown> }): Promise<ResolvedTarget[]> {
    const rule = node.approverRule;
    if (rule === AssigneeType.Person) {
      const userId = node.approverValue!;
      return [{ assigneeId: userId, userIds: [userId] }];
    }
    if (rule === AssigneeType.Role) {
      const roleId = node.approverValue!;
      const rows = await this.dataSource.query(
        'SELECT u.id FROM users u JOIN user_roles ur ON ur."userId" = u.id WHERE ur."roleId" = $1 AND u.status = $2',
        [roleId, 'active']
      );
      const userIds = rows.map((r: { id: string }) => r.id);
      if (userIds.length === 0) throw new BadRequestException('审批角色下没有可用用户');
      return [{ assigneeRoleId: roleId, userIds }];
    }
    if (rule === AssigneeType.Supervisor) {
      const initiator = await this.dataSource.query('SELECT "departmentId" FROM users WHERE id = $1', [instance.initiatorId]);
      const departmentId = initiator[0]?.departmentId;
      const dept = departmentId
        ? await this.dataSource.query('SELECT "managerId" FROM departments WHERE id = $1', [departmentId])
        : [];
      const managerId = dept[0]?.managerId;
      if (!managerId) throw new BadRequestException('发起人直属主管未设置');
      return [{ assigneeId: managerId, userIds: [managerId] }];
    }
    if (rule === AssigneeType.InitiatorChoice) {
      const chosen = (node.config as { chosenUserId?: string } | undefined)?.chosenUserId;
      if (!chosen) throw new BadRequestException('未指定发起人自选审批人');
      return [{ assigneeId: chosen, userIds: [chosen] }];
    }
    throw new BadRequestException('节点缺少审批人规则');
  }

  private async isInRole(actorId: string, roleId: string): Promise<boolean> {
    const rows = await this.dataSource.query(
      'SELECT COUNT(*)::int AS c FROM user_roles ur JOIN users u ON u.id = ur."userId" WHERE ur."roleId" = $1 AND u.id = $2 AND u.status = $3',
      [roleId, actorId, 'active']
    );
    return Number(rows[0]?.c ?? 0) > 0;
  }

  private async evaluateNext(instance: ApprovalInstance, nodeId: string): Promise<string> {
    const outgoing = instance.snapshot.edges.filter((e) => e.fromNodeId === nodeId);
    const next = outgoing[0];
    if (!next) throw new BadRequestException('流程缺少出口连线');
    return next.toNodeId;
  }

  private matchCondition(expr: { field: string; op: string; value: number | string }, doc: Document): boolean {
    const actual = expr.field === 'amount' ? Number(doc.amount) : doc.categoryId;
    switch (expr.op) {
      case '>=': return Number(actual) >= Number(expr.value);
      case '<=': return Number(actual) <= Number(expr.value);
      case '>': return Number(actual) > Number(expr.value);
      case '==': return actual === expr.value;
      default: return false;
    }
  }

  private async voidSiblings(instance: ApprovalInstance, nodeId: string) {
    await this.taskRepo.update(
      { instanceId: instance.id, nodeId, status: TaskStatus.Pending },
      { status: TaskStatus.Voided }
    );
  }

  private async sendCcNotifications(instance: ApprovalInstance, node: { config?: Record<string, unknown> }) {
    const userIds = ((node.config as { userIds?: string[] } | undefined)?.userIds ?? []) as string[];
    if (userIds.length) {
      await this.notify(userIds, 'cc', '文档抄送', '有文档抄送给您，请查阅。', instance.documentId);
    }
  }

  private formatMailDate(value: Date | string) {
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).format(new Date(value));
  }

  private escapeHtml(value: string) {
    return value.replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char] ?? char);
  }

  private async getApprovalMailContext(instance: ApprovalInstance, relatedId: string) {
    const table = instance.targetType === 'application' ? 'applications' : 'documents';
    const rows = await this.dataSource.query(
      `SELECT item.title, item."createdAt", creator.name AS "creatorName"
       FROM ${table} item
       LEFT JOIN users creator ON creator.id = item."ownerId"
       WHERE item.id = $1`,
      [relatedId]
    );
    const row = rows[0];
    return row
      ? {
        projectName: String(row.title ?? ''),
        creatorName: String(row.creatorName ?? ''),
        createdAt: this.formatMailDate(row.createdAt),
        targetPath: instance.targetType === 'application' ? 'applications' : 'documents'
      }
      : null;
  }

  private async sendCompletionEmail(
    instance: ApprovalInstance,
    kind: 'approved' | 'rejected' | 'timeout',
    subject: string,
    baseContent: string
  ): Promise<void> {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const log = (m: string) => console.log(`[sendCompletionEmail] ${m}`);
    try {
      const approverRows = await this.dataSource.query(
        `SELECT DISTINCT "actorId" AS id FROM approval_records WHERE "instanceId" = $1 AND "actorId" IS NOT NULL AND "actorId" <> 'system'`,
        [instance.id]
      );
      const approverIds = (approverRows as Array<{ id: string }>).map((r) => r.id).filter((id) => UUID_RE.test(id));
      const rawUserIds = [instance.initiatorId, ...approverIds];
      const userIds = [...new Set(rawUserIds.filter((id) => UUID_RE.test(id)))];
      if (userIds.length === 0) return;
      const users = await this.dataSource.query(
        `SELECT id, email, username, name FROM users WHERE id = ANY($1) AND email IS NOT NULL AND email <> ''`,
        [userIds]
      );
      if ((users as Array<unknown>).length === 0) return;
      const fileRows = instance.targetType === 'application'
        ? await this.dataSource.query(
            `SELECT id, "fileName" AS "fileName", "filePath" AS "filePath" FROM application_files WHERE "applicationId" = $1 ORDER BY "versionNo" ASC, "createdAt" ASC`,
            [instance.documentId]
          )
        : await this.dataSource.query(
            `SELECT id, "fileName", "filePath" FROM document_versions WHERE "documentId" = $1 ORDER BY "versionNo" ASC, "createdAt" ASC`,
            [instance.documentId]
          );
      const seen = new Set<string>();
      const attachments: Array<{ filename: string; path: string }> = [];
      for (const f of fileRows as Array<{ fileName: string; filePath: string }>) {
        if (!f.filePath || !fs.existsSync(f.filePath)) continue;
        let name = f.fileName;
        let suffix = 1;
        while (seen.has(name)) {
          const dot = f.fileName.lastIndexOf('.');
          const ext = dot >= 0 ? f.fileName.slice(dot) : '';
          const base = dot >= 0 ? f.fileName.slice(0, dot) : f.fileName;
          name = `${base} (${suffix})${ext}`;
          suffix += 1;
        }
        seen.add(name);
        attachments.push({ filename: name, path: f.filePath });
      }
      const link = `${process.env.PUBLIC_BASE_URL ?? 'https://localhost:8443'}/${instance.targetType === 'application' ? 'applications' : 'documents'}/${instance.documentId}`;
      const recipients = (users as Array<{ email: string; name?: string; username?: string }>).map((u) => u.email);
      const attachNote = attachments.length === 0
        ? ''
        : `\n本邮件包含 ${attachments.length} 份原始附件，请查收。`;
      const statusLabel = kind === 'approved' ? '已通过' : kind === 'rejected' ? '已驳回' : '已超时退回';
      for (const u of users as Array<{ email: string; name?: string; username?: string }>) {
        const recipientName = u.name || u.username || u.email;
        const text = `Hi, 尊敬的${recipientName}：\n\n${baseContent}\n\n审批结果：${statusLabel}。${attachNote}\n\n查看详情：${link}\n\nSPO 邮件系统推送`;
        const html = `<p>${this.escapeHtml(text).replace(/\n/g, '<br>')}</p>`;
        await this.mailer.sendWithAttachments(u.email, subject, text, html, attachments);
      }
    } catch (err) {
      const Logger = (await import('@nestjs/common')).Logger;
      const lg = new Logger('ApprovalEngineService');
      const e = err as Error & { code?: string; detail?: string; hint?: string };
      lg.error(`sendCompletionEmail failed instanceId=${instance.id} userIds=${JSON.stringify(userIds)} msg=${e?.message ?? err} code=${e?.code ?? ''} detail=${e?.detail ?? ''} hint=${e?.hint ?? ''}`);
    }
  }

  private async notify(userIds: string[], type: string, title: string, content: string, relatedId?: string) {
    const ids = [...new Set(userIds)];
    for (const userId of ids) {
      await this.notificationRepo.save(
        this.notificationRepo.create({ userId, type, title, content, relatedId: relatedId ?? null })
      );
    }
    // 同时发邮件给设置了 email 的用户（系统通知+邮件双通道）
    if (ids.length > 0) {
      const users = await this.dataSource.query(
`SELECT id, email, username, name FROM users WHERE id = ANY($1) AND email IS NOT NULL AND email <> ''`,
        [ids]
      );
      if (users.length > 0) {
        const isWithdrawalTask = type === 'new_task' && title === '新任务已经撤回' && relatedId;
        const approvalInstance = type === 'new_task' && relatedId
          ? await this.instanceRepo.findOneBy({
              documentId: relatedId,
              status: isWithdrawalTask ? InstanceStatus.Withdrawn : InstanceStatus.Running,
            })
          : null;
        const approvalContext = approvalInstance && relatedId
          ? await this.getApprovalMailContext(approvalInstance, relatedId)
          : null;
        const isNewApprovalTask = type === 'new_task' && title === '新任务待处理' && approvalContext;
        const isWithdrawnTask = isWithdrawalTask && approvalContext;
        const sentAt = isNewApprovalTask || isWithdrawnTask ? this.formatMailDate(new Date()) : null;
        const link = relatedId
          ? `${process.env.PUBLIC_BASE_URL ?? 'https://localhost:8443'}/${approvalContext?.targetPath ?? 'documents'}/${relatedId}`
          : (process.env.PUBLIC_BASE_URL ?? 'https://localhost:8443');

        for (const user of users as Array<{ email: string; username?: string; name?: string }>) {
          const recipientName = user.name || user.username || user.email;
          let mailSubject: string;
          let mailText: string;
          if (isNewApprovalTask) {
            mailSubject = 'SPO 办公协同系统-[文档审批] 新任务待处理';
            mailText = `Hi, 尊敬的${recipientName}：\n\n审批系统收到${approvalContext!.projectName}审批任务，本任务是由${approvalContext!.creatorName}于${approvalContext!.createdAt}在SPO办公协同系统中创建，请您审批！\n\nSPO 邮件系统推送\n${sentAt}`;
          } else if (isWithdrawnTask) {
            mailSubject = 'SPO 办公协同系统-[文档审批] 新任务已经撤回';
            mailText = `Hi, 尊敬的${recipientName}：\n\n审批系统收到${approvalContext!.projectName}审批任务，本任务是由${approvalContext!.creatorName}于${approvalContext!.createdAt}在SPO办公协同系统中创建，目前已经撤回！\n\nSPO 邮件系统推送\n${sentAt}`;
          } else {
            mailSubject = `[文档审批] ${title}`;
            mailText = content;
          }
          const htmlText = this.escapeHtml(mailText).replace(/\n/g, '<br>');
          const html = `<p>${htmlText}</p><p><a href="${this.escapeHtml(link)}">查看详情</a></p>`;
          await this.mailer.send(user.email, mailSubject, mailText, html);
        }
      }
    }
  }
}
