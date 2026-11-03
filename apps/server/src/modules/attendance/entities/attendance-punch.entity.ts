import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** 原始打卡记录（去重后）。保留原文，便于核对与重新计算。 */
@Entity('attendance_punches')
@Index(['uploadId', 'employeeNo'])
export class AttendancePunch {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Index()
  @Column({ type: 'uuid' }) uploadId!: string;

  @Column({ length: 40 }) employeeNo!: string;
  @Column({ length: 50 }) employeeName!: string;
  @Column({ type: 'varchar', length: 100, nullable: true }) department!: string | null;

  /** YYYY-MM-DD HH:mm:ss（服务器本地时间，不涉及时区换算） */
  @Column({ length: 19 }) punchAt!: string;

  @Column({ type: 'varchar', length: 20, nullable: true }) machine!: string | null;
}
