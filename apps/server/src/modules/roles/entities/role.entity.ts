import { Column, Entity, JoinTable, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Permission } from './permission.entity';
import { User } from '../../users/entities/user.entity';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ unique: true }) name!: string;
  @Column({ unique: true }) code!: string;
  @Column({ type: 'varchar', nullable: true }) description!: string | null;
  @ManyToMany(() => Permission)
  @JoinTable({ name: 'role_permissions', joinColumn: { name: 'roleId', referencedColumnName: 'id' }, inverseJoinColumn: { name: 'permissionId', referencedColumnName: 'id' } })
  permissions!: Permission[];
  @ManyToMany(() => User, (u) => u.roles)
  users!: User[];
}