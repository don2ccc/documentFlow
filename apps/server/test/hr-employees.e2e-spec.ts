import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { seedAdmin } from '../src/modules/users/seed';

describe('HR employees (e2e)', () => {
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

  it('creates an employee and lists it', async () => {
    const no = `E${Date.now().toString().slice(-7)}`;
    const create = await request(app.getHttpServer())
      .post('/api/hr/employees').set('Authorization', `Bearer ${adminToken}`)
      .send({ employeeNo: no, name: '测试员工', gender: '男', idCardNo: '440301199001011234' });
    expect(create.status).toBe(201);
    expect(create.body.employeeNo).toBe(no);

    const list = await request(app.getHttpServer())
      .get(`/api/hr/employees?keyword=${no}`).set('Authorization', `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    expect(list.body.items.length).toBe(1);
  });

  it('rejects an employeeNo that is not 8 chars', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/hr/employees').set('Authorization', `Bearer ${adminToken}`)
      .send({ employeeNo: '123', name: '太短' });
    expect(res.status).toBe(400);
  });

  it('rejects a duplicate employeeNo', async () => {
    const no = `D${Date.now().toString().slice(-7)}`;
    const first = await request(app.getHttpServer())
      .post('/api/hr/employees').set('Authorization', `Bearer ${adminToken}`)
      .send({ employeeNo: no, name: '甲' });
    expect(first.status).toBe(201);
    const dup = await request(app.getHttpServer())
      .post('/api/hr/employees').set('Authorization', `Bearer ${adminToken}`)
      .send({ employeeNo: no, name: '乙' });
    expect(dup.status).toBe(409);
  });

  it('rejects a duplicate idCardNo among active employees', async () => {
    const idNo = `44030119900101${Math.floor(Math.random() * 9000 + 1000)}`;
    const first = await request(app.getHttpServer())
      .post('/api/hr/employees').set('Authorization', `Bearer ${adminToken}`)
      .send({ employeeNo: `F${Date.now().toString().slice(-7)}`, name: '丙', idCardNo: idNo });
    expect(first.status).toBe(201);
    const dup = await request(app.getHttpServer())
      .post('/api/hr/employees').set('Authorization', `Bearer ${adminToken}`)
      .send({ employeeNo: `G${Date.now().toString().slice(-7)}`, name: '丁', idCardNo: idNo });
    expect(dup.status).toBe(409);
  });

  it('masks idCardNo in the list but not in detail', async () => {
    const idNo = `11010119900202${Math.floor(Math.random() * 9000 + 1000)}`;
    const created = await request(app.getHttpServer())
      .post('/api/hr/employees').set('Authorization', `Bearer ${adminToken}`)
      .send({ employeeNo: `H${Date.now().toString().slice(-7)}`, name: '戊', idCardNo: idNo, bankNo: '6222021234567890' });
    expect(created.status).toBe(201);

    const list = await request(app.getHttpServer())
      .get(`/api/hr/employees?keyword=${created.body.employeeNo}`).set('Authorization', `Bearer ${adminToken}`);
    const brief = list.body.items.find((e: any) => e.id === created.body.id);
    expect(brief.idCardNo).not.toBe(idNo);
    expect(brief.idCardNo).toContain('*');

    const detail = await request(app.getHttpServer())
      .get(`/api/hr/employees/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(detail.body.idCardNo).toBe(idNo);
    expect(detail.body.bankNo).toBe('6222021234567890');
  });

  it('computes age from birthDate', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/hr/employees').set('Authorization', `Bearer ${adminToken}`)
      .send({ employeeNo: `A${Date.now().toString().slice(-7)}`, name: '己', birthDate: '1990-01-01' });
    expect(created.status).toBe(201);
    const age = new Date().getFullYear() - 1990;
    expect(created.body.age).toBeGreaterThanOrEqual(age - 1);
  });

  it('deactivate is a soft delete (active=false)', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/hr/employees').set('Authorization', `Bearer ${adminToken}`)
      .send({ employeeNo: `B${Date.now().toString().slice(-7)}`, name: '庚' });
    const del = await request(app.getHttpServer())
      .delete(`/api/hr/employees/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(200);
    const after = await request(app.getHttpServer())
      .get(`/api/hr/employees/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(after.status).toBe(200);
    expect(after.body.active).toBe(false);
  });
});