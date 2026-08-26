import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Form, Input, InputNumber, Modal, Radio, Select, Space, Table, message } from 'antd';
import { useParams } from 'react-router-dom';
import { rolesApi, workflowsApi } from '../../api/endpoints';

const NODE_TYPES = [
  { value: 'start', label: '开始' },
  { value: 'approval', label: '审批' },
  { value: 'handle', label: '办理' },
  { value: 'condition', label: '条件分支' },
  { value: 'cc', label: '抄送' },
  { value: 'end', label: '结束' }
];

export function WorkflowEditPage() {
  const { id } = useParams();
  const [wf, setWf] = useState<any>(null);
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([]);
  const [nodeForm] = Form.useForm();
  const [nodeModal, setNodeModal] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const load = async () => {
    if (!id) return;
    const data = await workflowsApi.get(id);
    setWf(data);
    setNodes(data.nodes);
    setEdges(data.edges);
  };

  useEffect(() => {
    load();
    rolesApi.list().then(setRoles).catch(() => undefined);
  }, [id]);

  const nodeOptions = useMemo(() => nodes.map((n) => ({ value: n.id, label: n.name })), [nodes]);

  const openNode = (index: number | null) => {
    setEditingIndex(index);
    nodeForm.resetFields();
    if (index !== null) nodeForm.setFieldsValue(nodes[index]);
    setNodeModal(true);
  };

  const saveNode = async () => {
    const values = await nodeForm.validateFields();
    const next = [...nodes];
    if (editingIndex === null) next.push({ id: `n_${Date.now()}`, ...values });
    else next[editingIndex] = { ...next[editingIndex], ...values };
    setNodes(next);
    setNodeModal(false);
  };

  const addEdge = () => {
    setEdges([...edges, { id: `e_${Date.now()}`, fromNodeId: '', toNodeId: '', conditionExpr: null }]);
  };

  const saveGraph = async () => {
    try {
      await workflowsApi.saveNodes(id!, { nodes, edges });
      message.success('流程已保存');
      load();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? '保存失败');
    }
  };

  if (!wf) return null;

  const edgeColumns = [
    {
      title: '来源',
      dataIndex: 'fromNodeId',
      render: (v: string, r: any, i: number) => (
        <Select style={{ width: 150 }} value={v} options={nodeOptions} onChange={(val) => { const next = [...edges]; next[i] = { ...r, fromNodeId: val }; setEdges(next); }} />
      )
    },
    {
      title: '目标',
      dataIndex: 'toNodeId',
      render: (v: string, r: any, i: number) => (
        <Select style={{ width: 150 }} value={v} options={nodeOptions} onChange={(val) => { const next = [...edges]; next[i] = { ...r, toNodeId: val }; setEdges(next); }} />
      )
    },
    {
      title: '条件',
      dataIndex: 'conditionExpr',
      render: (v: any, r: any, i: number) => (
        <Input
          placeholder="留空为默认分支；如 amount>=10000"
          style={{ width: 240 }}
          value={v ? `${v.field}${v.op}${v.value}` : ''}
          onChange={(e) => {
            const text = e.target.value.trim();
            const next = [...edges];
            next[i] = { ...r, conditionExpr: text ? { field: text.includes('category') ? 'categoryId' : 'amount', op: '>=', value: text.replace(/[^0-9]/g, '') || 0 } : null };
            setEdges(next);
          }}
        />
      )
    },
    {
      title: '操作',
      render: (_: unknown, r: any) => <Button size="small" type="link" danger onClick={() => setEdges(edges.filter((e) => e.id !== r.id))}>删除</Button>
    }
  ];

  return (
    <div>
      <Card
        title={`流程配置：${wf.name}`}
        extra={
          <Space>
            <Button onClick={saveGraph}>保存</Button>
            {wf.status === 'active' ? (
              <Button onClick={async () => { await workflowsApi.deactivate(wf.id); load(); }}>停用</Button>
            ) : (
              <Button type="primary" onClick={async () => { await workflowsApi.activate(wf.id); load(); }}>启用</Button>
            )}
          </Space>
        }
      >
        <Card size="small" title="节点列表" extra={<Button type="link" onClick={() => openNode(null)}>添加节点</Button>}>
          {nodes.map((n, i) => (
            <div key={n.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f0f0f0' }}>
              <span>{n.name}（{NODE_TYPES.find((t) => t.value === n.type)?.label ?? n.type}）</span>
              <Space>
                <Button size="small" type="link" onClick={() => openNode(i)}>编辑</Button>
                <Button size="small" type="link" danger onClick={() => { setNodes(nodes.filter((x) => x.id !== n.id)); setEdges(edges.filter((e) => e.fromNodeId !== n.id && e.toNodeId !== n.id)); }}>删除</Button>
              </Space>
            </div>
          ))}
        </Card>
        <Card size="small" title="连线" style={{ marginTop: 16 }} extra={<Button type="link" onClick={addEdge}>添加连线</Button>}>
          <Table rowKey="id" columns={edgeColumns} dataSource={edges} pagination={false} size="small" />
        </Card>
      </Card>

      <Modal title={editingIndex === null ? '添加节点' : '编辑节点'} open={nodeModal} onOk={saveNode} onCancel={() => setNodeModal(false)} destroyOnHidden>
        <Form form={nodeForm} layout="vertical">
          <Form.Item name="name" label="节点名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="type" label="节点类型" rules={[{ required: true }]}><Select options={NODE_TYPES} /></Form.Item>
          <Form.Item noStyle shouldUpdate={(a, b) => a.type !== b.type}>
            {({ getFieldValue }) =>
              (getFieldValue('type') === 'approval' || getFieldValue('type') === 'handle') ? (
                <>
                  <Form.Item name="approverRule" label="审批人规则" rules={[{ required: true }]}>
                    <Select options={[{ value: 'role', label: '指定角色' }, { value: 'person', label: '指定人员' }, { value: 'supervisor', label: '直属主管' }, { value: 'initiator_choice', label: '发起人自选' }]} />
                  </Form.Item>
                  <Form.Item name="approverValue" label="角色/人员">
                    <Select allowClear options={roles.map((r) => ({ value: r.id, label: r.name }))} placeholder="选择角色（或填人员ID）" />
                  </Form.Item>
                  <Form.Item name="approvalMethod" label="审批方式" rules={[{ required: true }]}>
                    <Radio.Group options={[{ value: 'orsign', label: '或签（一人同意即可）' }, { value: 'countersign', label: '会签（需全部同意）' }]} />
                  </Form.Item>
                  <Form.Item name="timeoutHours" label="超时（小时）"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
                  <Form.Item name="timeoutAction" label="超时处理"><Select allowClear options={[{ value: 'remind', label: '自动催办' }, { value: 'auto_approve', label: '自动同意' }, { value: 'auto_reject', label: '自动驳回' }]} /></Form.Item>
                </>
              ) : null
            }
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}