import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { seedAdmin } from '../src/modules/users/seed';

describe('Document visibility (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    await seedAdmin(app.get(DataSource));
    const login = await request(app.getHttpServer())
      .post('/api/auth/login').send({ username: 'admin', password: 'Admin@123' });
    adminToken = login.body.accessToken;
  });
  afterAll(async () => { await app.close(); });

  it('second user cannot see others draft document, admin can', async () => {
    const up = await request(app.getHttpServer())
      .post('/api/documents').set('Authorization', `Bearer ${adminToken}`)
      .field('title', `隐私文档${Date.now()}`)
      .attach('file', Buffer.from('%PDF-1.4'), { filename: 'p.pdf', contentType: 'application/pdf' });
    expect(up.status).toBe(201);

    const otherName = `u_vis_${Date.now()}`;
    await request(app.getHttpServer())
      .post('/api/users').set('Authorization', `Bearer ${adminToken}`)
      .send({ username: otherName, password: 'Pass@123', name: '其他用户', email: 'vis@example.com', roleIds: [] });
    const otherLogin = await request(app.getHttpServer())
      .post('/api/auth/login').send({ username: otherName, password: 'Pass@123' });

    const forbidden = await request(app.getHttpServer())
      .get(`/api/documents/${up.body.id}`).set('Authorization', `Bearer ${otherLogin.body.accessToken}`);
    expect(forbidden.status).toBe(403);

    const adminView = await request(app.getHttpServer())
      .get(`/api/documents/${up.body.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(adminView.status).toBe(200);
    expect(adminView.body.versions.length).toBe(1);
  });
});