import { Tag } from 'antd';

const MAP: Record<string, { color: string; label: string }> = {
  draft: { color: 'default', label: '草稿' },
  in_approval: { color: 'processing', label: '审批中' },
  rejected: { color: 'error', label: '已驳回' },
  archived: { color: 'success', label: '已通过' }
};

export function StatusTag({ status }: { status: string }) {
  const item = MAP[status] ?? { color: 'default', label: status };
  return <Tag color={item.color}>{item.label}</Tag>;
}