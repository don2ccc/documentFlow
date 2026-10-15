import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workshop } from './entities/workshop.entity';
import { CreateWorkshopDto } from './dto/create-workshop.dto';

export interface WorkshopNode {
  id: string;
  name: string;
  managerId: string | null;
  children: WorkshopNode[];
}

@Injectable()
export class WorkshopsService {
  constructor(@InjectRepository(Workshop) private readonly repo: Repository<Workshop>) {}

  list() {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  async tree(): Promise<WorkshopNode[]> {
    const all = await this.repo.find({ order: { name: 'ASC' } });
    const map = new Map<string, WorkshopNode>();
    const roots: WorkshopNode[] = [];
    for (const w of all) map.set(w.id, { id: w.id, name: w.name, managerId: w.managerId, children: [] });
    for (const w of all) {
      const node = map.get(w.id)!;
      if (w.parentId && map.has(w.parentId)) map.get(w.parentId)!.children.push(node);
      else roots.push(node);
    }
    return roots;
  }

  async create(dto: CreateWorkshopDto) {
    if (await this.repo.findOneBy({ name: dto.name })) {
      throw new ConflictException('科室名称已存在');
    }
    return this.repo.save(
      this.repo.create({ name: dto.name, parentId: dto.parentId ?? null, managerId: dto.managerId ?? null, departmentId: dto.departmentId ?? null })
    );
  }

  async update(id: string, dto: CreateWorkshopDto) {
    const w = await this.repo.findOneBy({ id });
    if (!w) throw new NotFoundException('科室不存在');
    if (dto.parentId === id) throw new ConflictException('上级科室不能是自己');
    if (dto.name !== undefined) w.name = dto.name;
    if (dto.parentId !== undefined) w.parentId = dto.parentId;
    if (dto.managerId !== undefined) w.managerId = dto.managerId;
    if (dto.departmentId !== undefined) w.departmentId = dto.departmentId;
    return this.repo.save(w);
  }

  async remove(id: string) {
    const children = await this.repo.countBy({ parentId: id });
    if (children > 0) throw new ConflictException('请先删除子科室');
    const users = await this.countUsersByWorkshop(id);
    if (users > 0) throw new ConflictException('该科室下仍有用户，无法删除');
    await this.repo.delete(id);
    return { ok: true };
  }

  private async countUsersByWorkshop(id: string): Promise<number> {
    // 注意：users."workshopId" 是大小写敏感的列名，PostgreSQL 中必须加双引号，
    // 否则会被折叠成小写而报 column "workshopid" does not exist。
    const raw = await this.repo.manager.query('SELECT COUNT(*)::int AS c FROM users WHERE "workshopId" = $1', [id]);
    return Number(raw[0]?.c ?? 0);
  }
}
