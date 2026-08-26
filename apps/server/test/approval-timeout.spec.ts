import { ApprovalTimeoutWorker } from '../src/modules/approvals/approval-timeout.worker';

describe('ApprovalTimeoutWorker', () => {
  it('auto-approves overdue task when timeoutAction=auto_approve', async () => {
    const handleTask = jest.fn(async () => undefined);
    const worker = new ApprovalTimeoutWorker(
      { find: jest.fn(async () => [{ id: 't1', instanceId: 'i1', nodeId: 'n1' }]) } as any,
      { findOneBy: jest.fn(async () => ({ id: 'i1', status: 'running', snapshot: { nodes: [{ id: 'n1', name: '审批', timeoutAction: 'auto_approve' }] } })) } as any,
      { handleTask } as any,
      { save: jest.fn(async (x: any) => x) } as any
    );
    await worker.runOnce();
    expect(handleTask).toHaveBeenCalledWith('t1', 'system', 'approve', expect.any(String));
  });
});