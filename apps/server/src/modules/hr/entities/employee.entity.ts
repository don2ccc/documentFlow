import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * 员工档案。
 * 字段映射自旧 VB 系统的 [Pulse_MPO1].[dbo].[HR_Employee]，列名改为小驼峰，
 * SQL Server 的 char(n) 固定长度改为 varchar 以便容纳超长输入。
 *
 * 唯一性用「部分唯一索引」表达，而不是列上的 unique：
 * 删除员工是逻辑删除（active=false，行仍在表里），离职员工不应继续占用工号，
 * 同工号可以再次入职。所以约束只在在职记录之间生效。
 *
 * 为什么要写在实体里而不是只放 migrations/003：
 * app.module 里 synchronize = NODE_ENV !== 'production' || DB_SYNC === 'true'，
 * 测试与本地开发环境 synchronize 恒为 true。若实体上仍留着 unique: true，
 * TypeORM 每次启动都会重建全表唯一索引，把迁移的结果悄悄顶掉 ——
 * 生产库上表现为「工号明明离职了还是不能复用」。
 */
@Index('hr_employees_employeeNo_active_key', ['employeeNo'], {
  unique: true,
  where: 'active = true'
})
@Index('hr_employees_idCardNo_active_key', ['idCardNo'], {
  unique: true,
  where: 'active = true AND "idCardNo" IS NOT NULL'
})
@Entity('hr_employees')
export class Employee {
  @PrimaryGeneratedColumn('uuid') id!: string;

  /** 员工工号，固定 8 位，业务主键（在职范围内唯一，见类上的部分唯一索引） */
  @Column({ type: 'varchar', length: 8 }) employeeNo!: string;

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

  /**
   * 离职原因。
   *
   * 设为离职时必填（服务端与前端都拦），恢复在职时清空 ——
   * 该字段描述的是「当前处于离职状态」的原因，不是一次性的历史事件。
   * 需要追溯历次离职的话看 audit_logs 的 employee:deactivate 记录。
   */
  @Column({ type: 'varchar', length: 200, nullable: true }) leaveReason!: string | null;
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

  /**
   * 最后修改时间。
   * 必须是 UpdateDateColumn —— 写成 @Column(default: now()) 时只在 INSERT 生效，
   * UPDATE 不会刷新，导致它永远等于创建时间（参见 system-setting.entity.ts 的正确写法）。
   */
  @UpdateDateColumn({ name: 'updatedAt', type: 'timestamptz' }) updatedAt!: Date;
}