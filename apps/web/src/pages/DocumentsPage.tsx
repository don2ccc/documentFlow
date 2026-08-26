import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Col, Input, Modal, Row, Select, Space, Statistic, Table, Tag, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { dashboardApi, documentsApi, DocumentListItem, Paged } from '../api/endpoints';
import { StatusTag } from '../components/StatusTag';
import { SubmitFlowModal } from '../components/SubmitFlowModal';
import { UploadDocumentModal } from '../components/UploadDocumentModal';

const TYPE_LABEL: Record<string, string> = {
  pdf: 'PDF', doc: 'Word', docx: 'Word', xls: 'Excel', xlsx: 'Excel', ppt: 'PPT', pptx: 'PPT', png: '图片', jpg: '图片', gif: '图片'
};

export function DocumentsPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<Paged<DocumentListItem>>({ items: [], total: 0, page: 1, pageSize: 20 });
  const [stats, setStats] = useState({ myPending: 0, myApproved: 0, myRejected: 0 });
  const [status, setStatus] = useState<string>();
  const [keyword, setKeyword] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [submitTarget, setSubmitTarget] = useState<DocumentListItem | null>(null);

  const load = useCallback(async (page = 1) => {
    const [list, s] = await Promise.all([
      documentsApi.list({ status, keyword, page, pageSize: 20 }),
      dashboardApi.summary()
    ]);
    setData(list);
    setStats({ myPending: s.myPending, myApproved: s.myApproved, myRejected: s.myRejected });
  }, [status, keyword]);

  useEffect(() => {
    load(1);
  }, [load]);

  const withdraw = (doc: DocumentListItem) => {
    Modal.confirm({
      title: '撤回申请',
      content: `确定撤回「${doc.title}」的审批申请吗？`,
      onOk: async () => {
        await documentsApi.withdraw(doc.id);
        message.success('已撤回');
        load();
      }
    });
  };

  const remind = async (doc: DocumentListItem) => {
    await documentsApi.remind(doc.id);
    message.success('已催办');
  };

  const columns = [
    {
      title: '文档名称',
      dataIndex: 'title',
      render: (v: string, r: DocumentListItem) => <a onClick={() => navigate(`/documents/${r.id}`)}>{v}</a>
    },
    {
      title: '类型',
      dataIndex: 'latestVersion',
      width: 90,
      render: (v: DocumentListItem['latestVersion']) => {
        const ext = v?.mimeType.split('/')[1] ?? '';
        return <Tag>{TYPE_LABEL[ext] ?? '文件'}</Tag>;
      }
    },
    { title: '上传时间', dataIndex: 'createdAt', width: 180, render: (v: string) => v.slice(0, 16).replace('T', ' ') },
    { title: '状态', dataIndex: 'status', width: 100, render: (v: string) => <StatusTag status={v} /> },
    {
      title: '操作',
      width: 220,
      render: (_: unknown, r: DocumentListItem) => (
        <Space>
          <Button size="small" type="link" onClick={() => navigate(`/documents/${r.id}`)}>查看</Button>
          {(r.status === 'draft' || r.status === 'rejected') && (
            <Button size="small" type="link" onClick={() => setSubmitTarget(r)}>提交审批</Button>
          )}
          {r.status === 'in_approval' && (
            <>
              <Button size="small" type="link" onClick={() => withdraw(r)}>撤回</Button>
              <Button size="small" type="link" onClick={() => remind(r)}>催办</Button>
            </>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={24}>
          <Col span={6}><Statistic title="待审批" value={stats.myPending} /></Col>
          <Col span={6}><Statistic title="已通过" value={stats.myApproved} /></Col>
          <Col span={6}><Statistic title="已驳回" value={stats.myRejected} /></Col>
          <Col span={6} style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
            <Button type="primary" onClick={() => setUploadOpen(true)}>上传新文档</Button>
          </Col>
        </Row>
      </Card>
      <Card
        title="文档列表"
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
            <Input.Search placeholder="搜索文档标题" style={{ width: 220 }} onSearch={(v) => setKeyword(v)} />
          </Space>
        }
      >
        <Table rowKey="id" columns={columns} dataSource={data.items} pagination={{ total: data.total, pageSize: data.pageSize, current: data.page, onChange: load }} />
      </Card>
      <UploadDocumentModal open={uploadOpen} onClose={() => setUploadOpen(false)} onSuccess={() => { setUploadOpen(false); load(); }} />
      {submitTarget && (
        <SubmitFlowModal
          documentId={submitTarget.id}
          open={!!submitTarget}
          onClose={() => setSubmitTarget(null)}
          onSuccess={() => { setSubmitTarget(null); load(); }}
        />
      )}
    </div>
  );
}