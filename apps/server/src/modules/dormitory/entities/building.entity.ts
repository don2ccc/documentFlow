import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Room } from './room.entity';

@Entity('dormitory_buildings')
export class Building {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ unique: true }) name!: string;
  @Column({ type: 'varchar', nullable: true }) address!: string | null;
  @Column({ type: 'int', default: 1 }) totalFloors!: number;
  @Column({ type: 'text', nullable: true }) notes!: string | null;
  @CreateDateColumn() createdAt!: Date;
  @OneToMany(() => Room, (r) => r.building) rooms?: Room[];
}
