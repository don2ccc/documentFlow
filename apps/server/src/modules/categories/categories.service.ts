import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCategoryDto } from './dto/create-category.dto';
import { Category } from './entities/category.entity';

@Injectable()
export class CategoriesService {
  constructor(@InjectRepository(Category) private readonly repo: Repository<Category>) {}

  async findAll(): Promise<Category[]> {
    return this.repo.find({ order: { sortOrder: 'ASC', name: 'ASC' } });
  }

  async create(dto: CreateCategoryDto) {
    if (await this.repo.findOneBy({ name: dto.name })) throw new ConflictException('分类名称已存在');
    return this.repo.save(this.repo.create({ name: dto.name, sortOrder: dto.sortOrder ?? 0 }));
  }

  async update(id: string, dto: CreateCategoryDto) {
    const cat = await this.repo.findOneBy({ id });
    if (!cat) throw new NotFoundException('分类不存在');
    if (dto.name !== undefined) cat.name = dto.name;
    if (dto.sortOrder !== undefined) cat.sortOrder = dto.sortOrder;
    return this.repo.save(cat);
  }

  async remove(id: string) {
    try {
      const raw = await this.repo.manager.query('SELECT COUNT(*)::int AS c FROM documents WHERE "categoryId" = $1', [id]);
      if (Number(raw[0]?.c ?? 0) > 0) throw new ConflictException('该分类已被文档使用，无法删除');
    } catch (e) {
      if (e instanceof ConflictException) throw e;
      // documents 表在 Task 7 之前不存在，引用检查暂跳过
    }
    await this.repo.delete(id);
    return { ok: true };
  }
}