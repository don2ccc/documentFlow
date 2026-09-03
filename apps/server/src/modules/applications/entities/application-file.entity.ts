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
}
