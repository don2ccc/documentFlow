import { ApprovalEngineService } from '../src/modules/approvals/approval-engine.service';
import { ApprovalMethod, InstanceStatus, TaskStatus } from '@document-flow/shared';

function makeInstance(over: Partial<Record<string, any>> = {}) {
  return {
    id: 'i1',
    status: InstanceStatus.Running,
    documentId: 'd1',
    initiatorId: 'u0',
    currentNodeId: 'n1',
    snapshot: {
      version: 1,
      nodes: [
        { id: 'n1', name: '审批', type: 'approval', approverRule: 'person', approverValue: 'u1', approvalMethod: ApprovalMethod.Orsign },
        { id: 'n2', name: '结束', type: 'end' }
      ],
      edges: [{ id: 'e1', fromNodeId: 'n1', toNodeId: 'n2' }]
    },
    ...over
  };
}

function makeEngine(overrides: Partial<Record<string, any>> = {}) {
  const repos = {
    instance: { save: jest.fn((x: any) => Promise.resolve(x)), findOneBy: jest.fn(), create: jest.fn((x: any) => x) },
    task: { save: jest.fn((x: any) => Promise.resolve(x)), findOneBy: jest.fn(), findBy: jest.fn(async () => []), update: jest.fn(), create: jest.fn((x: any) => x) },
    record: { save: jest.fn((x: any) => Promise.resolve(x)), create: jest.fn((x: any) => x) },
    notification: { save: jest.fn((x: any) => Promise.resolve(x)), create: jest.fn((x: any) => x) },
    documents: { findOneBy: jest.fn(async () => ({ id: 'd1', amount: '100', categoryId: null })), update: jest.fn() },
    applications: { update: jest.fn() },
    workflows: { getById: jest.fn() },
    dataSource: { query: jest.fn(async () => []) },
    audit: { log: jest.fn() },
    mailer: { send: jest.fn(async () => true) },
    ...overrides
  };
  return {
    engine: new ApprovalEngineService(
      repos.instance as any, repos.task as any, repos.record as any, repos.notification as any,
      repos.documents as any, repos.applications as any, repos.workflows as any, repos.dataSource as any, repos.audit as any,
      repos.mailer as any,
      { signApplicationFiles: async () => {} } as any
    ),
    repos
  };
}

describe('ApprovalEngineService', () => {
  it('orsign single approval advances to end and archives document', async () => {
    const { engine, repos } = makeEngine();
    const instance = makeInstance();
    const task = { id: 't1', instanceId: 'i1', nodeId: 'n1', assigneeType: 'person', assigneeId: 'u1', assigneeRoleId: null, claimedBy: null, status: TaskStatus.Pending };
    repos.task.findOneBy.mockResolvedValue(task);
    repos.instance.findOneBy.mockResolvedValue(instance);
    await engine.handleTask('t1', 'u1', 'approve', '同意');
    expect(repos.task.save).toHaveBeenCalledWith(expect.objectContaining({ id: 't1', status: TaskStatus.Approved }));
    expect(repos.instance.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'i1', status: InstanceStatus.Approved }));
    expect(repos.documents.update).toHaveBeenCalled();
  });

  it('countersign requires all approvals before advancing', async () => {
    const { engine, repos } = makeEngine();
    const instance = makeInstance({
      snapshot: {
        version: 1,
        nodes: [
          { id: 'n1', name: '会签', type: 'approval', approverRule: 'role', approverValue: 'r1', approvalMethod: ApprovalMethod.Countersign },
          { id: 'n2', name: '结束', type: 'end' }
        ],
        edges: [{ id: 'e1', fromNodeId: 'n1', toNodeId: 'n2' }]
      }
    });
    repos.instance.findOneBy.mockResolvedValue(instance);
    (repos.dataSource.query as jest.Mock).mockResolvedValue([{ c: 1 }]);
    const task1 = { id: 't1', instanceId: 'i1', nodeId: 'n1', assigneeType: 'role', assigneeRoleId: 'r1', claimedBy: null, status: TaskStatus.Pending };
    repos.task.findOneBy.mockResolvedValue(task1);
    (repos.task.findBy as jest.Mock).mockResolvedValue([{ id: 't2' }]);
    await engine.handleTask('t1', 'u1', 'approve', '同意');
    expect(repos.instance.save).not.toHaveBeenCalledWith(expect.objectContaining({ status: InstanceStatus.Approved }));

    const task2 = { id: 't2', instanceId: 'i1', nodeId: 'n1', assigneeType: 'role', assigneeRoleId: 'r1', claimedBy: null, status: TaskStatus.Pending };
    repos.task.findOneBy.mockResolvedValue(task2);
    (repos.task.findBy as jest.Mock).mockResolvedValue([]);
    await engine.handleTask('t2', 'u1', 'approve', '同意');
    expect(repos.instance.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'i1', status: InstanceStatus.Approved }));
  });

  it('reject voids sibling tasks and rejects instance', async () => {
    const { engine, repos } = makeEngine();
    const instance = makeInstance({
      snapshot: {
        version: 1,
        nodes: [
          { id: 'n1', name: '会签', type: 'approval', approverRule: 'person', approverValue: 'u1', approvalMethod: ApprovalMethod.Countersign },
          { id: 'n2', name: '结束', type: 'end' }
        ],
        edges: [{ id: 'e1', fromNodeId: 'n1', toNodeId: 'n2' }]
      }
    });
    repos.instance.findOneBy.mockResolvedValue(instance);
    const task = { id: 't1', instanceId: 'i1', nodeId: 'n1', assigneeType: 'person', assigneeId: 'u1', claimedBy: null, status: TaskStatus.Pending };
    repos.task.findOneBy.mockResolvedValue(task);
    await engine.handleTask('t1', 'u1', 'reject', '不同意');
    expect(repos.task.update).toHaveBeenCalled();
    expect(repos.instance.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'i1', status: InstanceStatus.Rejected }));
  });

  it('blocks non-assignee person task', async () => {
    const { engine, repos } = makeEngine();
    const task = { id: 't1', instanceId: 'i1', nodeId: 'n1', assigneeType: 'person', assigneeId: 'u1', claimedBy: null, status: TaskStatus.Pending };
    repos.task.findOneBy.mockResolvedValue(task);
    repos.instance.findOneBy.mockResolvedValue(makeInstance());
    await expect(engine.handleTask('t1', 'u2', 'approve')).rejects.toThrow('无权处理该任务');
  });
});