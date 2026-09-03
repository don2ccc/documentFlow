import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { seedAdmin } from '../src/modules/users/seed';

describe('Categories (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  const name = `分类${Date.now()}`;

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

  it('creates and lists categories', async () => {
    const create = await request(app.getHttpServer())
      .post('/api/categories').set('Authorization', `Bearer ${adminToken}`)
      .send({ name, sortOrder: 1 });
    expect(create.status).toBe(201);
    const list = await request(app.getHttpServer())
      .get('/api/categories').set('Authorization', `Bearer ${adminToken}`);
    expect(list.body.some((c: any) => c.name === name)).toBe(true);
  });

  it('deletes un-referenced category', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/categories').set('Authorization', `Bearer ${adminToken}`);
    const cat = list.body.find((c: any) => c.name === name);
    const del = await request(app.getHttpServer())
      .delete(`/api/categories/${cat.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(200);
  });
});