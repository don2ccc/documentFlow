import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Room } from './room.entity';
import { Resident } from './resident.entity';

export type BedStatus = '空闲' | '已住' | '维修中' | '禁用';

@Entity('dormitory_beds')
export class Bed {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @ManyToOne(() => Room, (r) => r.beds, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roomId' }) room!: Room;
  @Column() roomId!: string;
  @Column() bedNo!: string;
  @Column({ type: 'varchar', default: '空闲' }) status!: BedStatus;
  @Column({ type: 'text', nullable: true }) notes!: string | null;
  @OneToMany(() => Resident, (r) => r.bed) residents?: Resident[];
}
