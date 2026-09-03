import { Steps, Empty, Space, Tag } from 'antd';
import { UserOutlined } from '@ant-design/icons';

type Reviewer = { userId: string; name: string };

export function ApprovalTimeline({ progress }: { progress: any }) {
  if (!progress) return <Empty description="暂无审批进度" />;
  const currentReviewer: Reviewer[] = Array.isArray(progress.currentReviewer) ? progress.currentReviewer : [];
  const isRunning = progress.status === 'running';
  const items = progress.nodes.map((n: any) => {
    const reviewerNames = n.approvers
      .map((a: any) => a.name || a.actorId)
      .filter(Boolean);
    const actionText = n.approvers
      .filter((a: any) => a.action)
      .map((a: any) => `${a.action === 'approve' ? '同意' : '驳回'}：${a.comment ?? '无意见'}`)
      .join('；');
    return {
      title: reviewerNames.length > 0 ? reviewerNames.join('、') : n.name,
      status: n.status === 'current' ? ('process' as const) : n.status === 'done' ? ('finish' as const) : ('wait' as const),
      description: actionText || undefined
    };
  });
  return (
    <div>
      {isRunning && (
        <div style={{ marginBottom: 12, padding: '8px 12px', background: '#f0f5ff', border: '1px solid #adc6ff', borderRadius: 6 }}>
          <Space size={8} wrap>
            <span style={{ color: '#1d39c4', fontWeight: 500 }}>当前审核人：</span>
            {currentReviewer.length > 0 ? (
              currentReviewer.map((r) => (
                <Tag key={r.userId} color="processing" icon={<UserOutlined />}>{r.name}</Tag>
              ))
            ) : (
              <Tag>暂无（系统/抄送节点）</Tag>
            )}
          </Space>
        </div>
      )}
      <Steps items={items} direction="vertical" />
    </div>
  );
}