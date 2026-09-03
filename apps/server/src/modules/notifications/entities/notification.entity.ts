import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) userId!: string;
  @Column() type!: string;
  @Column() title!: string;
  @Column({ type: 'text' }) content!: string;
  @Column({ type: 'uuid', nullable: true }) relatedId!: string | null;
  @Column({ type: 'timestamptz', nullable: true }) readAt!: Date | null;
  @Column({ type: 'timestamptz', default: () => 'now()' }) createdAt!: Date;
}