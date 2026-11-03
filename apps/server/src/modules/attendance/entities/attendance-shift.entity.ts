import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export interface ShiftSegmentValue {
  /** HH:mm */
  start: string;
  /** HH:mm */
  end: string;
}

/**
 * 考勤班次。
 *
 * 一个班次由若干时间段组成（例如 7:30-11:30 / 12:30-16:30 / 17:00-20:00），
 * 段与段之间视为休息时间，不计工时。结束时间早于开始时间表示跨天
 * （例如 20:00-00:00 / 01:00-08:00）。
 */
@Entity('attendance_shifts')
export class AttendanceShift {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Index({ unique: true })
  @Column({ length: 20 }) code!: string;

  @Column({ length: 50 }) name!: string;

  @Column({ type: 'jsonb' }) segments!: ShiftSegmentValue[];

  /** 标准工时（分钟），超过部分计加班。默认 8 小时 */
  @Column({ type: 'int', default: 480 }) standardMinutes!: number;

  @Column({ type: 'boolean', default: true }) active!: boolean;

  @Column({ type: 'timestamptz', default: () => 'now()' }) createdAt!: Date;
  @Column({ type: 'timestamptz', default: () => 'now()' }) updatedAt!: Date;
}
