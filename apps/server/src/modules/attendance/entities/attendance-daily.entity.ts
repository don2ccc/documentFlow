import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export interface DailySegmentDetail {
  start: string;
  end: string;
  in: string | null;
  out: string | null;
  minutes: number;
  missing: boolean;
}

/** 按「员工 × 排班日期」汇总后的计算结果。 */
@Entity('attendance_daily')
@Index(['uploadId', 'workDate'])
@Index(['uploadId', 'employeeNo'])
export class AttendanceDaily {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Index()
  @Column({ type: 'uuid' }) uploadId!: string;

  /** 班次开始日期（跨天班次取前一天） */
  @Column({ length: 10 }) workDate!: string;

  @Column({ length: 40 }) employeeNo!: string;
  @Column({ length: 50 }) employeeName!: string;
  @Column({ type: 'varchar', length: 100, nullable: true }) department!: string | null;

  @Column({ type: 'varchar', length: 8, nullable: true }) firstIn!: string | null;
  @Column({ type: 'varchar', length: 8, nullable: true }) lastOut!: string | null;
  @Column({ type: 'int', default: 0 }) punchCount!: number;

  /** 班次时间段内的工作分钟数（不含班次结束后的加班） */
  @Column({ type: 'int', default: 0 }) normalMinutes!: number;
  /** 总工作时长 = normalMinutes + 班次结束后的额外时长 */
  @Column({ type: 'int', default: 0 }) workMinutes!: number;
  /** 超过标准工时的部分 */
  @Column({ type: 'int', default: 0 }) overtimeMinutes!: number;

  @Column({ type: 'int', default: 0 }) lateMinutes!: number;
  @Column({ type: 'int', default: 0 }) earlyMinutes!: number;

  /** 正常 / 迟到 / 早退 / 迟到/早退 / 缺卡 / 异常 */
  @Column({ length: 20 }) status!: string;
  @Column({ type: 'varchar', length: 200, nullable: true }) abnormal!: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" }) segments!: DailySegmentDetail[];
}
