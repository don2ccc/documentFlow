import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Room } from './room.entity';

export type AssetType = '空调' | '床' | '柜子' | '热水器' | '其他';
export type AssetStatus = '正常' | '损坏' | '已报废';

@Entity('dormitory_assets')
export class Asset {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @ManyToOne(() => Room, (r) => r.assets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roomId' }) room!: Room;
  @Column() roomId!: string;
  @Column() name!: string;
  @Column({ type: 'varchar' }) type!: AssetType;
  @Column({ type: 'varchar', nullable: true }) brand!: string | null;
  @Column({ type: 'varchar', nullable: true }) model!: string | null;
  @Column({ type: 'varchar', nullable: true }) serialNo!: string | null;
  @Column({ type: 'date', nullable: true }) purchaseDate!: string | null;
  @Column({ type: 'varchar', default: '正常' }) status!: AssetStatus;
  @Column({ type: 'text', nullable: true }) damageNote!: string | null;
  @CreateDateColumn() createdAt!: Date;
}
