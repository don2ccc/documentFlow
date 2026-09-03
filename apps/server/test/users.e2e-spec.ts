import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { seedAdmin } from '../src/modules/users/seed';

describe('Users (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  const username = `u_${Date.now()}`;

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

  it('creates a user and lists without passwordHash', async () => {
    const create = await request(app.getHttpServer())
      .post('/api/users').set('Authorization', `Bearer ${adminToken}`)
      .send({ username, password: 'Pass@123', name: '测试用户', roleIds: [] });
    expect(create.status).toBe(201);
    expect(create.body.passwordHash).toBeUndefined();
    const list = await request(app.getHttpServer())
      .get('/api/users').set('Authorization', `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    expect(list.body.items[0].passwordHash).toBeUndefined();
  });

  it('user without user:manage permission gets 403', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login').send({ username, password: 'Pass@123' });
    expect(login.status).toBe(200);
    const res = await request(app.getHttpServer())
      .post('/api/users').set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({ username: 'x', password: 'Pass@123', name: 'x', roleIds: [] });
    expect(res.status).toBe(403);
  });

  it('reset password allows new login', async () => {
    const list = await request(app.getHttpServer())
      .get(`/api/users?keyword=${username}`).set('Authorization', `Bearer ${adminToken}`);
    const userId = list.body.items[0].id;
    const res = await request(app.getHttpServer())
      .post(`/api/users/${userId}/reset-password`).set('Authorization', `Bearer ${adminToken}`)
      .send({ newPassword: 'NewPass@123' });
    expect(res.status).toBe(201);
    const login = await request(app.getHttpServer())
      .post('/api/auth/login').send({ username, password: 'NewPass@123' });
    expect(login.status).toBe(200);
  });

  it('disabled user cannot login', async () => {
    const list = await request(app.getHttpServer())
      .get(`/api/users?keyword=${username}`).set('Authorization', `Bearer ${adminToken}`);
    const userId = list.body.items[0].id;
    const res = await request(app.getHttpServer())
      .patch(`/api/users/${userId}/status`).set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'disabled' });
    expect(res.status).toBe(200);
    const login = await request(app.getHttpServer())
      .post('/api/auth/login').send({ username, password: 'NewPass@123' });
    expect(login.status).toBe(401);
  });
});