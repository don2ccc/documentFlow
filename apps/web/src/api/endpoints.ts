import { api } from './client';

export interface Paged<T> { items: T[]; total: number; page: number; pageSize: number }
export interface DocumentListItem {
  id: string; title: string; description: string | null; categoryId: string | null; amount: string | null;
  status: string; ownerId: string; createdAt: string;
  latestVersion: { id: string; versionNo: number; fileName: string; size: number; mimeType: string } | null;
}
export interface DocumentVersion { id: string; versionNo: number; fileName: string; size: number; mimeType: string; reason: string | null; createdAt: string }
export interface DocumentDetail extends DocumentListItem {
  versions: DocumentVersion[];
  progress: { instanceId: string; status: string; nodes: Array<{ nodeId: string; name: string; status: string; approvers: Array<{ actorId: string; action: string; comment: string | null; time: string }> }> } | null;
  currentInstanceId: string | null;
}
export interface WorkflowItem { id: string; name: string; description: string | null; status: string; version: number; nodeCount: number }
export interface CategoryItem { id: string; name: string; sortOrder: number }
export interface LoginResult {
  accessToken: string;
  user: { id: string; username: string; name: string; departmentId: string | null; roles: string[] };
}

export const authApi = {
  login: (username: string, password: string) =>
    api.post<LoginResult>('/auth/login', { username, password }).then((r) => r.data)
};

export const documentsApi = {
  list: (params: Record<string, unknown>) =>
    api.get<Paged<DocumentListItem>>('/documents', { params }).then((r) => r.data),
  get: (id: string) => api.get<DocumentDetail>(`/documents/${id}`).then((r) => r.data),
  upload: (formData: FormData) => api.post<DocumentListItem>('/documents', formData).then((r) => r.data),
  submit: (id: string, workflowId: string, chosenApproverIds?: Record<string, string>) =>
    api.post(`/documents/${id}/submit`, { workflowId, chosenApproverIds }).then((r) => r.data),
  withdraw: (id: string) => api.post(`/documents/${id}/withdraw`).then((r) => r.data),
  remind: (id: string) => api.post(`/documents/${id}/remind`).then((r) => r.data),
  addVersion: (id: string, formData: FormData) => api.post(`/documents/${id}/versions`, formData).then((r) => r.data)
};

export const workflowsApi = {
  list: (params: Record<string, unknown> = {}) => api.get<WorkflowItem[]>('/workflows', { params }).then((r) => r.data)
};

export const categoriesApi = {
  list: () => api.get<CategoryItem[]>('/categories').then((r) => r.data)
};

export interface TodoItem { taskId: string; documentId: string; title: string; nodeName: string; priority: 'high' | 'normal' | 'low'; dueAt: string | null; submittedByName: string; documentStatus: string }
export interface TaskDetail {
  taskId: string; taskStatus: string; documentId: string;
  document: { id: string; title: string; description: string | null; amount: string | null; status: string } | null;
  nodeName: string; canApprove: boolean; instanceStatus: string;
  progress: { instanceId: string; status: string; nodes: Array<{ nodeId: string; name: string; status: string; approvers: Array<{ actorId: string; action: string; comment: string | null; time: string }> }> }
}

export const approvalsApi = {
  todos: (params: Record<string, unknown> = {}) => api.get<Paged<TodoItem>>('/approvals/todos', { params }).then((r) => r.data),
  taskDetail: (taskId: string) => api.get<TaskDetail>(`/approvals/tasks/${taskId}`).then((r) => r.data),
  approve: (taskId: string, comment?: string) => api.post(`/approvals/tasks/${taskId}/approve`, { comment }).then((r) => r.data),
  reject: (taskId: string, comment: string) => api.post(`/approvals/tasks/${taskId}/reject`, { comment }).then((r) => r.data),
  transfer: (taskId: string, toUserId: string, comment?: string) => api.post(`/approvals/tasks/${taskId}/transfer`, { toUserId, comment }).then((r) => r.data)
};

export const usersApi = {
  list: (params: Record<string, unknown> = {}) => api.get<Paged<{ id: string; username: string; name: string; roles: string[] }>>('/users', { params }).then((r) => r.data)
};

export const dashboardApi = {
  summary: () =>
    api
      .get<{ todoCount: number; myPending: number; myApproved: number; myRejected: number; recentInstances: Array<{ id: string; title: string; status: string; createdAt: string }> }>('/dashboard/summary')
      .then((r) => r.data)
};