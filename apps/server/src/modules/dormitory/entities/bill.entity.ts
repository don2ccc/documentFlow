import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Resident } from './resident.entity';

export type BillStatus = '待缴费' | '部分缴费' | '已缴费' | '逾期' | '作废';

@Entity('dormitory_bills')
export class Bill {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @ManyToOne(() => Resident, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'residentId' }) resident!: Resident;
  @Column() residentId!: string;
  @Column({ type: 'varchar', length: 7 }) period!: string;
  // 各类费用明细
  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 }) electricFee!: string;
  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 }) waterFee!: string;
  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 }) roomFee!: string;
  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 }) deposit!: string;
  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 }) otherFee!: string;
  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 }) totalAmount!: string;
  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 }) paidAmount!: string;
  @Column({ type: 'varchar', length: 16, default: '待缴费' }) status!: BillStatus;
  @Column({ type: 'date' }) dueDate!: string;
  @Column({ type: 'timestamptz', nullable: true }) paidAt!: Date | null;
  @Column({ type: 'text', nullable: true }) notes!: string | null;
  @CreateDateColumn() createdAt!: Date;
}
