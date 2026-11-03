import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { ShiftSegmentValue } from './attendance-shift.entity';

/**
 * 一次「上传原始打卡数据」的批次。
 *
 * 班次信息在这里做快照：之后修改或停用班次，历史结果仍然按当时的
 * 班次时间与标准工时展示，不会因为改配置而变形。
 */
@Entity('attendance_uploads')
export class AttendanceUpload {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Column({ length: 200 }) fileName!: string;

  @Column({ type: 'uuid' }) shiftId!: string;
  @Column({ length: 20 }) shiftCode!: string;
  @Column({ length: 50 }) shiftName!: string;
  @Column({ type: 'jsonb' }) shiftSegments!: ShiftSegmentValue[];
  @Column({ type: 'int' }) standardMinutes!: number;

  /** 打卡数据的日期范围（YYYY-MM-DD） */
  @Column({ length: 10 }) periodStart!: string;
  @Column({ length: 10 }) periodEnd!: string;

  @Column({ type: 'int', default: 0 }) punchCount!: number;
  @Column({ type: 'int', default: 0 }) employeeCount!: number;
  @Column({ type: 'int', default: 0 }) resultCount!: number;

  @Column({ type: 'uuid', nullable: true }) createdBy!: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) createdByName!: string | null;
  @Column({ type: 'timestamptz', default: () => 'now()' }) createdAt!: Date;
}
