import { api } from './client';

export interface Paged<T> { items: T[]; total: number; page: number; pageSize: number }
export interface DocumentListItem {
  id: string; title: string; description: string | null; categoryId: string | null; amount: string | null;
  status: string; ownerId: string; ownerName: string | null; createdAt: string;
  currentInstanceId: string | null;
  currentReviewer: Array<{ userId: string; name: string }> | null;
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
  mustChangePassword: boolean;
}

export const authApi = {
  login: (username: string, password: string) =>
    api.post<LoginResult>('/auth/login', { username, password }).then((r) => r.data),
  changePassword: (newPassword: string) =>
    api.post<{ ok: boolean }>('/auth/change-password', { newPassword }).then((r) => r.data),
  // 找回密码：发送验证码
  forgotPasswordSend: (email: string) =>
    api.post<{ ok: boolean }>('/auth/forgot-password', { email }).then((r) => r.data),
  // 找回密码：验证码 + 新密码
  resetPassword: (email: string, code: string, newPassword: string) =>
    api.post<{ ok: boolean }>('/auth/reset-password', { email, code, newPassword }).then((r) => r.data),
  // 新用户注册（公开）
  register: (data: { username: string; password: string; name: string; email: string; employeeNo?: string; directSupervisor?: string; workshopId?: string; position?: string }) =>
    api.post<{ ok: boolean }>('/auth/register', data).then((r) => r.data)
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
  addVersion: (id: string, formData: FormData) => api.post(`/documents/${id}/versions`, formData).then((r) => r.data),
  remove: (id: string) => api.delete(`/documents/${id}`).then((r) => r.data)
};

export const workflowsApi = {
  list: (params: Record<string, unknown> = {}) => api.get<WorkflowItem[]>('/workflows', { params }).then((r) => r.data),
  get: (id: string) => api.get<WorkflowItem & { nodes: any[]; edges: any[] }>(`/workflows/${id}`).then((r) => r.data),
  create: (data: { name: string; description?: string }) => api.post('/workflows', data).then((r) => r.data),
  saveNodes: (id: string, data: { nodes: any[]; edges?: any[] }) => api.put(`/workflows/${id}/nodes`, data).then((r) => r.data),
  activate: (id: string) => api.post(`/workflows/${id}/activate`).then((r) => r.data),
  deactivate: (id: string) => api.post(`/workflows/${id}/deactivate`).then((r) => r.data)
};

export const categoriesApi = {
  list: () => api.get<CategoryItem[]>('/categories').then((r) => r.data),
  create: (data: { name: string; sortOrder?: number }) => api.post('/categories', data).then((r) => r.data),
  update: (id: string, data: { name: string; sortOrder?: number }) => api.patch(`/categories/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/categories/${id}`).then((r) => r.data)
};

export interface TodoItem { taskId: string; documentId: string; title: string; nodeName: string; priority: 'high' | 'normal' | 'low'; dueAt: string | null; submittedByName: string; documentStatus: string }
export interface TaskDetail {
  taskId: string; taskStatus: string; documentId: string;
  document: { id: string; title: string; description: string | null; amount: string | null; status: string; ownerName: string; fileCount: number; createdAt: string; updatedAt: string } | null;
  nodeName: string; canApprove: boolean; instanceStatus: string;
  progress: { instanceId: string; status: string; nodes: Array<{ nodeId: string; name: string; status: string; approvers: Array<{ actorId: string; action: string; comment: string | null; time: string }> }> }
}

export interface ApprovalTaskAccess { taskId: string | null; canApprove: boolean; canTransfer: boolean; };

export const approvalsApi = {
  todos: (params: Record<string, unknown> = {}) => api.get<Paged<TodoItem>>('/approvals/todos', { params }).then((r) => r.data),
  taskForDocument: (documentId: string) =>
    api.get<ApprovalTaskAccess>(`/approvals/tasks/by-document/${documentId}`).then((r) => r.data),
  taskDetail: (taskId: string) => api.get<TaskDetail>(`/approvals/tasks/${taskId}`).then((r) => r.data),
  approve: (taskId: string, comment?: string) => api.post(`/approvals/tasks/${taskId}/approve`, { comment }).then((r) => r.data),
  reject: (taskId: string, comment: string) => api.post(`/approvals/tasks/${taskId}/reject`, { comment }).then((r) => r.data),
  transfer: (taskId: string, toUserId: string, comment?: string) => api.post(`/approvals/tasks/${taskId}/transfer`, { toUserId, comment }).then((r) => r.data)
};


export interface RoleItem { id: string; name: string; code: string; description: string | null; permissions: Array<{ id: string; name: string; code: string }> }
export interface PermissionItem { id: string; name: string; code: string }
export interface DepartmentNode { id: string; name: string; managerId: string | null; children: DepartmentNode[] }
export interface AuditLogItem { id: string; actorId: string; action: string; targetType: string; targetId: string | null; detail: Record<string, unknown> | null; ip: string | null; createdAt: string }
export interface UserItem { id: string; username: string; name: string; departmentId: string | null; roles: string[]; roleIds?: string[]; email?: string | null; directSupervisor?: string | null; workshopId?: string | null; position?: string | null; employeeNo?: string | null; status?: string }

export const rolesApi = {
  list: () => api.get<RoleItem[]>('/roles').then((r) => r.data),
  permissions: () => api.get<PermissionItem[]>('/permissions').then((r) => r.data),
  create: (data: { name: string; code: string; description?: string; permissionCodes?: string[] }) => api.post('/roles', data).then((r) => r.data),
  update: (id: string, data: { name?: string; description?: string; permissionCodes?: string[] }) => api.patch(`/roles/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/roles/${id}`).then((r) => r.data)
};

export interface DepartmentFlatItem {
  id: string;
  name: string;
  parentId: string | null;
  managerId: string | null;
  createdAt: string;
}

export const departmentsApi = {
  tree: () => api.get<DepartmentNode[]>('/departments/tree').then((r) => r.data),
  list: () => api.get<DepartmentFlatItem[]>('/departments').then((r) => r.data),
  create: (data: { name: string; parentId?: string | null; managerId?: string | null }) =>
    api.post('/departments', data).then((r) => r.data),
  update: (id: string, data: { name?: string; parentId?: string | null; managerId?: string | null }) =>
    api.patch(`/departments/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/departments/${id}`).then((r) => r.data)
};
export interface WorkshopFlatItem {
  id: string;
  name: string;
  parentId: string | null;
  managerId: string | null;
  departmentId: string | null;
  createdAt: string;
}

export const workshopsApi = {
  tree: () => api.get<DepartmentNode[]>('/workshops/tree').then((r) => r.data),
  list: () => api.get<WorkshopFlatItem[]>('/workshops').then((r) => r.data),
  create: (data: { name: string; parentId?: string | null; managerId?: string | null; departmentId?: string | null }) =>
    api.post('/workshops', data).then((r) => r.data),
  update: (id: string, data: { name?: string; parentId?: string | null; managerId?: string | null; departmentId?: string | null }) =>
    api.patch(`/workshops/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/workshops/${id}`).then((r) => r.data)
};



export const usersApi = {
  list: (params: Record<string, unknown> = {}) => api.get<Paged<UserItem>>('/users', { params }).then((r) => r.data),
  create: (data: Record<string, unknown>) => api.post('/users', data).then((r) => r.data),
  updateStatus: (id: string, status: string) => api.patch(`/users/${id}/status`, { status }).then((r) => r.data),
  resetPassword: (id: string, newPassword: string) => api.post<{ ok: boolean }>(`/users/${id}/reset-password`, { newPassword }).then((r) => r.data),
  remove: (id: string) => api.delete(`/users/${id}`).then((r) => r.data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/users/${id}`, data).then((r) => r.data),
  // 管理员审批待激活账号（激活 + 生成密码 + 发送邮件）
  approve: (id: string) => api.post<{ user: UserItem; initialPassword: string; emailSent: boolean }>(`/users/${id}/approve`).then((r) => r.data),
  // 当前登录用户自助接口
  getMe: () => api.get<UserItem>('/users/me').then((r) => r.data),
  updateMe: (data: { employeeNo?: string | null; email?: string | null; directSupervisor?: string | null; workshopId?: string | null; position?: string | null; departmentId?: string | null }) =>
    api.put<UserItem>('/users/me', data).then((r) => r.data),
  changeMyPassword: (newPassword: string) =>
    api.post<{ ok: boolean }>('/users/me/change-password', { newPassword }).then((r) => r.data)
};

export const auditApi = {
  list: (params: Record<string, unknown> = {}) => api.get<Paged<AuditLogItem>>('/audit-logs', { params }).then((r) => r.data)
};

export const dashboardApi = {
  summary: () =>
    api
    .get<{ todoCount: number; myPending: number; myApproved: number; myRejected: number; recentInstances: Array<{ id: string; title: string; status: string; createdAt: string }> }>('/dashboard/summary')
    .then((r) => r.data)
};
export interface SystemSettingItem {
  key: string;
  value: string;
  updatedAt: string;
  updatedBy: string | null;
}

export const settingsApi = {
  list: () => api.get<SystemSettingItem[]>('/system-settings').then((r) => r.data),
  set: (key: string, value: string) => api.put<SystemSettingItem>(`/system-settings/${encodeURIComponent(key)}`, { value }).then((r) => r.data),
  remove: (key: string) => api.delete<{ ok: boolean }>(`/system-settings/${encodeURIComponent(key)}`).then((r) => r.data),
  testEmail: (to: string) => api.post<{ ok: boolean; message: string }>('/system-settings/test-email', { to }).then((r) => r.data)
};

export interface ApplicationFileInfo {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  versionNo: number;
  uploadedBy: string;
  createdAt: string;
}
export interface ApplicationListItem {
  id: string;
  title: string;
  status: string;
  ownerId: string;
  ownerName: string | null;
  fileCount: number;
  totalSize: number;
  currentInstanceId: string | null;
  defaultWorkflowId: string | null;
  createdAt: string;
  updatedAt: string;
  currentReviewer: Array<{ userId: string; name: string }> | null;
}
export interface ApplicationQueryItem extends ApplicationListItem {
  categoryId: string | null;
  categoryName: string | null;
  currentNodeName: string | null;
}
export interface ApplicationDetail extends ApplicationListItem {
  description: string | null;
  categoryId: string | null;
  amount: string | null;
  files: ApplicationFileInfo[];
  progress: { instanceId: string; status: string; nodes: Array<{ nodeId: string; name: string; status: string; approvers: Array<{ actorId: string; action: string; comment: string | null; time: string }> }> } | null;
}

export const applicationsApi = {
  query: (params: Record<string, unknown>) =>
    api.get<Paged<ApplicationQueryItem>>('/applications/query', { params }).then((r) => r.data),
  list: (params: Record<string, unknown>) =>
    api.get<Paged<ApplicationListItem>>('/applications', { params }).then((r) => r.data),
  get: (id: string) =>
    api.get<ApplicationDetail>(`/applications/${id}`).then((r) => r.data),
  create: (formData: FormData) =>
    api.post<ApplicationListItem>('/applications', formData).then((r) => r.data),
  submit: (id: string, workflowId: string) =>
    api.post(`/applications/${id}/submit`, { workflowId }).then((r) => r.data),
  withdraw: (id: string) =>
    api.post(`/applications/${id}/withdraw`).then((r) => r.data),
  remind: (id: string) =>
    api.post(`/applications/${id}/remind`).then((r) => r.data),
  remove: (id: string) =>
    api.delete(`/applications/${id}`).then((r) => r.data)
};
export interface DatabaseBackup {
  filename: string;
  size: number;
  createdAt: string;
}

export interface DatabaseInfo {
  host: string;
  port: string;
  database: string;
  user: string;
  backupCount: number;
  backupTotalSize: number;
}

export const databaseApi = {
  info: () => api.get<DatabaseInfo>('/database/info').then((r) => r.data),
  list: () => api.get<DatabaseBackup[]>('/database/backups').then((r) => r.data),
  create: () => api.post<DatabaseBackup & { ok: boolean; createdBy: string | null }>('/database/backups').then((r) => r.data),
  remove: (filename: string) => api.delete<{ ok: boolean }>(`/database/backups/${encodeURIComponent(filename)}`).then((r) => r.data),
  restore: (file: File, onProgress?: (e: { loaded: number; total: number }) => void) => {
    const fd = new FormData();
    fd.append('file', file);
    return api
      .post<{ ok: boolean; message: string }>('/database/restore', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => onProgress?.({ loaded: e.loaded, total: e.total ?? 0 })
      })
      .then((r) => r.data);
  }
};

// ======宿舍管理 =====
export type RoomType = '四人间' | '双人间' | '单人间';
export type BedStatus = '空闲' | '已住' | '维修中' | '禁用';
export type AssetType = '空调' | '床' | '柜子' | '热水器' | '其他';
export type AssetStatus = '正常' | '损坏' | '已报废';
export type ResidentStatus = '在住' | '已退宿';

export interface Building { id: string; name: string; address: string | null; totalFloors: number; notes: string | null; createdAt: string; }
export interface Room { id: string; buildingId: string; buildingName?: string; floor: number; roomNo: string; type: RoomType; totalBeds: number; bedTotal?: number; bedOccupied?: number; notes: string | null; createdAt: string; }
export interface Bed { id: string; roomId: string; roomNo?: string; buildingName?: string; bedNo: string; status: BedStatus; notes: string | null; }
export interface Asset { id: string; roomId: string; roomNo?: string; buildingName?: string; name: string; type: AssetType; brand: string | null; model: string | null; serialNo: string | null; purchaseDate: string | null; status: AssetStatus; damageNote: string | null; createdAt: string; }
export interface Resident { id: string; employeeNo: string; name: string; department: string | null; phone: string | null; hireDate: string | null; bedId: string | null; bedNo: string | null; roomNo: string | null; floor: number | null; buildingName: string | null; roomType: string | null; checkInDate: string; checkOutDate: string | null; checkOutItemsCheck: string | null; checkOutSettlement: string | null; status: ResidentStatus; notes: string | null; createdAt: string; }
export interface DormitoryOverview { buildings: number; rooms: number; beds: number; occupiedBeds: number; residents: number; availableBeds: number; arrears: number; arrearsCount: number; }

export interface MeterReading { id: string; roomId: string; roomNo?: string; buildingName?: string; period: string; electricReading: string; waterReading: string; electricUsage: string; waterUsage: string; publicElectricUsage: string; publicWaterUsage: string; readingDate: string; recordedBy: string | null; notes: string | null; createdAt: string; }

export type BillStatus = '待缴费' | '部分缴费' | '已缴费' | '逾期' | '作废';
export interface Bill { id: string; residentId: string; resident?: { id: string; employeeNo: string; name: string; department: string | null; bedId: string | null } | null; period: string; electricFee: string; waterFee: string; roomFee: string; deposit: string; otherFee: string; totalAmount: string; paidAmount: string; status: BillStatus; dueDate: string; paidAt: string | null; notes: string | null; createdAt: string; arrears?: number; }

export interface BillArrears {
  id: string; residentId: string; period: string;
  electricFee: string; waterFee: string; roomFee: string; deposit: string; otherFee: string;
  totalAmount: string; paidAmount: string; status: BillStatus;
  paidAt: string | null; dueDate: string; notes: string | null; createdAt: string;
  arrears: number;
  resident: { id: string; employeeNo: string; name: string; department: string | null; phone: string | null; bed: { bedNo: string; room: { roomNo: string; floor: number; building: { id: string; name: string } | null } | null } | null } | null;
}

export interface BillStatistics { period: string | null; billCount: number; totalAmount: number; paidAmount: number; arrears: number; paidCount: number; partialCount: number; unpaidCount: number; overdueCount: number; voidCount: number; }

export interface GenerateBillsResult { generated: number; skipped: number; bills: Bill[]; }

export const dormitoryApi = {
  overview: () => api.get<DormitoryOverview>('/dormitory/overview').then((r) => r.data),
  listBuildings: () => api.get<Building[]>('/dormitory/buildings').then((r) => r.data),
  createBuilding: (body: Partial<Building>) => api.post<Building>('/dormitory/buildings', body).then((r) => r.data),
  updateBuilding: (id: string, body: Partial<Building>) => api.patch<Building>(`/dormitory/buildings/${id}`, body).then((r) => r.data),
  removeBuilding: (id: string) => api.delete<{ ok: boolean }>(`/dormitory/buildings/${id}`).then((r) => r.data),
  listRooms: (buildingId?: string) => api.get<Room[]>('/dormitory/rooms', { params: buildingId ? { buildingId } : undefined }).then((r) => r.data),
  createRoom: (body: Partial<Room>) => api.post<Room>('/dormitory/rooms', body).then((r) => r.data),
  updateRoom: (id: string, body: Partial<Room>) => api.patch<Room>(`/dormitory/rooms/${id}`, body).then((r) => r.data),
  removeRoom: (id: string) => api.delete<{ ok: boolean }>(`/dormitory/rooms/${id}`).then((r) => r.data),
  listBeds: (roomId?: string) => api.get<Bed[]>('/dormitory/beds', { params: roomId ? { roomId } : undefined }).then((r) => r.data),
  createBed: (body: Partial<Bed>) => api.post<Bed>('/dormitory/beds', body).then((r) => r.data),
  updateBed: (id: string, body: Partial<Bed>) => api.patch<Bed>(`/dormitory/beds/${id}`, body).then((r) => r.data),
  removeBed: (id: string) => api.delete<{ ok: boolean }>(`/dormitory/beds/${id}`).then((r) => r.data),
  listAssets: (roomId?: string) => api.get<Asset[]>('/dormitory/assets', { params: roomId ? { roomId } : undefined }).then((r) => r.data),
  createAsset: (body: Partial<Asset>) => api.post<Asset>('/dormitory/assets', body).then((r) => r.data),
  updateAsset: (id: string, body: Partial<Asset>) => api.patch<Asset>(`/dormitory/assets/${id}`, body).then((r) => r.data),
  removeAsset: (id: string) => api.delete<{ ok: boolean }>(`/dormitory/assets/${id}`).then((r) => r.data),
  reportDamage: (id: string, note: string) => api.post<Asset>(`/dormitory/assets/${id}/damage`, { note }).then((r) => r.data),
  listResidents: () => api.get<Resident[]>('/dormitory/residents').then((r) => r.data),
  createResident: (body: Partial<Resident>) => api.post<Resident>('/dormitory/residents', body).then((r) => r.data),
  updateResident: (id: string, body: Partial<Resident>) => api.patch<Resident>(`/dormitory/residents/${id}`, body).then((r) => r.data),
  removeResident: (id: string) => api.delete<{ ok: boolean }>(`/dormitory/residents/${id}`).then((r) => r.data),
  // ===== 抄表 =====
  listMeterReadings: (roomId?: string, period?: string) => api.get<MeterReading[]>('/dormitory/meter-readings', { params: { ...(roomId ? { roomId } : {}), ...(period ? { period } : {}) } }).then((r) => r.data),
  recordMeterReading: (body: Partial<MeterReading>) => api.post<MeterReading>('/dormitory/meter-readings', body).then((r) => r.data),
  updateMeterReading: (id: string, body: Partial<MeterReading>) => api.patch<MeterReading>(`/dormitory/meter-readings/${id}`, body).then((r) => r.data),
  removeMeterReading: (id: string) => api.delete<{ ok: boolean }>(`/dormitory/meter-readings/${id}`).then((r) => r.data),
  // ===== 账单 =====
  generateBills: (body: { period: string; electricRate?: number; waterRate?: number; roomRate?: number; dueDate: string; notes?: string }) => api.post<GenerateBillsResult>('/dormitory/bills/generate', body).then((r) => r.data),
  listBills: (params?: { period?: string; residentId?: string; status?: string }) => api.get<Bill[]>('/dormitory/bills', { params: params || {} }).then((r) => r.data),
  billStatistics: (period?: string) => api.get<BillStatistics>('/dormitory/bills/statistics', { params: period ? { period } : {} }).then((r) => r.data),
  arrearsList: () => api.get<BillArrears[]>('/dormitory/bills/arrears').then((r) => r.data),
  markBillPaid: (id: string, paidAmount: number, notes?: string) => api.post<Bill>(`/dormitory/bills/${id}/pay`, { paidAmount, notes }).then((r) => r.data),
  voidBill: (id: string) => api.post<Bill>(`/dormitory/bills/${id}/void`, {}).then((r) => r.data),
  getBill: (id: string) => api.get<Bill>(`/dormitory/bills/${id}`).then((r) => r.data),
  // ===== 一键导出 =====
  exportResidents: () => api.get<Blob>('/dormitory/residents/export.csv', { responseType: 'blob' }).then((r) => r.data),
  exportBills: (params?: { period?: string; status?: string }) => api.get<Blob>('/dormitory/bills/export.csv', { params: params || {}, responseType: 'blob' }).then((r) => r.data)
};

// 浏览器端触发下载 Blob
export function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}


export interface StorageInfo {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  usagePercent: number;
  path: string;
}

export const systemMonitorApi = {
  storage: () => api.get<StorageInfo>(`/system-monitor/storage`).then((r) => r.data)
};
