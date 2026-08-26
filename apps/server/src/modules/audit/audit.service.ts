import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

@Injectable()
export class AuditService {
  constructor(@InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>) {}

  async log(actorId: string, action: string, targetType: string, targetId?: string, detail?: Record<string, unknown>, ip?: string) {
    await this.repo.save(
      this.repo.create({ actorId, action, targetType, targetId: targetId ?? null, detail: detail ?? null, ip: ip ?? null })
    );
  }

  async findAll(query: { page?: number; pageSize?: number; actorId?: string; action?: string }) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const qb = this.repo.createQueryBuilder('a');
    if (query.actorId) qb.andWhere('a.actorId = :actorId', { actorId: query.actorId });
    if (query.action) qb.andWhere('a.action = :action', { action: query.action });
    const [items, total] = await qb.orderBy('a.createdAt', 'DESC').skip((page - 1) * pageSize).take(pageSize).getManyAndCount();
    return { items, total, page, pageSize };
  }
}