import { Column, Entity, JoinTable, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
import { UserStatus } from '@document-flow/shared';
import { Role } from '../../roles/entities/role.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ unique: true }) username!: string;
  @Column() passwordHash!: string;
  @Column() name!: string;
  @Column({ type: 'varchar', nullable: true }) employeeNo!: string | null;
  @Column({ type: 'varchar', nullable: true }) email!: string | null;
  @Column({ type: 'uuid', nullable: true }) departmentId!: string | null;
  @Column({ type: 'varchar', default: UserStatus.Pending }) status!: UserStatus;
  @Column({ type: 'timestamptz', default: () => 'now()' }) createdAt!: Date;
  @ManyToMany(() => Role, (r) => r.users)
  @JoinTable({ name: 'user_roles', joinColumn: { name: 'userId', referencedColumnName: 'id' }, inverseJoinColumn: { name: 'roleId', referencedColumnName: 'id' } })
  roles!: Role[];
}