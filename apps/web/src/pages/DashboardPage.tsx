import { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, Table } from 'antd';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '../api/endpoints';
import { StatusTag } from '../components/StatusTag';
import { formatDateMinute } from '../utils/datetime';


export function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    dashboardApi.summary().then(setData).catch(() => undefined);
  }, []);

  if (!data) return <Card loading />;

  const columns = [
    { title: '申请项目', dataIndex: 'title', render: (v: string, r: any) => <a onClick={() => navigate(`/applications/${r.id}`)}>{v}</a> },
    { title: '状态', dataIndex: 'status', width: 120, render: (v: string) => <StatusTag status={v} /> },
    { title: '时间', dataIndex: 'createdAt', width: 180, render: (v: string) => formatDateMinute(v) }
  ];

  return (
    <div>
      <Row gutter={16}>
        <Col span={6}><Card><Statistic title="我的待办" value={data.todoCount} /></Card></Col>
        <Col span={6}><Card><Statistic title="审批中" value={data.myPending} /></Card></Col>
        <Col span={6}><Card><Statistic title="已通过" value={data.myApproved} /></Card></Col>
        <Col span={6}><Card><Statistic title="已驳回" value={data.myRejected} /></Card></Col>
      </Row>
      <Card title="最近申请" style={{ marginTop: 16 }}>
        <Table rowKey="id" columns={columns} dataSource={data.recentInstances} pagination={false} />
      </Card>
    </div>
  );
}
