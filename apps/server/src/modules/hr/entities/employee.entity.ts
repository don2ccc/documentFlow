import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 员工档案。
 * 字段映射自旧 VB 系统的 [Pulse_MPO1].[dbo].[HR_Employee]，列名改为小驼峰，
 * SQL Server 的 char(n) 固定长度改为 varchar 以便容纳超长输入。
 */
@Entity('hr_employees')
export class Employee {
  @PrimaryGeneratedColumn('uuid') id!: string;

  /** 员工工号，固定 8 位，业务主键 */
  @Column({ type: 'varchar', length: 8, unique: true }) employeeNo!: string;

  @Column({ type: 'varchar', length: 50 }) name!: string;

  /** 拼音姓 / 拼音名（旧系统由读卡器或手工填写） */
  @Column({ type: 'varchar', length: 50, nullable: true }) namePinyin!: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) namePinyinRest!: string | null;

  @Column({ type: 'varchar', length: 4, nullable: true }) gender!: string | null;
  @Column({ type: 'varchar', length: 30, nullable: true }) nation!: string | null;
  @Column({ type: 'date', nullable: true }) birthDate!: Date | string | null;
  @Column({ type: 'int', nullable: true }) age!: number | null;

  /** 身份证号 */
  @Column({ type: 'varchar', length: 18, nullable: true }) idCardNo!: string | null;
  /** 身份证登记地址 */
  @Column({ type: 'varchar', length: 200, nullable: true }) idCardAddress!: string | null;
  @Column({ type: 'varchar', length: 200, nullable: true }) address!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true }) phone!: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) email!: string | null;
  /** 银行卡号 */
  @Column({ type: 'varchar', length: 30, nullable: true }) bankNo!: string | null;
  /** 考勤卡号 */
  @Column({ type: 'varchar', length: 30, nullable: true }) cardNo!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true }) department!: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) workGroup!: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) jobTitle!: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) workLocation!: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) supervisor!: string | null;

  @Column({ type: 'date', nullable: true }) joinDate!: Date | string | null;
  @Column({ type: 'date', nullable: true }) leaveDate!: Date | string | null;
  /** 入职方式，旧系统限定 001 / 002 / 999 */
  @Column({ type: 'varchar', length: 10, nullable: true }) entryType!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true }) education!: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) major!: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) school!: string | null;
  @Column({ type: 'varchar', length: 10, nullable: true }) maritalStatus!: string | null;
  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true }) salary!: string | null;

  /** 返厂状态 YES/NO，由旧系统的 HR_Leave 黑名单推导 */
  @Column({ type: 'varchar', length: 10, nullable: true }) returnedStatus!: string | null;

  /** 照片相对路径，文件存 data/hr-photos */
  @Column({ type: 'varchar', length: 200, nullable: true }) photoPath!: string | null;

  @Column({ type: 'boolean', default: true }) active!: boolean;
  @Column({ type: 'timestamptz', default: () => 'now()' }) sDate!: Date;
  @Column({ type: 'timestamptz', default: () => 'now()' }) createdAt!: Date;
  @Column({ type: 'timestamptz', default: () => 'now()' }) updatedAt!: Date;
}