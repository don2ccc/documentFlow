import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { InstanceStatus, TaskStatus, TimeoutAction } from '@document-flow/shared';
import { Notification } from '../notifications/entities/notification.entity';
import { ApprovalEngineService } from './approval-engine.service';
import { ApprovalInstance } from './entities/approval-instance.entity';
import { ApprovalTask } from './entities/approval-task.entity';

@Injectable()
export class ApprovalTimeoutWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ApprovalTimeoutWorker.name);
  private timer?: NodeJS.Timeout;

  constructor(
    @InjectRepository(ApprovalTask) private readonly taskRepo: Repository<ApprovalTask>,
    @InjectRepository(ApprovalInstance) private readonly instanceRepo: Repository<ApprovalInstance>,
    private readonly engine: ApprovalEngineService,
    @InjectRepository(Notification) private readonly notificationRepo: Repository<Notification>
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.runOnce(), 60_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async runOnce(): Promise<void> {
    const overdue = await this.taskRepo.find({ where: { status: TaskStatus.Pending, dueAt: LessThan(new Date()) } });
    for (const task of overdue) {
      const instance = await this.instanceRepo.findOneBy({ id: task.instanceId });
      if (!instance || instance.status !== InstanceStatus.Running) continue;
      const node = instance.snapshot.nodes.find((n) => n.id === task.nodeId);
      if (!node?.timeoutAction) continue;
      if (node.timeoutAction === TimeoutAction.Remind) {
        await this.notificationRepo.save(
          this.notificationRepo.create({
            userId: task.assigneeId ?? '', type: 'timeout_remind',
            title: '任务即将超时', content: `${node.name} 已超过处理时限，请尽快处理。`, relatedId: task.id
          })
        );
      } else if (node.timeoutAction === TimeoutAction.AutoApprove) {
        await this.engine.handleTask(task.id, 'system', 'approve', '超时自动同意');
      } else if (node.timeoutAction === TimeoutAction.AutoReject) {
        await this.engine.handleTask(task.id, 'system', 'reject', '超时自动驳回');
      } else if (node.timeoutAction === TimeoutAction.ReturnToInitiator) {
        await this.engine.returnToInitiator(task.id, instance.id, node);
      }
    }
  }
}