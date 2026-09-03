import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('departments')
export class Department {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column() name!: string;
  @Column({ type: 'uuid', nullable: true }) parentId!: string | null;
  @Column({ type: 'uuid', nullable: true }) managerId!: string | null;
  @Column({ type: 'timestamptz', default: () => 'now()' }) createdAt!: Date;
}