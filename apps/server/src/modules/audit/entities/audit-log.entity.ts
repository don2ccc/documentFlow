import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'varchar' }) actorId!: string;
  @Column() action!: string;
  @Column() targetType!: string;
  @Column({ type: 'varchar', nullable: true }) targetId!: string | null;
  @Column({ type: 'jsonb', nullable: true }) detail!: Record<string, unknown> | null;
  @Column({ type: 'varchar', nullable: true }) ip!: string | null;
  @Column({ type: 'timestamptz', default: () => 'now()' }) createdAt!: Date;
}