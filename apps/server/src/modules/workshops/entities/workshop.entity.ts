import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('workshops')
export class Workshop {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column() name!: string;
  @Column({ type: 'uuid', nullable: true }) parentId!: string | null;
  @Column({ type: 'uuid', nullable: true }) managerId!: string | null;
  @Column({ type: 'timestamptz', default: () => 'now()' }) createdAt!: Date;
}
