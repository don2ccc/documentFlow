import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { seedAdmin } from '../src/modules/users/seed';

import { Employee } from '../src/modules/hr/entities/employee.entity';
import { Document } from '../src/modules/documents/entities/document.entity';
import { Application } from '../src/modules/applications/entities/application.entity';
import { Workflow } from '../src/modules/workflows/entities/workflow.entity';
import { SystemSetting } from '../src/modules/core-settings/entities/system-setting.entity';

/**
 * updatedAt 必须是 UpdateDateColumn。
 *
 * 写成 @Column({ default: () => 'now()' }) 时，default 只在 INSERT 生效，
 * UPDATE 不会刷新，于是该字段永远等于创建时间。
 * 本文件把这个约定固定下来，防止有人改回错误写法。
 *
 * 注意：TypeORM 只在 save() 时刷新 UpdateDateColumn，
 * QueryBuilder 的 update() 不会，所以下面统一用 repository.save()。
 */
describe('updatedAt 会在保存后刷新', () => {
  let app: INestApplication;
  let ds: DataSource;
  const created: Array<() => Promise<void>> = [];
  // 6 位：employeeNo 是 varchar(8)、applicationNo 是 varchar(12)，
  // 前缀 UT / UT-APP- 各占 2 / 7 字符，6 位刚好不超长
  const stamp = Date.now().toString().slice(-6);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    ds = app.get(DataSource);
    await seedAdmin(ds);
  });

  afterAll(async () => {
    for (const fn of created.reverse()) await fn().catch(() => undefined);
    await app.close();
  });

  /** 建一条 -> 改一个字段 -> 再存 -> 比较两个时间戳 */
  async function check(
    repo: Repository<any>,
    make: () => Partial<any>,
    patch: Record<string, unknown>
  ) {
    const entity = repo.create(make());
    const saved = await repo.save(entity);
    created.push(async () => { await repo.delete(saved.id); });

    expect(saved.createdAt).toBeInstanceOf(Date);
    expect(saved.updatedAt).toBeInstanceOf(Date);

    // 拉开时间差，避免毫秒精度下相等
    await new Promise((r) => setTimeout(r, 1100));

    await repo.save({ ...saved, ...patch });
    const after = await repo.findOneByOrFail({ id: saved.id });

    expect(after.updatedAt.getTime()).toBeGreaterThan(after.createdAt.getTime());
    // 创建时间本身不该被动到
    expect(after.createdAt.getTime()).toBe(saved.createdAt.getTime());
  }

  it('hr_employees', async () => {
    await check(ds.getRepository(Employee),
      () => ({ employeeNo: `UT${stamp}`, name: '时间戳测试', active: true }),
      { jobTitle: '改过的职务' });
  });

  it('documents', async () => {
    const owner = await oneUserId(ds);
    await check(ds.getRepository(Document),
      () => ({ title: `文档时间戳${stamp}`, ownerId: owner }),
      { description: '改过的描述' });
  });

  it('applications', async () => {
    const owner = await oneUserId(ds);
    await check(ds.getRepository(Application),
      () => ({ title: `申请时间戳${stamp}`, ownerId: owner, applicationNo: `UT${stamp}` }),
      { description: '改过的描述' });
  });

  it('workflows', async () => {
    await check(ds.getRepository(Workflow),
      () => ({ name: `流程时间戳${stamp}` }),
      { description: '改过的描述' });
  });

  it('core_settings（本项目唯一一开始就写对的实体，作为对照）', async () => {
    const repo = ds.getRepository(SystemSetting);
    const key = `ut.updatedAt.${stamp}`;
    const saved = await repo.save(repo.create({ key, value: 'v1' }));
    created.push(async () => { await repo.delete(key); });
    const before = saved.updatedAt.getTime();

    await new Promise((r) => setTimeout(r, 1100));
    await repo.save({ ...saved, value: 'v2' });
    const after = await repo.findOneByOrFail({ key });

    // 该实体没有 createdAt，直接比对两次保存之间是否有推进
    expect(after.updatedAt.getTime()).toBeGreaterThan(before);
  });
});

async function oneUserId(ds: DataSource): Promise<string> {
  const row = await ds.query('SELECT id FROM users LIMIT 1');
  return row[0].id;
}