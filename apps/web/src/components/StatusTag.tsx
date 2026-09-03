import { Tag } from 'antd';

// 文档/审批状态
const DOC_MAP: Record<string, { color: string; label: string }> = {
  draft: { color: 'default', label: '草稿' },
  in_approval: { color: 'processing', label: '审批中' },
  rejected: { color: 'error', label: '已驳回' },
  archived: { color: 'success', label: '已通过' }
};

// 用户状态
const USER_MAP: Record<string, { color: string; label: string }> = {
  active: { color: 'success', label: '正常' },
  disabled: { color: 'default', label: '已停用' },
  pending: { color: 'warning', label: '待激活' }
};

export function StatusTag({ status }: { status: string }) {
  const item = DOC_MAP[status] ?? USER_MAP[status] ?? { color: 'default', label: status };
  return <Tag color={item.color}>{item.label}</Tag>;
}