import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { seedAdmin } from '../src/modules/users/seed';

describe('HR employees (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;

  /**
   * 测试库是持久的（跑完不清空），而服务层对「在职员工的身份证号」做了唯一性校验。
   * 所以这里每次生成唯一值，否则第二次跑整个 suite 都会 409。
   * 前 6 位为地区码，中间 8 位出生日期（无校验位），后 4 位序号。
   *
   * 后 4 位用进程内自增计数器而不是 Math.random()：
   * 测试库是持久的，跑得越多命中 9000 种取值的概率越高，
   * 随机取值迟早会在某次运行中撞号，表现为无关用例偶发 409。
   */
  let idCardSeq = Math.floor(Math.random() * 8000);
  const uniqueIdCard = () => {
    idCardSeq = (idCardSeq + 1) % 9000;
    return `44030119900101${String(1000 + idCardSeq).slice(-4)}`;
  };

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
      .send({ employeeNo: no, name: '测试员工', gender: '男', idCardNo: uniqueIdCard() });
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
    const idNo = uniqueIdCard();
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
    const idNo = uniqueIdCard();
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

  it('update accepts a partial payload without employeeNo', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/hr/employees').set('Authorization', `Bearer ${adminToken}`)
      .send({ employeeNo: `P${Date.now().toString().slice(-7)}`, name: '原始姓名', jobTitle: '原职务' });
    expect(created.status).toBe(201);

    // 只提交发生变化的字段，不带 employeeNo / name
    // 修复前会复用 CreateEmployeeDto 而报 400 "employeeNo must be a string"
    const upd = await request(app.getHttpServer())
      .patch(`/api/hr/employees/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`)
      .send({ jobTitle: '高级工程师' });
    expect(upd.status).toBe(200);
    expect(upd.body.jobTitle).toBe('高级工程师');
    // 未提交的字段保持原值
    expect(upd.body.employeeNo).toBe(created.body.employeeNo);
    expect(upd.body.name).toBe('原始姓名');
  });

  it('update recomputes age when birthDate changes', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/hr/employees').set('Authorization', `Bearer ${adminToken}`)
      .send({ employeeNo: `Q${Date.now().toString().slice(-7)}`, name: '辛', birthDate: '1990-01-01' });
    const before = created.body.age;
    const upd = await request(app.getHttpServer())
      .patch(`/api/hr/employees/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`)
      .send({ birthDate: '2000-01-01' });
    expect(upd.status).toBe(200);
    expect(upd.body.age).toBeLessThan(before);
  });

  it('still rejects an invalid value on partial update', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/hr/employees').set('Authorization', `Bearer ${adminToken}`)
      .send({ employeeNo: `R${Date.now().toString().slice(-7)}`, name: '壬' });
    // PartialType 只是降级必填，不应放松格式校验
    const bad = await request(app.getHttpServer())
      .patch(`/api/hr/employees/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`)
      .send({ entryType: '777' });
    expect(bad.status).toBe(400);
  });

  it('active 筛选：全部 / 在职 / 已停用', async () => {
    const onNo = `A${Date.now().toString().slice(-7)}`;
    const offNo = `B${Date.now().toString().slice(-7)}`;

    const on = await request(app.getHttpServer())
      .post('/api/hr/employees').set('Authorization', `Bearer ${adminToken}`)
      .send({ employeeNo: onNo, name: '在职样本' });
    const off = await request(app.getHttpServer())
      .post('/api/hr/employees').set('Authorization', `Bearer ${adminToken}`)
      .send({ employeeNo: offNo, name: '停用样本' });
    await request(app.getHttpServer())
      .delete(`/api/hr/employees/${off.body.id}`).set('Authorization', `Bearer ${adminToken}`);

    // 用唯一工号定位，避免受测试库里其它历史数据与默认分页影响

    // active=true 只返回在职
    const act = await request(app.getHttpServer())
      .get(`/api/hr/employees?active=true&keyword=${onNo}`).set('Authorization', `Bearer ${adminToken}`);
    expect(act.status).toBe(200);
    expect(act.body.items.map((e: any) => e.employeeNo)).toContain(onNo);

    // active=false 只返回已停用
    const deact = await request(app.getHttpServer())
      .get(`/api/hr/employees?active=false&keyword=${offNo}`).set('Authorization', `Bearer ${adminToken}`);
    expect(deact.status).toBe(200);
    expect(deact.body.items.map((e: any) => e.employeeNo)).toContain(offNo);

    // active=（空串）表示不筛选：已停用的也能查到 —— 这正是修复前的 bug
    const allOff = await request(app.getHttpServer())
      .get(`/api/hr/employees?active=&keyword=${offNo}`).set('Authorization', `Bearer ${adminToken}`);
    expect(allOff.status).toBe(200);
    expect(allOff.body.items.map((e: any) => e.employeeNo)).toContain(offNo);

    // 不传 active 同样是不筛选
    const none = await request(app.getHttpServer())
      .get(`/api/hr/employees?keyword=${onNo}`).set('Authorization', `Bearer ${adminToken}`);
    expect(none.status).toBe(200);
    expect(none.body.items.map((e: any) => e.employeeNo)).toContain(onNo);

    // 反向确认：active=false 查不到在职的
    const wrong = await request(app.getHttpServer())
      .get(`/api/hr/employees?active=false&keyword=${onNo}`).set('Authorization', `Bearer ${adminToken}`);
    expect(wrong.body.items).toEqual([]);

    await request(app.getHttpServer())
      .delete(`/api/hr/employees/${on.body.id}`).set('Authorization', `Bearer ${adminToken}`);
    await request(app.getHttpServer())
      .delete(`/api/hr/employees/${off.body.id}/permanent`).set('Authorization', `Bearer ${adminToken}`);
  });

  it('该员工在宿舍模块有入住记录时，拒绝彻底删除', async () => {
    const no = `M${Date.now().toString().slice(-7)}`;
    const created = await request(app.getHttpServer())
      .post('/api/hr/employees').set('Authorization', `Bearer ${adminToken}`)
      .send({ employeeNo: no, name: '有宿舍记录' });
    expect(created.status).toBe(201);

    // 宿舍的 employeeNo 是纯文本关联，不是外键，这里直接造一条
    // checkInDate 是 NOT NULL，必须带上
    const ds = app.get(DataSource);
    await ds.query(
      `INSERT INTO dormitory_residents (id, "employeeNo", name, "checkInDate", "createdAt")
       VALUES (gen_random_uuid(), $1, $2, CURRENT_DATE, now())`,
      [no, '有宿舍记录']
    );

    // 先停用再删除，应被拦住
    await request(app.getHttpServer())
      .delete(`/api/hr/employees/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`);
    const blocked = await request(app.getHttpServer())
      .delete(`/api/hr/employees/${created.body.id}/permanent`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(blocked.status).toBe(409);

    // 清掉入住记录后就能删
    await ds.query('DELETE FROM dormitory_residents WHERE "employeeNo" = $1', [no]);
    const ok = await request(app.getHttpServer())
      .delete(`/api/hr/employees/${created.body.id}/permanent`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(ok.status).toBe(200);
  });

  it('停用后仍可查询（active=false 的档案保留在库里）', async () => {
    const no = `B${Date.now().toString().slice(-7)}`;
    const created = await request(app.getHttpServer())
      .post('/api/hr/employees').set('Authorization', `Bearer ${adminToken}`)
      .send({ employeeNo: no, name: '庚' });
    const del = await request(app.getHttpServer())
      .delete(`/api/hr/employees/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(200);

    // 详情仍可查到，且 active=false
    const after = await request(app.getHttpServer())
      .get(`/api/hr/employees/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(after.status).toBe(200);
    expect(after.body.active).toBe(false);

    // 在「已停用」筛选下能查到
    const list = await request(app.getHttpServer())
      .get(`/api/hr/employees?active=false&keyword=${no}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(list.body.items.length).toBe(1);

    // 「在职」筛选下查不到
    const act = await request(app.getHttpServer())
      .get(`/api/hr/employees?active=true&keyword=${no}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(act.body.items.length).toBe(0);
  });

  it('彻底删除后无法再查询', async () => {
    const no = `D${Date.now().toString().slice(-7)}`;
    const created = await request(app.getHttpServer())
      .post('/api/hr/employees').set('Authorization', `Bearer ${adminToken}`)
      .send({ employeeNo: no, name: '待彻底删除' });
    expect(created.status).toBe(201);

    // 在职时不允许直接彻底删除
    const tooEarly = await request(app.getHttpServer())
      .delete(`/api/hr/employees/${created.body.id}/permanent`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(tooEarly.status).toBe(400);

    // 先停用，再彻底删除
    await request(app.getHttpServer())
      .delete(`/api/hr/employees/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`);
    const gone = await request(app.getHttpServer())
      .delete(`/api/hr/employees/${created.body.id}/permanent`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(gone.status).toBe(200);

    // 查不到了
    const after = await request(app.getHttpServer())
      .get(`/api/hr/employees/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(after.status).toBe(404);

    // 两种筛选都查不到
    for (const f of ['true', 'false']) {
      const list = await request(app.getHttpServer())
        .get(`/api/hr/employees?active=${f}&keyword=${no}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(list.body.items.length).toBe(0);
    }

    // 删除后该工号可以被重新使用
    const reuse = await request(app.getHttpServer())
      .post('/api/hr/employees').set('Authorization', `Bearer ${adminToken}`)
      .send({ employeeNo: no, name: '重建' });
    expect(reuse.status).toBe(201);
    await request(app.getHttpServer())
      .delete(`/api/hr/employees/${reuse.body.id}`).set('Authorization', `Bearer ${adminToken}`);
  });

  it('停用后该工号可以再次使用（离职不占用工号）', async () => {
    const no = `S${Date.now().toString().slice(-7)}`;
    const first = await request(app.getHttpServer())
      .post('/api/hr/employees').set('Authorization', `Bearer ${adminToken}`)
      .send({ employeeNo: no, name: '离职者' });
    expect(first.status).toBe(201);

    // 删除是逻辑删除，行还在表里
    const del = await request(app.getHttpServer())
      .delete(`/api/hr/employees/${first.body.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(200);

    // 同工号应能重新建档（复职场景）
    const again = await request(app.getHttpServer())
      .post('/api/hr/employees').set('Authorization', `Bearer ${adminToken}`)
      .send({ employeeNo: no, name: '复职者', idCardNo: uniqueIdCard() });
    expect(again.status).toBe(201);
    expect(again.body.employeeNo).toBe(no);
  });

  it('恢复在职时若工号已被他人占用，应返回 409 而不是 500', async () => {
    const no = `T${Date.now().toString().slice(-7)}`;
    const old = await request(app.getHttpServer())
      .post('/api/hr/employees').set('Authorization', `Bearer ${adminToken}`)
      .send({ employeeNo: no, name: '原持有人' });
    expect(old.status).toBe(201);
    await request(app.getHttpServer())
      .delete(`/api/hr/employees/${old.body.id}`).set('Authorization', `Bearer ${adminToken}`);

    // 同一工号被新员工占用
    const now = await request(app.getHttpServer())
      .post('/api/hr/employees').set('Authorization', `Bearer ${adminToken}`)
      .send({ employeeNo: no, name: '现持有人' });
    expect(now.status).toBe(201);

    // 再恢复旧的，应该被明确拒绝
    const back = await request(app.getHttpServer())
      .patch(`/api/hr/employees/${old.body.id}/active`).set('Authorization', `Bearer ${adminToken}`)
      .send({ active: true });
    expect(back.status).toBe(409);

    await request(app.getHttpServer())
      .delete(`/api/hr/employees/${now.body.id}`).set('Authorization', `Bearer ${adminToken}`);
  });
});