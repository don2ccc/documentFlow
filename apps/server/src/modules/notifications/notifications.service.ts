import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';

@Injectable()
export class NotificationsService {
  constructor(@InjectRepository(Notification) private readonly repo: Repository<Notification>) {}

  async notify(userIds: string[], type: string, title: string, content: string, relatedId?: string) {
    for (const userId of [...new Set(userIds)]) {
      await this.repo.save(this.repo.create({ userId, type, title, content, relatedId: relatedId ?? null }));
    }
  }

  async findAll(userId: string, query: { page?: number; pageSize?: number; unreadOnly?: string }) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 50);
    const qb = this.repo.createQueryBuilder('n').where('n.userId = :userId', { userId });
    if (query.unreadOnly === 'true') qb.andWhere('n.readAt IS NULL');
    const [items, total] = await qb.orderBy('n.createdAt', 'DESC').skip((page - 1) * pageSize).take(pageSize).getManyAndCount();
    return { items, total, page, pageSize };
  }

  async markRead(userId: string, id: string) {
    await this.repo.update({ id, userId }, { readAt: new Date() });
    return { ok: true };
  }

  async markAllRead(userId: string) {
    await this.repo.update({ userId, readAt: IsNull() }, { readAt: new Date() });
    return { ok: true };
  }

  async unreadCount(userId: string) {
    return { count: await this.repo.count({ where: { userId, readAt: IsNull() } }) };
  }
}