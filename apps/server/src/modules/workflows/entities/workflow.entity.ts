import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { WorkflowStatus } from '@document-flow/shared';

@Entity('workflows')
export class Workflow {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column() name!: string;
  @Column({ type: 'text', nullable: true }) description!: string | null;
  @Column({ type: 'varchar', default: WorkflowStatus.Draft }) status!: WorkflowStatus;
  @Column({ type: 'int', default: 1 }) version!: number;
  @Column({ type: 'timestamptz', default: () => 'now()' }) createdAt!: Date;
  // 必须是 UpdateDateColumn：@Column(default: now()) 只在 INSERT 生效，UPDATE 不会刷新
  @UpdateDateColumn({ name: 'updatedAt', type: 'timestamptz' }) updatedAt!: Date;
}