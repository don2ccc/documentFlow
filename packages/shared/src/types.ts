export interface WorkflowNodeDto {
  id: string; name: string; type: string;
  approverRule?: string; approverValue?: string; // roleId / userId / 'initiator' / 'supervisor'
  approvalMethod?: string; timeoutHours?: number; timeoutAction?: string;
  config?: Record<string, unknown>;
}
export interface WorkflowEdgeDto {
  id: string; fromNodeId: string; toNodeId: string;
  conditionExpr?: { field: 'amount' | 'categoryId'; op: '>=' | '<=' | '==' | '>'; value: number | string } | null;
}
export interface WorkflowSnapshot { nodes: WorkflowNodeDto[]; edges: WorkflowEdgeDto[]; version: number }
export interface UserBriefDto { id: string; username: string; name: string; departmentId?: string | null; roles: string[] }
export interface Paged<T> { items: T[]; total: number; page: number; pageSize: number }
export interface AuthUser { id: string; username: string; roles: string[]; permissions: string[]; roleIds?: string[] }