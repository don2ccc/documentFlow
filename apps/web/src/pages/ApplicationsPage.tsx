import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Col, Input, Modal, Row, Select, Space, Statistic, Table, Tag, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { applicationsApi, ApplicationListItem, Paged } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { StatusTag } from '../components/StatusTag';
import { UploadApplicationModal } from '../components/UploadApplicationModal';

const EMPTY_STATS = { pending: 0, approved: 0, rejected: 0 };

export function ApplicationsPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<Paged<ApplicationListItem>>({ items: [], total: 0, page: 1, pageSize: 20 });
  const [stats, setStats] = useState(EMPTY_STATS);
  const [status, setStatus] = useState<string>();
  const [keyword, setKeyword] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const { user, permissions } = useAuth();
  const canUpload = permissions.includes('document:upload');
  const canViewAll = permissions.includes('application:query');

  const load = useCallback(async (page = 1) => {
    try {
      const params: Record<string, unknown> = { status, keyword, page, pageSize: 20 };
      if (!(canViewAll && !canUpload)) params.ownerOnly = true;
      const list = await applicationsApi.list(params);
      setData(list);
      let pending = 0;
      let approved = 0;
      let rejected = 0;
      list.items.forEach((it) => {
        if (it.status === 'draft' || it.status === 'in_approval') pending += 1;
        else if (it.status === 'archived') approved += 1;
        else if (it.status === 'rejected') rejected += 1;
      });
      setStats({ pending, approved, rejected });
    } catch (e: any) {
      const msg = e?.response?.data?.message || '加载申请项目失败';
      message.error(msg);
    }
  }, [status, keyword, canViewAll, canUpload]);

  useEffect(() => {
    load(1);
  }, [load]);

  const withdraw = (app: ApplicationListItem) => {
    Modal.confirm({
      title: '撤回申请项目',
      content: `确定撤回「${app.title}」的审批吗？`,
      onOk: async () => {
        await applicationsApi.withdraw(app.id);
        message.success('已撤回');
        load();
      }
    });
  };

  const remind = async (app: ApplicationListItem) => {
    await applicationsApi.remind(app.id);
    message.success('已催办');
  };

  const remove = (app: ApplicationListItem) => {
    Modal.confirm({
      title: '删除申请项目',
      content: `确定删除「${app.title}」吗？该操作仅系统管理员可用，且不可恢复。`,
      okButtonProps: { danger: true },
      okText: '删除',
      cancelText: '取消',
      onOk: async () => {
        try {
          await applicationsApi.remove(app.id);
          message.success('已删除');
          load();
        } catch (e: any) {
          const msg = e?.response?.data?.message || '删除失败';
          message.error(msg);
        }
      }
    });
  };

  const columns = [
    {
      title: '申请项目',
      dataIndex: 'title',
      render: (v: string, r: ApplicationListItem) => <a onClick={() => navigate(`/applications/${r.id}`)}>{v}</a>
    },
    {
      title: '文件数',
      dataIndex: 'fileCount',
      width: 90,
      render: (v: number) => <Tag color="blue">{v} 个</Tag>
    },
    {
      title: '总大小',
      dataIndex: 'totalSize',
      width: 110,
      render: (v: number) => v >= 1024 * 1024 ? `${(v / (1024 * 1024)).toFixed(1)} MB` : `${(v / 1024).toFixed(1)} KB`
    },
    { title: '上传时间', dataIndex: 'createdAt', width: 180, render: (v: string) => v.slice(0, 16).replace('T', ' ') },
    { title: '创建人', dataIndex: 'ownerName', width: 120, render: (v: string | null) => v || '-' },
    { title: '状态', dataIndex: 'status', width: 100, render: (v: string) => <StatusTag status={v} /> },
    {
      title: '当前审核人',
      dataIndex: 'currentReviewer',
      width: 140,
      render: (v: ApplicationListItem['currentReviewer']) =>
        v && v.length > 0 ? (
          <Space size={4} wrap>
            {v.map((r) => (
              <Tag key={r.userId} color="processing">{r.name}</Tag>
            ))}
          </Space>
        ) : (
          <span style={{ color: '#bbb' }}>-</span>
        )
    },
    {
      title: '操作',
      width: 240,
      render: (_: unknown, r: ApplicationListItem) => (
        <Space>
          <Button size="small" type="link" onClick={() => navigate(`/applications/${r.id}`)}>查看</Button>
          {canUpload && r.status === 'in_approval' && r.ownerId === user?.id && (
            <>
              <Button size="small" type="link" onClick={() => withdraw(r)}>撤回</Button>
              <Button size="small" type="link" onClick={() => remind(r)}>催办</Button>
            </>
          )}
          {permissions.includes('user:manage') && (
            <Button size="small" type="link" danger onClick={() => remove(r)}>删除</Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={24}>
          <Col span={6}><Statistic title="待审批" value={stats.pending} /></Col>
          <Col span={6}><Statistic title="已通过" value={stats.approved} /></Col>
          <Col span={6}><Statistic title="已驳回" value={stats.rejected} /></Col>
          {canUpload ? (
            <Col span={6} style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
              <Button type="primary" onClick={() => setUploadOpen(true)}>新建申请项目</Button>
            </Col>
          ) : (
            <Col span={6} style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', color: '#999' }}>
              {canViewAll ? `共 ${data.total} 个项目（只读）` : ''}
            </Col>
          )}
        </Row>
      </Card>
      <Card
        title={canViewAll && !canUpload ? '申请项目库' : '我的申请项目'}
        extra={
          <Space>
            <Select
              allowClear placeholder="状态筛选" style={{ width: 130 }}
              value={status} onChange={(v) => setStatus(v)}
              options={[
                { value: 'draft', label: '草稿' },
                { value: 'in_approval', label: '审批中' },
                { value: 'archived', label: '已通过' },
                { value: 'rejected', label: '已驳回' }
              ]}
            />
            <Input.Search placeholder="搜索项目标题" style={{ width: 220 }} onSearch={(v) => setKeyword(v)} />
          </Space>
        }
      >
        <Table rowKey="id" columns={columns} dataSource={data.items} pagination={{ total: data.total, pageSize: data.pageSize, current: data.page, onChange: load }} />
      </Card>
      {canUpload && (
        <UploadApplicationModal open={uploadOpen} onClose={() => setUploadOpen(false)} onSuccess={() => { setUploadOpen(false); load(); }} />
      )}
    </div>
  );
}
