import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from './entities/department.entity';
import { CreateDepartmentDto } from './dto/create-department.dto';

export interface DepartmentNode {
  id: string;
  name: string;
  managerId: string | null;
  children: DepartmentNode[];
}

@Injectable()
export class DepartmentsService {
  constructor(@InjectRepository(Department) private readonly repo: Repository<Department>) {}

  async tree(): Promise<DepartmentNode[]> {
    const all = await this.repo.find({ order: { name: 'ASC' } });
    const map = new Map<string, DepartmentNode>();
    const roots: DepartmentNode[] = [];
    for (const d of all) map.set(d.id, { id: d.id, name: d.name, managerId: d.managerId, children: [] });
    for (const d of all) {
      const node = map.get(d.id)!;
      if (d.parentId && map.has(d.parentId)) map.get(d.parentId)!.children.push(node);
      else roots.push(node);
    }
    return roots;
  }

  async create(dto: CreateDepartmentDto) {
    return this.repo.save(
      this.repo.create({ name: dto.name, parentId: dto.parentId ?? null, managerId: dto.managerId ?? null })
    );
  }

  async update(id: string, dto: CreateDepartmentDto) {
    const dept = await this.repo.findOneBy({ id });
    if (!dept) throw new NotFoundException('部门不存在');
    if (dto.parentId === id) throw new ConflictException('上级部门不能是自己');
    if (dto.name !== undefined) dept.name = dto.name;
    if (dto.parentId !== undefined) dept.parentId = dto.parentId;
    if (dto.managerId !== undefined) dept.managerId = dto.managerId;
    return this.repo.save(dept);
  }

  async remove(id: string) {
    const children = await this.repo.countBy({ parentId: id });
    if (children > 0) throw new ConflictException('请先删除子部门');
    const users = await this.countUsersByDepartment(id);
    if (users > 0) throw new ConflictException('该部门下仍有用户，无法删除');
    await this.repo.delete(id);
    return { ok: true };
  }

  private async countUsersByDepartment(id: string): Promise<number> {
    const raw = await this.repo.manager.query('SELECT COUNT(*)::int AS c FROM users WHERE "departmentId" = $1', [id]);
    return Number(raw[0]?.c ?? 0);
  }
}