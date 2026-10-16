import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Input, message, Modal, Popconfirm, Space, Table, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import { workflowsApi, WorkflowItem } from '../../api/endpoints';

export function WorkflowsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<WorkflowItem[]>([]);
  const [keyword, setKeyword] = useState('');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  const load = useCallback(async () => setItems(await workflowsApi.list({ keyword })), [keyword]);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!name.trim()) { message.warning('请输入流程名称'); return; }
    const wf = await workflowsApi.create({ name });
    setOpen(false);
    setName('');
    navigate(`/admin/workflows/${wf.id}`);
  };

  const toggle = async (w: WorkflowItem) => {
    if (w.status === 'active') await workflowsApi.deactivate(w.id);
    else await workflowsApi.activate(w.id);
    load();
  };

  const remove = async (w: WorkflowItem) => {
    try {
      await workflowsApi.remove(w.id);
      message.success(`已删除流程「${w.name}」`);
      load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      message.error(err?.response?.data?.message ?? err?.message ?? '删除失败');
    }
  };

  return (
    <Card
      title="审批流程预设"
      extra={
        <Space>
          <Input.Search placeholder="搜索流程" style={{ width: 200 }} onSearch={(v) => setKeyword(v)} />
          <Button type="primary" onClick={() => setOpen(true)}>新建流程</Button>
        </Space>
      }
    >
      <Table
        rowKey="id"
        dataSource={items}
        columns={[
          { title: '名称', dataIndex: 'name' },
          { title: '节点数', dataIndex: 'nodeCount', width: 100 },
          { title: '版本', dataIndex: 'version', width: 80 },
          { title: '状态', dataIndex: 'status', width: 100, render: (v: string) => <Tag color={v === 'active' ? 'green' : v === 'draft' ? 'orange' : 'default'}>{v === 'active' ? '已启用' : v === 'draft' ? '草稿' : '已停用'}</Tag> },
          {
            title: '操作',
            render: (_: unknown, r: WorkflowItem) => (
              <Space>
                <Button size="small" type="link" onClick={() => navigate(`/admin/workflows/${r.id}`)}>配置节点</Button>
                <Button size="small" type="link" onClick={() => toggle(r)}>{r.status === 'active' ? '停用' : '启用'}</Button>
                <Popconfirm
                  title="确定删除该流程？"
                  description="删除前会校验是否存在未结案的审批单据，如有将无法删除。"
                  okText="删除"
                  cancelText="取消"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => remove(r)}
                >
                  <Button size="small" type="link" danger>删除</Button>
                </Popconfirm>
              </Space>
            )
          }
        ]}
      />
      <Modal title="新建流程" open={open} onOk={create} onCancel={() => setOpen(false)} destroyOnHidden>
        <Input placeholder="流程名称" value={name} onChange={(e) => setName(e.target.value)} />
      </Modal>
    </Card>
  );
}

