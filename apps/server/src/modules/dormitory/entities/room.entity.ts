import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Building } from './building.entity';
import { Bed } from './bed.entity';
import { Asset } from './asset.entity';

export type RoomType = '四人间' | '双人间' | '单人间';

@Entity('dormitory_rooms')
export class Room {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @ManyToOne(() => Building, (b) => b.rooms, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'buildingId' }) building!: Building;
  @Column() buildingId!: string;
  @Column({ type: 'int' }) floor!: number;
  @Column() roomNo!: string;
  @Column({ type: 'varchar' }) type!: RoomType;
  @Column({ type: 'int', default: 1 }) totalBeds!: number;
  @Column({ type: 'text', nullable: true }) notes!: string | null;
  @CreateDateColumn() createdAt!: Date;
  @OneToMany(() => Bed, (b) => b.room) beds?: Bed[];
  @OneToMany(() => Asset, (a) => a.room) assets?: Asset[];
}
