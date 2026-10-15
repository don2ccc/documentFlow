import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { DocumentStatus } from '@document-flow/shared';

@Entity('applications')
export class Application {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column() title!: string;
  @Column({ type: 'text', nullable: true }) description!: string | null;
  @Column({ type: 'uuid', nullable: true }) categoryId!: string | null;
  @Column({ type: 'decimal', precision: 14, scale: 2, nullable: true }) amount!: string | null;
  @Column({ type: 'uuid' }) ownerId!: string;
  @Column({ type: 'varchar', length: 12, unique: true }) applicationNo!: string;
  @Column({ type: 'varchar', default: DocumentStatus.Draft }) status!: DocumentStatus;
  @Column({ type: 'uuid', nullable: true }) currentInstanceId!: string | null;
  @Column({ type: 'uuid', nullable: true }) defaultWorkflowId!: string | null;
  @Column({ type: 'timestamptz', default: () => 'now()' }) createdAt!: Date;
  // 必须是 UpdateDateColumn：@Column(default: now()) 只在 INSERT 生效，UPDATE 不会刷新
  @UpdateDateColumn({ name: 'updatedAt', type: 'timestamptz' }) updatedAt!: Date;
}
