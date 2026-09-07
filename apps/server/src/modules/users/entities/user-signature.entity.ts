import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('user_signatures')
export class UserSignature {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index({ unique: true }) @Column({ type: 'uuid' }) userId!: string;
  @Column() fileName!: string;
  @Column() filePath!: string;
  @Column() mimeType!: string;
  @Column({ type: 'int' }) size!: number;
  @Column({ type: 'timestamptz', default: () => 'now()' }) createdAt!: Date;
}