import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('application_files')
export class ApplicationFile {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index() @Column({ type: 'uuid' }) applicationId!: string;
  @Column() fileName!: string;
  @Column() mimeType!: string;
  @Column({ type: 'int' }) size!: number;
  @Column() filePath!: string;
  @Column() checksum!: string;
  @Column({ type: 'int' }) versionNo!: number;
  @Column({ type: 'uuid' }) uploadedBy!: string;
  @Column({ type: 'timestamptz', default: () => 'now()' }) createdAt!: Date;
  @Column({ type: 'varchar', nullable: true }) signedPath!: string | null;
  @Column({ type: 'timestamptz', nullable: true }) signedAt!: Date | null;
  @Column({ type: 'uuid', nullable: true }) signedBy!: string | null;
  @Column({ type: 'varchar', nullable: true }) signedByName!: string | null;
}
