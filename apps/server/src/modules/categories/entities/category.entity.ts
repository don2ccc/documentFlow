import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ unique: true }) name!: string;
  @Column({ type: 'int', default: 0 }) sortOrder!: number;
  @Column({ type: 'timestamptz', default: () => 'now()' }) createdAt!: Date;
}