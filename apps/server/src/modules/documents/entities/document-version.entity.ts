import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('document_versions')
export class DocumentVersion {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) documentId!: string;
  @Column() fileName!: string;
  @Column() mimeType!: string;
  @Column({ type: 'int' }) size!: number;
  @Column() filePath!: string;
  @Column() checksum!: string;
  @Column({ type: 'int' }) versionNo!: number;
  @Column({ type: 'varchar', nullable: true }) reason!: string | null;
  @Column({ type: 'uuid' }) uploadedBy!: string;
  @Column({ type: 'timestamptz', default: () => 'now()' }) createdAt!: Date;
}