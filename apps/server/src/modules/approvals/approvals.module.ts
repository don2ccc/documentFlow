import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from '../documents/entities/document.entity';
import { Application } from '../applications/entities/application.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { WorkflowsModule } from '../workflows/workflows.module';
import { SignatureModule } from '../signatures/signature.module';
import { AuditModule } from '../audit/audit.module';
import { ApprovalEngineService } from './approval-engine.service';
import { ApprovalTimeoutWorker } from './approval-timeout.worker';
import { ApprovalsController } from './approvals.controller';
import { ApprovalInstance } from './entities/approval-instance.entity';
import { ApprovalRecord } from './entities/approval-record.entity';
import { ApprovalTask } from './entities/approval-task.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApprovalInstance, ApprovalTask, ApprovalRecord, Document, Application]),
    AuditModule,
    SignatureModule,
    WorkflowsModule,
    NotificationsModule
  ],
  controllers: [ApprovalsController],
  providers: [ApprovalEngineService, ApprovalTimeoutWorker],
  exports: [ApprovalEngineService]
})
export class ApprovalsModule {}