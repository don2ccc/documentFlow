import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { DocumentStatus } from '@document-flow/shared';

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column() title!: string;
  @Column({ type: 'text', nullable: true }) description!: string | null;
  @Column({ type: 'uuid', nullable: true }) categoryId!: string | null;
  @Column({ type: 'decimal', precision: 14, scale: 2, nullable: true }) amount!: string | null;
  @Column({ type: 'uuid' }) ownerId!: string;
  @Column({ type: 'varchar', default: DocumentStatus.Draft }) status!: DocumentStatus;
  @Column({ type: 'uuid', nullable: true }) currentInstanceId!: string | null;
  @Column({ type: 'timestamptz', default: () => 'now()' }) createdAt!: Date;
  @Column({ type: 'timestamptz', default: () => 'now()' }) updatedAt!: Date;
}