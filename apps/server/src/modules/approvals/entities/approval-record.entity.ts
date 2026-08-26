import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('approval_records')
export class ApprovalRecord {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) instanceId!: string;
  @Column({ type: 'uuid', nullable: true }) taskId!: string | null;
  @Column({ type: 'uuid' }) actorId!: string;
  @Column({ type: 'varchar' }) action!: string;
  @Column({ type: 'text', nullable: true }) comment!: string | null;
  @Column({ type: 'timestamptz', default: () => 'now()' }) createdAt!: Date;
}