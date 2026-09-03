import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { NodeType, WorkflowStatus } from '@document-flow/shared';
import { SaveWorkflowDto, WorkflowEdgeDto, WorkflowNodeDto } from './dto/save-workflow.dto';
import { WorkflowEdge } from './entities/workflow-edge.entity';
import { WorkflowNode } from './entities/workflow-node.entity';
import { Workflow } from './entities/workflow.entity';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class WorkflowsService {
  constructor(
    @InjectRepository(Workflow) private readonly workflowRepo: Repository<Workflow>,
    @InjectRepository(WorkflowNode) private readonly nodeRepo: Repository<WorkflowNode>,
    @InjectRepository(WorkflowEdge) private readonly edgeRepo: Repository<WorkflowEdge>,
    private readonly audit: AuditService
  ) {}

  async findAll(query: { status?: string; keyword?: string }) {
    const qb = this.workflowRepo.createQueryBuilder('w');
    if (query.status) qb.andWhere('w.status = :status', { status: query.status });
    if (query.keyword) qb.andWhere('w.name ILIKE :k', { k: `%${query.keyword}%` });
    const items = await qb.orderBy('w.updatedAt', 'DESC').getMany();
    const withCounts = await Promise.all(
      items.map(async (w) => ({ ...w, nodeCount: await this.nodeRepo.countBy({ workflowId: w.id }) }))
    );
    return withCounts;
  }

  async create(dto: { name: string; description?: string }) {
    const wf = await this.workflowRepo.save(
      this.workflowRepo.create({ name: dto.name, description: dto.description ?? null, status: WorkflowStatus.Draft })
    );
    const s = `n_start_${randomUUID().slice(0, 8)}`;
    const a = `n_approval_${randomUUID().slice(0, 8)}`;
    const e = `n_end_${randomUUID().slice(0, 8)}`;
    await this.nodeRepo.save([
      this.nodeRepo.create({ id: s, workflowId: wf.id, name: '开始', type: NodeType.Start, sortOrder: 0 }),
      this.nodeRepo.create({
        id: a, workflowId: wf.id, name: '审批', type: NodeType.Approval,
        approverRule: 'role', approverValue: null, approvalMethod: 'orsign', sortOrder: 1
      }),
      this.nodeRepo.create({ id: e, workflowId: wf.id, name: '结束', type: NodeType.End, sortOrder: 2 })
    ]);
    await this.edgeRepo.save([
      this.edgeRepo.create({ id: `e_${randomUUID().slice(0, 8)}`, workflowId: wf.id, fromNodeId: s, toNodeId: a }),
      this.edgeRepo.create({ id: `e_${randomUUID().slice(0, 8)}`, workflowId: wf.id, fromNodeId: a, toNodeId: e })
    ]);
    await this.audit.log('system', 'workflow:create', 'workflow', wf.id, { name: dto.name });
    return this.getById(wf.id);
  }

  async getById(id: string) {
    const wf = await this.workflowRepo.findOneBy({ id });
    if (!wf) throw new NotFoundException('流程不存在');
    const nodes = await this.nodeRepo.find({ where: { workflowId: id }, order: { sortOrder: 'ASC' } });
    const edges = await this.edgeRepo.find({ where: { workflowId: id } });
    return { ...wf, nodes, edges };
  }

  async saveNodes(id: string, dto: SaveWorkflowDto) {
    const wf = await this.workflowRepo.findOneBy({ id });
    if (!wf) throw new NotFoundException('流程不存在');
    // Auto-generate linear edges from node order; ignore any provided edges
    const edges = dto.nodes.length > 1
      ? dto.nodes.slice(0, -1).map((n, i) => ({ id: `e_${id.slice(0, 8)}_${i}`, fromNodeId: n.id, toNodeId: dto.nodes[i + 1].id }))
      : [];
    this.validateGraph(dto.nodes, edges);
    await this.nodeRepo.delete({ workflowId: id });
    await this.edgeRepo.delete({ workflowId: id });
    const nodes = dto.nodes.map((n, i) =>
      this.nodeRepo.create({
        id: n.id, workflowId: id, name: n.name, type: n.type,
        approverRule: n.approverRule ?? 'person', approverValue: n.approverValue ?? null,
        approvalMethod: n.approvalMethod ?? 'orsign', timeoutDays: n.timeoutDays ?? 15,
        timeoutAction: n.timeoutAction ?? null, config: n.config ?? null, sortOrder: i
      })
    );
    const edgeEntities = edges.map((e) =>
      this.edgeRepo.create({
        id: e.id, workflowId: id, fromNodeId: e.fromNodeId, toNodeId: e.toNodeId,
        conditionExpr: null
      })
    );
    await this.nodeRepo.save(nodes);
    await this.edgeRepo.save(edgeEntities);
    await this.audit.log('system', 'workflow:save-nodes', 'workflow', id, { version: wf.version + 1 });
    wf.version += 1;
    wf.updatedAt = new Date();
    await this.workflowRepo.save(wf);
    return this.getById(id);
  }

  async setStatus(id: string, status: WorkflowStatus) {
    const wf = await this.workflowRepo.findOneBy({ id });
    if (!wf) throw new NotFoundException('流程不存在');
    if (status === WorkflowStatus.Active) {
      const existing = await this.nodeRepo.find({ where: { workflowId: id } });
      const starts = existing.filter((n) => n.type === NodeType.Start).length;
      const ends = existing.filter((n) => n.type === NodeType.End).length;
      if (starts !== 1 || ends !== 1) throw new BadRequestException('启用前必须包含且仅包含一个开始与一个结束节点');
      const nodes = await this.nodeRepo.find({ where: { workflowId: id } });
      const edges = await this.edgeRepo.find({ where: { workflowId: id } });
      this.validateGraph(
        nodes.map((n) => ({ id: n.id, name: n.name, type: n.type, approverRule: n.approverRule ?? undefined, approverValue: n.approverValue ?? undefined, approvalMethod: n.approvalMethod ?? undefined })),
        edges.map((e) => ({ id: e.id, fromNodeId: e.fromNodeId, toNodeId: e.toNodeId, conditionExpr: e.conditionExpr }))
      );
    }
    await this.audit.log('system', 'workflow:set-status', 'workflow', id, { status });
    wf.status = status;
    wf.updatedAt = new Date();
    return this.workflowRepo.save(wf);
  }

  validateGraph(nodes: WorkflowNodeDto[], edges: WorkflowEdgeDto[]): void {
    const starts = nodes.filter((n) => n.type === NodeType.Start);
    const ends = nodes.filter((n) => n.type === NodeType.End);
    if (starts.length !== 1) throw new BadRequestException('必须包含且仅包含一个开始节点');
    if (ends.length !== 1) throw new BadRequestException('必须包含且仅包含一个结束节点');
    const ids = new Set(nodes.map((n) => n.id));
    for (const e of edges) {
      if (!ids.has(e.fromNodeId) || !ids.has(e.toNodeId)) throw new BadRequestException('连线指向不存在的节点');
    }
    const start = starts[0];
    if (edges.some((e) => e.toNodeId === start.id)) throw new BadRequestException('开始节点不能有入边');
    if (edges.some((e) => e.fromNodeId === ends[0].id)) throw new BadRequestException('结束节点不能有出边');
    for (const n of nodes) {
      if (n.type === NodeType.Approval || n.type === NodeType.Handle) {
        if (!n.approverValue) throw new BadRequestException(`节点「${n.name}」缺少审批人`);
      }
      if (n.type !== NodeType.End) {
        const outgoing = edges.filter((e) => e.fromNodeId === n.id);
        if (outgoing.length === 0) throw new BadRequestException(`节点「${n.name}」缺少出口连线`);
        if (outgoing.length > 1) throw new BadRequestException(`节点「${n.name}」只能有一条出口连线（按顺序审批）`);
      }
    }
    const reachable = new Set<string>([start.id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const e of edges) {
        if (reachable.has(e.fromNodeId) && !reachable.has(e.toNodeId)) {
          reachable.add(e.toNodeId);
          changed = true;
        }
      }
    }
    if (reachable.size !== ids.size) throw new BadRequestException('存在不可达节点');
  }
}