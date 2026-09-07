import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser, DocumentStatus } from '@document-flow/shared';
import { ApprovalEngineService } from '../approvals/approval-engine.service';
import { Application } from '../applications/entities/application.entity';
import { Document } from '../documents/entities/document.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Document) private readonly docRepo: Repository<Document>,
    @InjectRepository(Application) private readonly appRepo: Repository<Application>,
    private readonly engine: ApprovalEngineService
  ) {}

  async summary(user: AuthUser) {
    const todo = await this.engine.todos(user, { page: 1, pageSize: 1 });
    const [myPending, myApproved, myRejected] = await Promise.all([
      this.docRepo.countBy({ ownerId: user.id, status: DocumentStatus.InApproval }),
      this.docRepo.countBy({ ownerId: user.id, status: DocumentStatus.Archived }),
      this.docRepo.countBy({ ownerId: user.id, status: DocumentStatus.Rejected })
    ]);
    const recentApps = await this.appRepo.find({
      where: { ownerId: user.id },
      order: { createdAt: 'DESC' },
      take: 8
    });
    return {
      todoCount: todo.total,
      myPending,
      myApproved,
      myRejected,
      recentInstances: recentApps.map((a) => ({
        id: a.id,
        title: a.title,
        status: a.status,
        createdAt: a.createdAt.toISOString()
      }))
    };
  }
}
