import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('workflow_nodes')
export class WorkflowNode {
  @PrimaryColumn() id!: string;
  @Column({ type: 'uuid' }) workflowId!: string;
  @Column() name!: string;
  @Column({ type: 'varchar' }) type!: string;
  @Column({ type: 'varchar', nullable: true }) approverRule!: string | null;
  @Column({ type: 'varchar', nullable: true }) approverValue!: string | null;
  @Column({ type: 'varchar', nullable: true }) approvalMethod!: string | null;
  @Column({ type: 'int', nullable: true }) timeoutHours!: number | null;
  @Column({ type: 'varchar', nullable: true }) timeoutAction!: string | null;
  @Column({ type: 'jsonb', nullable: true }) config!: Record<string, unknown> | null;
  @Column({ type: 'int', default: 0 }) sortOrder!: number;
}