import { Steps, Empty } from 'antd';

export function ApprovalTimeline({ progress }: { progress: any }) {
  if (!progress) return <Empty description="暂无审批进度" />;
  const items = progress.nodes.map((n: any) => ({
    title: n.name,
    status: n.status === 'current' ? ('process' as const) : n.status === 'done' ? ('finish' as const) : ('wait' as const),
    description:
      n.approvers.length > 0
        ? n.approvers.map((a: any) => `${a.action === 'approve' ? '同意' : '驳回'}：${a.comment ?? '无意见'}`).join('；')
        : undefined
  }));
  return <Steps items={items} direction="vertical" />;
}