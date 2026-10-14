import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { seedAdmin } from '../src/modules/users/seed';

describe('Approval flow (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  const suffix = Date.now();
  const roleCode = `approver_${suffix}`;
  const approverName = `a_${suffix}`;

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

  it('submits document, approver approves, document archived', async () => {
    const role = await request(app.getHttpServer())
      .post('/api/roles').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `审批角色${suffix}`, code: roleCode, permissionCodes: ['approval:handle'] });
    expect(role.status).toBe(201);

    await request(app.getHttpServer())
      .post('/api/users').set('Authorization', `Bearer ${adminToken}`)
      .send({ username: approverName, password: 'Pass@123', name: '审批人', email: 'approver@example.com', roleIds: [role.body.id] });

    const wf = await request(app.getHttpServer())
      .post('/api/workflows').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `测试流程${suffix}` });
    const wfId = wf.body.id;
    const nodes = [
      { id: 's', name: '开始', type: 'start' },
      { id: 'a', name: '部门经理审批', type: 'approval', approverRule: 'role', approverValue: role.body.id, approvalMethod: 'orsign' },
      { id: 'e', name: '结束', type: 'end' }
    ];
    const edges = [
      { id: 'e1', fromNodeId: 's', toNodeId: 'a' },
      { id: 'e2', fromNodeId: 'a', toNodeId: 'e' }
    ];
    const save = await request(app.getHttpServer())
      .put(`/api/workflows/${wfId}/nodes`).set('Authorization', `Bearer ${adminToken}`)
      .send({ nodes, edges });
    expect(save.status).toBe(200);
    const activate = await request(app.getHttpServer())
      .post(`/api/workflows/${wfId}/activate`).set('Authorization', `Bearer ${adminToken}`);
    expect(activate.status).toBe(201);

    const up = await request(app.getHttpServer())
      .post('/api/documents').set('Authorization', `Bearer ${adminToken}`)
      .field('title', `审批文档${suffix}`).field('amount', '5000')
      .attach('file', Buffer.from('%PDF-1.4'), { filename: 'a.pdf', contentType: 'application/pdf' });
    const docId = up.body.id;
    const submit = await request(app.getHttpServer())
      .post(`/api/documents/${docId}/submit`).set('Authorization', `Bearer ${adminToken}`)
      .send({ workflowId: wfId });
    expect(submit.status).toBe(201);
    expect(submit.body.status).toBe('in_approval');

    const approverLogin = await request(app.getHttpServer())
      .post('/api/auth/login').send({ username: approverName, password: 'Pass@123' });
    const todos = await request(app.getHttpServer())
      .get('/api/approvals/todos').set('Authorization', `Bearer ${approverLogin.body.accessToken}`);
    expect(todos.status).toBe(200);
    const todo = todos.body.items.find((t: any) => t.title === `审批文档${suffix}`);
    expect(todo).toBeTruthy();
    expect(todo.nodeName).toBe('部门经理审批');

    const approve = await request(app.getHttpServer())
      .post(`/api/approvals/tasks/${todo.taskId}/approve`).set('Authorization', `Bearer ${approverLogin.body.accessToken}`)
      .send({ comment: '同意' });
    expect(approve.status).toBe(201);

    const detail = await request(app.getHttpServer())
      .get(`/api/documents/${docId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(detail.body.status).toBe('archived');
  });
});