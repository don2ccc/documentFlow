import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  ApprovalMethod, AssigneeType, DocumentStatus, InstanceStatus, NodeType, RecordAction,
  TaskStatus, WorkflowStatus, WorkflowSnapshot
} from '@document-flow/shared';
import { Notification } from '../notifications/entities/notification.entity';
import { WorkflowsService } from '../workflows/workflows.service';
import { Document } from '../documents/entities/document.entity';
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
    private readonly workflows: WorkflowsService,
    private readonly dataSource: DataSource
  ) {}

  async start(workflowId: string, documentId: string, initiatorId: string, options?: { chosenApproverIds?: Record<string, string> }) {
    const wf = await this.workflows.getById(workflowId);
    if (wf.status !== WorkflowStatus.Active) throw new BadRequestException('流程未启用');
    const nodes = wf.nodes.map((n) => {
      const chosen = options?.chosenApproverIds?.[n.id];
      return {
        id: n.id, name: n.name, type: n.type,
        approverRule: n.approverRule ?? undefined, approverValue: n.approverValue ?? undefined,
        approvalMethod: n.approvalMethod ?? undefined, timeoutHours: n.timeoutHours ?? undefined,
        timeoutAction: n.timeoutAction ?? undefined,
        config: chosen ? { ...(n.config ?? {}), chosenUserId: chosen } : n.config ?? undefined
      };
    });
    const edges = wf.edges.map((e) => ({ id: e.id, fromNodeId: e.fromNodeId, toNodeId: e.toNodeId, conditionExpr: e.conditionExpr ?? null }));
    const instance = await this.instanceRepo.save(
      this.instanceRepo.create({
        workflowId, workflowVersion: wf.version,
        snapshot: { nodes, edges, version: wf.version } as WorkflowSnapshot,
        documentId, initiatorId, status: InstanceStatus.Running
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
      await this.documentsRepo.update(
        { id: instance.documentId },
        { status: DocumentStatus.Archived, currentInstanceId: instance.id }
      );
      await this.notify([instance.initiatorId], 'approval_result', '审批已通过', '您的文档审批已全部通过，已自动归档。', instance.documentId);
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
    const dueAt = node.timeoutHours ? new Date(Date.now() + node.timeoutHours * 3600_000) : null;
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
    task.claimedBy = actorId;
    task.processedAt = new Date();
    if (action === 'reject') {
      task.status = TaskStatus.Rejected;
      await this.taskRepo.save(task);
      await this.voidSiblings(instance, task.nodeId);
      instance.status = InstanceStatus.Rejected;
      instance.finishedAt = new Date();
      await this.instanceRepo.save(instance);
      await this.documentsRepo.update({ id: instance.documentId }, { status: DocumentStatus.Rejected });
      await this.notify([instance.initiatorId], 'approval_result', '审批已驳回', `节点「${node.name}」驳回了您的文档。`, instance.documentId);
      return;
    }
    task.status = TaskStatus.Approved;
    await this.taskRepo.save(task);
    const siblings = await this.taskRepo.findBy({ instanceId: instance.id, nodeId: task.nodeId, status: TaskStatus.Pending });
    if (node.approvalMethod === ApprovalMethod.Countersign && siblings.length > 0) return;
    await this.enterNode(instance, await this.evaluateNext(instance, task.nodeId));
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
    const doc = await this.documentsRepo.findOneBy({ id: instance.documentId });
    if (!doc) throw new NotFoundException('文档不存在');
    const outgoing = instance.snapshot.edges.filter((e) => e.fromNodeId === nodeId);
    const matched = outgoing.find((e) => e.conditionExpr && this.matchCondition(e.conditionExpr, doc));
    const next = matched ?? outgoing.find((e) => !e.conditionExpr);
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

  private async notify(userIds: string[], type: string, title: string, content: string, relatedId?: string) {
    for (const userId of [...new Set(userIds)]) {
      await this.notificationRepo.save(
        this.notificationRepo.create({ userId, type, title, content, relatedId: relatedId ?? null })
      );
    }
  }
}