import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { TaskStatus } from '@document-flow/shared';

@Entity('approval_tasks')
export class ApprovalTask {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) instanceId!: string;
  @Column() nodeId!: string;
  @Column({ type: 'varchar' }) assigneeType!: string;
  @Column({ type: 'uuid', nullable: true }) assigneeId!: string | null;
  @Column({ type: 'uuid', nullable: true }) assigneeRoleId!: string | null;
  @Column({ type: 'uuid', nullable: true }) claimedBy!: string | null;
  @Column({ type: 'varchar', default: TaskStatus.Pending }) status!: TaskStatus;
  @Column({ type: 'timestamptz', nullable: true }) dueAt!: Date | null;
  @Column({ type: 'timestamptz', default: () => 'now()' }) createdAt!: Date;
  @Column({ type: 'timestamptz', nullable: true }) processedAt!: Date | null;
}