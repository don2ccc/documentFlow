import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Input, Space, Table, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import { approvalsApi, Paged, TodoItem } from '../api/endpoints';
import { StatusTag } from '../components/StatusTag';

const PRIORITY: Record<string, { color: string; label: string }> = {
  high: { color: 'red', label: '高' },
  normal: { color: 'orange', label: '中' },
  low: { color: 'default', label: '低' }
};

export function ApprovalsPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<Paged<TodoItem>>({ items: [], total: 0, page: 1, pageSize: 20 });
  const [keyword, setKeyword] = useState('');

  const load = useCallback(async (page = 1) => {
    const list = await approvalsApi.todos({ keyword, page, pageSize: 20 });
    setData(list);
  }, [keyword]);

  useEffect(() => {
    load(1);
  }, [load]);

  const columns = [
    { title: '文档标题', dataIndex: 'title', render: (v: string, r: TodoItem) => <a onClick={() => navigate(`/approvals/tasks/${r.taskId}`)}>{v}</a> },
    { title: '当前节点', dataIndex: 'nodeName', width: 140 },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 90,
      render: (v: string) => <Tag color={PRIORITY[v]?.color}>{PRIORITY[v]?.label ?? v}</Tag>
    },
    {
      title: '剩余时间',
      dataIndex: 'dueAt',
      width: 130,
      render: (v: string | null) => {
        if (!v) return '-';
        const ms = new Date(v).getTime() - Date.now();
        if (ms <= 0) return <Tag color="red">已超时</Tag>;
        const h = Math.floor(ms / 3600_000);
        const m = Math.floor((ms % 3600_000) / 60_000);
        return `${h}小时${m}分`;
      }
    },
    { title: '提交人', dataIndex: 'submittedByName', width: 110 },
    { title: '文档状态', dataIndex: 'documentStatus', width: 100, render: (v: string) => <StatusTag status={v} /> },
    {
      title: '操作',
      width: 100,
      render: (_: unknown, r: TodoItem) => (
        <Button size="small" type="link" onClick={() => navigate(`/approvals/tasks/${r.taskId}`)}>处理</Button>
      )
    }
  ];

  return (
    <Card
      title="待我处理"
      extra={<Input.Search placeholder="搜索文档标题" style={{ width: 220 }} onSearch={(v) => setKeyword(v)} />}
    >
      <Table rowKey="taskId" columns={columns} dataSource={data.items} pagination={{ total: data.total, pageSize: data.pageSize, current: data.page, onChange: load }} />
    </Card>
  );
}