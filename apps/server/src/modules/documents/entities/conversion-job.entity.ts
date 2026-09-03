import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('conversion_jobs')
export class ConversionJob {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', unique: true }) documentVersionId!: string;
  @Column({ type: 'varchar', default: 'pending' }) status!: string;
  @Column({ type: 'text', nullable: true }) error!: string | null;
  @Column({ type: 'text', nullable: true }) previewPath!: string | null;
  @Column({ type: 'timestamptz', default: () => 'now()' }) createdAt!: Date;
}