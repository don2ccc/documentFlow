import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Room } from './room.entity';

@Entity('dormitory_meter_readings')
export class MeterReading {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @ManyToOne(() => Room, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roomId' }) room!: Room;
  @Column() roomId!: string;
  // 账期 YYYY-MM
  @Column({ type: 'varchar', length: 7 }) period!: string;
  // 本期表读数
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 }) electricReading!: string;
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 }) waterReading!: string;
  // 本期用量 = 本期 - 上期(由服务层在新增/查询时计算返回)
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 }) electricUsage!: string;
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 }) waterUsage!: string;
  // 公共区域用量(整栋或某层)
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 }) publicElectricUsage!: string;
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 }) publicWaterUsage!: string;
  @Column({ type: 'date' }) readingDate!: string;
  @Column({ type: 'varchar', length: 64, nullable: true }) recordedBy!: string | null;
  @Column({ type: 'text', nullable: true }) notes!: string | null;
  @CreateDateColumn() createdAt!: Date;
}
