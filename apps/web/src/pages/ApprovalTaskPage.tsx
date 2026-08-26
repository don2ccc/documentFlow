import { useEffect, useState } from 'react';
import { Button, Card, Col, Descriptions, Input, Modal, Row, Select, Space, Spin, message } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { approvalsApi, TaskDetail, usersApi } from '../api/endpoints';
import { ApprovalTimeline } from '../components/ApprovalTimeline';

export function ApprovalTaskPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [comment, setComment] = useState('');
  const [modal, setModal] = useState<'approve' | 'reject' | 'transfer' | null>(null);
  const [toUserId, setToUserId] = useState<string>();
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([]);

  const load = async () => {
    if (!id) return;
    setDetail(await approvalsApi.taskDetail(id));
  };

  useEffect(() => {
    load();
  }, [id]);

  const act = async (action: 'approve' | 'reject') => {
    if (action === 'reject' && !comment.trim()) {
      message.warning('驳回必须填写意见');
      return;
    }
    if (action === 'approve') await approvalsApi.approve(id!, comment || undefined);
    else await approvalsApi.reject(id!, comment);
    message.success('操作成功');
    setModal(null);
    navigate('/approvals');
  };

  const transfer = async () => {
    if (!toUserId) {
      message.warning('请选择转办人');
      return;
    }
    await approvalsApi.transfer(id!, toUserId, comment || undefined);
    message.success('已转办');
    setModal(null);
    navigate('/approvals');
  };

  if (!detail) return <Spin style={{ display: 'block', marginTop: 80 }} />;

  return (
    <div>
      <Card
        title={detail.document?.title ?? '任务详情'}
        extra={
          <Space>
            <Button href={`/documents/${detail.documentId}`} target="_blank">查看文档</Button>
            {detail.canApprove && (
              <>
                <Button type="primary" onClick={() => setModal('approve')}>同意</Button>
                <Button danger onClick={() => setModal('reject')}>驳回</Button>
                <Button onClick={() => { usersApi.list({ pageSize: 50 }).then((r) => setUsers(r.items)); setModal('transfer'); }}>转办</Button>
              </>
            )}
          </Space>
        }
      >
        <Row gutter={24}>
          <Col span={10}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="当前节点">{detail.nodeName}</Descriptions.Item>
              <Descriptions.Item label="金额">{detail.document?.amount ? `¥ ${detail.document.amount}` : '-'}</Descriptions.Item>
              <Descriptions.Item label="说明">{detail.document?.description || '-'}</Descriptions.Item>
            </Descriptions>
          </Col>
          <Col span={14}>
            <Card size="small" title="审批进度">
              <ApprovalTimeline progress={detail.progress} />
            </Card>
          </Col>
        </Row>
      </Card>

      <Modal
        title={modal === 'approve' ? '同意审批' : modal === 'reject' ? '驳回审批' : '转办任务'}
        open={!!modal}
        onCancel={() => setModal(null)}
        onOk={() => (modal === 'transfer' ? transfer() : act(modal === 'approve' ? 'approve' : 'reject'))}
        okText={modal === 'reject' ? '确认驳回' : modal === 'approve' ? '同意' : '转办'}
      >
        {modal === 'transfer' ? (
          <Select
            style={{ width: '100%' }}
            showSearch optionFilterProp="label"
            placeholder="选择转办人"
            value={toUserId}
            onChange={setToUserId}
            options={users.map((u) => ({ value: u.id, label: u.name }))}
          />
        ) : (
          <Input.TextArea
            rows={4}
            placeholder={modal === 'reject' ? '请填写驳回意见（必填）' : '审批意见（可选）'}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        )}
      </Modal>
    </div>
  );
}