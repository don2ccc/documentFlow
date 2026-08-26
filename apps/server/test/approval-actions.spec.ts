import { ApprovalEngineService } from '../src/modules/approvals/approval-engine.service';
import { InstanceStatus, RecordAction, TaskStatus } from '@document-flow/shared';

function makeInstance(over: Partial<Record<string, any>> = {}) {
  return {
    id: 'i1', status: InstanceStatus.Running, documentId: 'd1', initiatorId: 'u0', currentNodeId: 'n1',
    snapshot: {
      version: 1,
      nodes: [
        { id: 'n1', name: '审批', type: 'approval', approverRule: 'person', approverValue: 'u1', approvalMethod: 'orsign' },
        { id: 'n2', name: '结束', type: 'end' }
      ],
      edges: [{ id: 'e1', fromNodeId: 'n1', toNodeId: 'n2' }]
    },
    ...over
  };
}

function makeEngine(overrides: Partial<Record<string, any>> = {}) {
  const repos = {
    instance: { save: jest.fn((x: any) => Promise.resolve(x)), findOneBy: jest.fn() },
    task: {
      save: jest.fn((x: any) => Promise.resolve(x)), findOneBy: jest.fn(), findBy: jest.fn(async () => []),
      update: jest.fn(), create: jest.fn((x: any) => x)
    },
    record: { save: jest.fn((x: any) => Promise.resolve(x)), find: jest.fn(async () => []), create: jest.fn((x: any) => x) },
    notification: { save: jest.fn((x: any) => Promise.resolve(x)), create: jest.fn((x: any) => x) },
    documents: { findOneBy: jest.fn(async () => ({ id: 'd1', amount: '100', categoryId: null })), update: jest.fn() },
    workflows: { getById: jest.fn() },
    dataSource: { query: jest.fn(async () => []) },
    ...overrides
  };
  return {
    engine: new ApprovalEngineService(
      repos.instance as any, repos.task as any, repos.record as any, repos.notification as any,
      repos.documents as any, repos.workflows as any, repos.dataSource as any
    ),
    repos
  };
}

describe('Approval actions', () => {
  it('withdraw is rejected after a task was processed', async () => {
    const { engine, repos } = makeEngine();
    repos.instance.findOneBy.mockResolvedValue(makeInstance());
    (repos.record.find as jest.Mock).mockResolvedValue([{ id: 'r1', action: RecordAction.Approve }]);
    await expect(engine.withdraw('i1', 'u0')).rejects.toThrow('已有节点被处理，无法撤回');
  });

  it('withdraw succeeds when nothing processed', async () => {
    const { engine, repos } = makeEngine();
    repos.instance.findOneBy.mockResolvedValue(makeInstance());
    (repos.record.find as jest.Mock).mockResolvedValue([]);
    await engine.withdraw('i1', 'u0');
    expect(repos.instance.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'i1', status: InstanceStatus.Withdrawn }));
    expect(repos.documents.update).toHaveBeenCalledWith({ id: 'd1' }, expect.objectContaining({ status: 'draft' }));
  });

  it('transfer reassigns the task and records action', async () => {
    const { engine, repos } = makeEngine();
    repos.task.findOneBy.mockResolvedValue({ id: 't1', instanceId: 'i1', nodeId: 'n1', assigneeType: 'person', assigneeId: 'u1', claimedBy: null, status: TaskStatus.Pending });
    repos.instance.findOneBy.mockResolvedValue(makeInstance());
    await engine.transfer('t1', 'u1', 'u2', '转给李四');
    expect(repos.task.save).toHaveBeenCalledWith(expect.objectContaining({ id: 't1', status: TaskStatus.Transferred }));
    expect(repos.task.create).toHaveBeenCalledWith(expect.objectContaining({ assigneeId: 'u2', status: TaskStatus.Pending }));
    expect(repos.record.save).toHaveBeenCalledWith(expect.objectContaining({ action: RecordAction.Transfer, actorId: 'u1' }));
  });

  it('remind notifies current assignee and records', async () => {
    const { engine, repos } = makeEngine();
    repos.instance.findOneBy.mockResolvedValue(makeInstance());
    (repos.task.findBy as jest.Mock).mockResolvedValue([{ id: 't1', assigneeId: 'u1', assigneeRoleId: null }]);
    await engine.remind('i1', 'u0');
    expect(repos.notification.save).toHaveBeenCalled();
    expect(repos.record.save).toHaveBeenCalledWith(expect.objectContaining({ action: RecordAction.Remind, actorId: 'u0' }));
  });
});