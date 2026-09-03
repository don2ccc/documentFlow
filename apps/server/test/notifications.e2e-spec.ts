import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { seedAdmin } from '../src/modules/users/seed';
import { NotificationsService } from '../src/modules/notifications/notifications.service';

describe('Notifications & Dashboard (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let adminId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    await seedAdmin(app.get(DataSource));
    const login = await request(app.getHttpServer())
      .post('/api/auth/login').send({ username: 'admin', password: 'Admin@123' });
    adminToken = login.body.accessToken;
    adminId = login.body.user.id;
  });
  afterAll(async () => { await app.close(); });

  it('unread count decreases after marking read', async () => {
    await app.get(NotificationsService).notify([adminId], 'test', '测试通知', '内容');
    const before = await request(app.getHttpServer())
      .get('/api/notifications/unread-count').set('Authorization', `Bearer ${adminToken}`);
    const list = await request(app.getHttpServer())
      .get('/api/notifications').set('Authorization', `Bearer ${adminToken}`);
    const item = list.body.items[0];
    const read = await request(app.getHttpServer())
      .patch(`/api/notifications/${item.id}/read`).set('Authorization', `Bearer ${adminToken}`);
    expect(read.status).toBe(200);
    const after = await request(app.getHttpServer())
      .get('/api/notifications/unread-count').set('Authorization', `Bearer ${adminToken}`);
    expect(Number(after.body.count)).toBe(Number(before.body.count) - 1);
  });

  it('dashboard summary returns counts', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/dashboard/summary').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.todoCount).toBe('number');
    expect(typeof res.body.myPending).toBe('number');
  });

  it('audit log lists login action', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/audit-logs').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });
});