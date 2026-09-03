import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Bed } from './bed.entity';

export type ResidentStatus = '在住' | '已退宿';

@Entity('dormitory_residents')
export class Resident {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ unique: true }) employeeNo!: string;
  @Column() name!: string;
  @Column({ type: 'varchar', nullable: true }) department!: string | null;
  @Column({ type: 'varchar', nullable: true }) phone!: string | null;
  @Column({ type: 'date', nullable: true }) hireDate!: string | null;
  @ManyToOne(() => Bed, (b) => b.residents, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'bedId' }) bed?: Bed | null;
  @Column({ type: 'uuid', nullable: true }) bedId!: string | null;
  @Column({ type: 'date' }) checkInDate!: string;
  @Column({ type: 'date', nullable: true }) checkOutDate!: string | null;
  // 退宿物品查验 + 结算费用
  @Column({ type: 'text', nullable: true }) checkOutItemsCheck!: string | null;
  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true }) checkOutSettlement!: string | null;
  @Column({ type: 'varchar', default: '在住' }) status!: ResidentStatus;
  @Column({ type: 'text', nullable: true }) notes!: string | null;
  @CreateDateColumn() createdAt!: Date;
}
