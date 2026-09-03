import { WorkflowsService } from '../src/modules/workflows/workflows.service';

describe('WorkflowsService.validateGraph', () => {
  const service = new WorkflowsService({} as any, {} as any, {} as any, {} as any);

  it('rejects graph without exactly one start and one end', () => {
    expect(() => service.validateGraph([{ id: 'n1', name: 'x', type: 'approval' }], [])).toThrow('必须包含且仅包含一个开始节点');
    expect(() => service.validateGraph(
      [
        { id: 's', name: '开始', type: 'start' },
        { id: 'e', name: '结束', type: 'end' },
        { id: 's2', name: '开始2', type: 'start' }
      ],
      []
    )).toThrow('必须包含且仅包含一个开始节点');
  });

  it('rejects edge pointing to unknown node', () => {
    expect(() => service.validateGraph(
      [
        { id: 's', name: '开始', type: 'start' },
        { id: 'a', name: '审批', type: 'approval', approverRule: 'role', approverValue: 'r1', approvalMethod: 'orsign' },
        { id: 'e', name: '结束', type: 'end' }
      ],
      [{ id: 'x', fromNodeId: 's', toNodeId: 'missing' }]
    )).toThrow('连线指向不存在的节点');
  });

  it('accepts a valid linear graph', () => {
    expect(() => service.validateGraph(
      [
        { id: 's', name: '开始', type: 'start' },
        { id: 'a', name: '审批', type: 'approval', approverRule: 'role', approverValue: 'r1', approvalMethod: 'orsign' },
        { id: 'e', name: '结束', type: 'end' }
      ],
      [
        { id: 'e1', fromNodeId: 's', toNodeId: 'a' },
        { id: 'e2', fromNodeId: 'a', toNodeId: 'e' }
      ]
    )).not.toThrow();
  });

  it('rejects unreachable node', () => {
    expect(() => service.validateGraph(
      [
        { id: 's', name: '开始', type: 'start' },
        { id: 'a', name: '审批', type: 'approval', approverRule: 'role', approverValue: 'r1', approvalMethod: 'orsign' },
        { id: 'e', name: '结束', type: 'end' },
        { id: 'orphan', name: '孤立', type: 'approval', approverRule: 'role', approverValue: 'r1', approvalMethod: 'orsign' }
      ],
      [
        { id: 'e1', fromNodeId: 's', toNodeId: 'a' },
        { id: 'e2', fromNodeId: 'a', toNodeId: 'e' }
      ]
    )).toThrow('存在不可达节点');
  });
});