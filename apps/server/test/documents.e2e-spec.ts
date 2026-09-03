import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { seedAdmin } from '../src/modules/users/seed';

describe('Documents (e2e)', () => {
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

  const uploadPdf = (token: string, title: string) =>
    request(app.getHttpServer())
      .post('/api/documents').set('Authorization', `Bearer ${token}`)
      .field('title', title).field('categoryId', '').field('description', 'desc').field('amount', '1000')
      .attach('file', Buffer.from('%PDF-1.4 test'), { filename: 'a.pdf', contentType: 'application/pdf' });

  it('uploads a pdf and lists my documents', async () => {
    const up = await uploadPdf(adminToken, `文档${Date.now()}`);
    expect(up.status).toBe(201);
    expect(up.body.status).toBe('draft');
    expect(up.body.latestVersion.versionNo).toBe(1);
    const list = await request(app.getHttpServer())
      .get('/api/documents').set('Authorization', `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    expect(list.body.total).toBeGreaterThanOrEqual(1);
  });

  it('rejects file with disallowed mimetype', async () => {
    const up = await request(app.getHttpServer())
      .post('/api/documents').set('Authorization', `Bearer ${adminToken}`)
      .field('title', 'bad')
      .attach('file', Buffer.from('MZ'), { filename: 'a.exe', contentType: 'application/x-msdownload' });
    expect(up.status).toBe(400);
  });

  it('uploads new version on rejected document', async () => {
    const up = await uploadPdf(adminToken, `版本测试${Date.now()}`);
    const docId = up.body.id;
    await app.get(DataSource).query('UPDATE documents SET status = $1 WHERE id = $2', ['rejected', docId]);
    const ver = await request(app.getHttpServer())
      .post(`/api/documents/${docId}/versions`).set('Authorization', `Bearer ${adminToken}`)
      .field('reason', '修订').attach('file', Buffer.from('%PDF-1.4 v2'), { filename: 'b.pdf', contentType: 'application/pdf' });
    expect(ver.status).toBe(201);
    expect(ver.body.latestVersion.versionNo).toBe(2);
    const versions = await request(app.getHttpServer())
      .get(`/api/documents/${docId}/versions`).set('Authorization', `Bearer ${adminToken}`);
    expect(versions.body.length).toBe(2);
  });
});