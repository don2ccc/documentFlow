import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** OT（加班）申请表：某员工某天申请的加班起止区间。 */
@Entity('attendance_ot_applications')
@Index(['uploadId', 'employeeNo'])
export class AttendanceOtApplication {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Index()
  @Column({ type: 'uuid' }) uploadId!: string;

  @Column({ length: 40 }) employeeNo!: string;
  @Column({ type: 'varchar', length: 50, nullable: true }) employeeName!: string | null;

  /** 申请开始日期 YYYY-MM-DD，便于按天匹配 */
  @Column({ length: 10 }) workDate!: string;

  /** YYYY-MM-DD HH:mm:ss（服务器本地时间，不涉及时区换算） */
  @Column({ length: 19 }) startAt!: string;
  @Column({ length: 19 }) endAt!: string;

  /** 加班代码，如 OTS */
  @Column({ type: 'varchar', length: 20, nullable: true }) otCode!: string | null;
  /** 原表的「整班班值」列 */
  @Column({ type: 'varchar', length: 20, nullable: true }) shiftCode!: string | null;
}
