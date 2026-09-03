import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { seedAdmin } from '../src/modules/users/seed';

describe('Roles & Departments (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  const suffix = Date.now();

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

  it('creates role with permissions and lists it', async () => {
    const perms = await request(app.getHttpServer())
      .get('/api/permissions').set('Authorization', `Bearer ${adminToken}`);
    expect(perms.status).toBe(200);
    const res = await request(app.getHttpServer())
      .post('/api/roles').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `财务专员${suffix}`, code: `finance_${suffix}`, permissionCodes: [perms.body[0].code] });
    expect(res.status).toBe(201);
    const list = await request(app.getHttpServer())
      .get('/api/roles').set('Authorization', `Bearer ${adminToken}`);
    expect(list.body.some((r: any) => r.code === `finance_${suffix}`)).toBe(true);
  });

  it('cannot delete built-in sys_admin role', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/roles').set('Authorization', `Bearer ${adminToken}`);
    const adminRole = list.body.find((r: any) => r.code === 'sys_admin');
    const res = await request(app.getHttpServer())
      .delete(`/api/roles/${adminRole.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  it('department tree returns nested children', async () => {
    const root = await request(app.getHttpServer())
      .post('/api/departments').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `集团${suffix}` });
    expect(root.status).toBe(201);
    await request(app.getHttpServer())
      .post('/api/departments').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `财务部${suffix}`, parentId: root.body.id });
    const tree = await request(app.getHttpServer())
      .get('/api/departments/tree').set('Authorization', `Bearer ${adminToken}`);
    const node = tree.body.find((d: any) => d.id === root.body.id);
    expect(node.children.length).toBe(1);
  });

  it('rejects deleting department with children', async () => {
    const tree = await request(app.getHttpServer())
      .get('/api/departments/tree').set('Authorization', `Bearer ${adminToken}`);
    const node = tree.body.find((d: any) => d.name === `集团${suffix}`);
    const res = await request(app.getHttpServer())
      .delete(`/api/departments/${node.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(409);
  });
});