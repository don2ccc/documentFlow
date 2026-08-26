import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { InstanceStatus, WorkflowSnapshot } from '@document-flow/shared';

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