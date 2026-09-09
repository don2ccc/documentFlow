import { useCallback, useEffect, useState } from 'react';
import { Card, Table } from 'antd';
import { auditApi, AuditLogItem } from '../../api/endpoints';
import { formatDateTime } from '../../utils/datetime';

export function AuditLogsPage() {
  const [data, setData] = useState<any>({ items: [], total: 0 });
  const load = useCallback(async (page = 1) => setData(await auditApi.list({ page, pageSize: 20 })), []);
  useEffect(() => { load(); }, [load]);

  const columns = [
    { title: '时间', dataIndex: 'createdAt', width: 180, render: (v: string) => formatDateTime(v) },
    { title: '操作人', dataIndex: 'actorId', width: 150 },
    { title: '动作', dataIndex: 'action', width: 160 },
    { title: '对象', dataIndex: 'targetType', width: 130 },
    { title: '对象ID', dataIndex: 'targetId' }
  ];

  return (
    <Card title="审计日志">
      <Table rowKey="id" columns={columns} dataSource={data.items} pagination={{ total: data.total, pageSize: 20, onChange: load }} />
    </Card>
  );
}