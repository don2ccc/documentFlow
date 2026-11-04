import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { ShiftSegmentValue } from './attendance-shift.entity';

export interface ShiftSnapshotEntry {
  name: string;
  segments: ShiftSegmentValue[];
  standardMinutes: number;
}

/**
 * 一次「上传原始打卡数据」的批次。
 *
 * 班次信息在这里做快照：之后修改或停用班次，历史结果仍然按当时的
 * 班次时间与标准工时展示，不会因为改配置而变形。
 * 原始数据带「班次」列时，一批里可能有多个班次，用 shiftSnapshot 保存全部。
 */
@Entity('attendance_uploads')
export class AttendanceUpload {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Column({ length: 200 }) fileName!: string;

  /** 文件没有班次列时使用的默认班次；纯按行班次计算时为空 */
  @Column({ type: 'uuid', nullable: true }) shiftId!: string | null;
  @Column({ length: 20 }) shiftCode!: string;
  @Column({ length: 50 }) shiftName!: string;
  @Column({ type: 'jsonb' }) shiftSegments!: ShiftSegmentValue[];
  @Column({ type: 'int' }) standardMinutes!: number;

  /** 本批次涉及的班次编码，例如 "M10 / M11 / M12 / M21" */
  @Column({ type: 'varchar', length: 200, nullable: true }) shiftSummary!: string | null;
  @Column({ type: 'jsonb', nullable: true }) shiftSnapshot!: Record<string, ShiftSnapshotEntry> | null;

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
