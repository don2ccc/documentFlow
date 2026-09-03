import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('workflow_edges')
export class WorkflowEdge {
  @PrimaryColumn() id!: string;
  @Column({ type: 'uuid' }) workflowId!: string;
  @Column() fromNodeId!: string;
  @Column() toNodeId!: string;
  @Column({ type: 'jsonb', nullable: true }) conditionExpr!: { field: string; op: string; value: number | string } | null;
}