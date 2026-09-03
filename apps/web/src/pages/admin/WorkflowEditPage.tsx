import { useEffect, useMemo, useState } from 'react';
import { AutoComplete, Button, Card, Form, InputNumber, Modal, Popconfirm, Select, Space, Table, message } from 'antd';
import { useParams } from 'react-router-dom';
import { usersApi, workflowsApi } from '../../api/endpoints';

const NODE_TYPES = [
  { value: 'start', label: '开始' },
  { value: 'approval', label: '审批' },
  { value: 'end', label: '结束' }
];

// name is derived from type + the user-chosen 审批顺序 so list rows stay stable & unique
const autoName = (type: string, order: number) => {
  if (type === 'start') return '开始';
  if (type === 'end') return '结束';
  if (type === 'approval') return `审批 ${order}`;
  return '';
};

export function WorkflowEditPage() {
  const { id } = useParams();
  const [wf, setWf] = useState<any>(null);
  const [nodes, setNodes] = useState<any[]>([]);
  const [users, setUsers] = useState<Array<{ id: string; username: string; name: string }>>([]);
  const [nodeForm] = Form.useForm();
  const [nodeModal, setNodeModal] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const load = async () => {
    if (!id) return;
    const data = await workflowsApi.get(id);
    setWf(data);
    setNodes(data.nodes);
  };

  useEffect(() => {
    load();
    usersApi.list({ pageSize: 100 }).then((r) =>
      setUsers((r.items ?? []).map((u: any) => ({ id: u.id, username: u.username, name: u.name })))
    ).catch(() => undefined);
  }, [id]);

  const userOptions = useMemo(
    () => users.map((u) => ({ value: u.username, label: `${u.username}（${u.name}）` })),
    [users]
  );
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const openNode = (index: number | null) => {
    setEditingIndex(index);
    nodeForm.resetFields();
    if (index !== null) {
      const n = nodes[index];
      const approver = n.approverValue ? userById.get(n.approverValue) : null;
      nodeForm.setFieldsValue({
        type: n.type,
        sortOrder: (n.sortOrder ?? 0) + 1,
        approverAccount: approver ? approver.username : '',
        timeoutDays: n.timeoutDays ?? 15,
        timeoutAction: n.timeoutAction ?? 'return_to_initiator'
      });
    } else {
      const used = new Set(nodes.map((n) => (n.sortOrder ?? 0) + 1));
      const approvals = nodes.filter((n) => n.type === 'approval').length;
      // next suggested: prefer (approvals + 1); fall back to first unused positive int
      let next = approvals + 1;
      while (used.has(next)) next += 1;
      nodeForm.setFieldsValue({
        type: 'approval',
        sortOrder: next,
        approverAccount: '',
        timeoutDays: 15,
        timeoutAction: 'return_to_initiator'
      });
    }
    setNodeModal(true);
  };

  const saveNode = async () => {
    const values = await nodeForm.validateFields();
    const orderInput = Number(values.sortOrder);
    if (!Number.isInteger(orderInput) || orderInput < 1) {
      message.error('审批顺序必须是正整数');
      return;
    }
    const clash = nodes.some((n, i) => i !== editingIndex && (n.sortOrder ?? 0) + 1 === orderInput);
    if (clash) {
      message.error(`审批顺序 ${orderInput} 已被占用，请改用其他数字`);
      return;
    }
    const isApproval = values.type === 'approval' || values.type === 'handle';
    let approverValue: string | null = null;
    if (isApproval) {
      const acct = (values.approverAccount ?? '').trim();
      if (!acct) {
        message.error('请填写审批人账号');
        return;
      }
      const acctLower = acct.toLowerCase();
      const u = users.find((x) =>
        x.username.toLowerCase() === acctLower ||
        x.name.toLowerCase() === acctLower ||
        (x.id && x.id.toLowerCase() === acctLower)
      );
      if (!u) {
        message.error(`找不到用户：${acct}（可填账号、姓名或UUID）`);
        return;
      }
      approverValue = u.id;
    }
    const next = [...nodes];
    const payload = {
      name: autoName(values.type, orderInput),
      type: values.type,
      approverRule: isApproval ? 'person' : null,
      approverValue,
      approvalMethod: isApproval ? 'orsign' : null,
      timeoutDays: isApproval ? (values.timeoutDays ?? 15) : null,
      timeoutAction: isApproval ? (values.timeoutAction ?? 'return_to_initiator') : null,
      sortOrder: orderInput - 1
    };
    if (editingIndex === null) next.push({ id: `n_${Date.now()}`, ...payload });
    else next[editingIndex] = { ...next[editingIndex], ...payload };
    setNodes(next);
    setNodeModal(false);
  };

  const moveNode = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= nodes.length) return;
    const next = [...nodes];
    [next[index], next[j]] = [next[j], next[index]];
    setNodes(next);
  };

  const removeNode = (index: number) => {
    setNodes(nodes.filter((_, i) => i !== index));
  };

  const saveGraph = async () => {
    try {
      await workflowsApi.saveNodes(id!, { nodes });
      message.success('流程已保存');
      load();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? '保存失败');
    }
  };

  if (!wf) return null;

  const approverName = (val: string) => {
    const u = userById.get(val);
    return u ? `${u.username}（${u.name}）` : val ?? '';
  };

  const nodeColumns = [
    {
      title: '审批顺序',
      dataIndex: 'sortOrder',
      width: 100,
      render: (v: number) => (typeof v === 'number' ? v + 1 : '-')
    },
    {
      title: '类型',
      dataIndex: 'type',
      render: (t: string) => NODE_TYPES.find((x) => x.value === t)?.label ?? t
    },
    {
      title: '审批人',
      dataIndex: 'approverValue',
      render: (v: string, r: any) => (r.type === 'approval' || r.type === 'handle') ? approverName(v) : '-'
    },
    {
      title: '审批超时',
      dataIndex: 'timeoutDays',
      render: (v: number, r: any) => (r.type === 'approval' || r.type === 'handle') && v ? `${v} 天` : '-'
    },
    {
      title: '超时处理',
      dataIndex: 'timeoutAction',
      render: (v: string, r: any) => {
        if (r.type !== 'approval' && r.type !== 'handle') return '-';
        const map: Record<string, string> = {
          return_to_initiator: '退回给发起人',
          remind: '自动催办',
          auto_approve: '自动同意',
          auto_reject: '自动驳回'
        };
        return map[v] ?? v ?? '-';
      }
    },
    {
      title: '操作',
      width: 260,
      render: (_: unknown, _r: any, i: number) => (
        <Space size={4}>
          <Button size="small" type="link" disabled={i === 0 || _r.type === 'start' || _r.type === 'end'} onClick={() => moveNode(i, -1)}>上移</Button>
          <Button size="small" type="link" disabled={i === nodes.length - 1 || _r.type === 'start' || _r.type === 'end'} onClick={() => moveNode(i, 1)}>下移</Button>
          <Button size="small" type="link" onClick={() => openNode(i)}>编辑</Button>
          <Popconfirm title="确认删除该节点?" okText="删除" cancelText="取消" okButtonProps={{ danger: true }} onConfirm={() => removeNode(i)}>
            <Button size="small" type="link" danger>删除</Button>
          </Popconfirm>
        </Space>
      )
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
              <Button type="primary" onClick={async () => {
                const hasStart = nodes.some((n) => n.type === 'start');
                const hasEnd = nodes.some((n) => n.type === 'end');
                if (!hasStart || !hasEnd) { message.error('启用前必须包含且仅包含一个开始与一个结束节点'); return; }
                try { await workflowsApi.activate(wf.id); message.success('已启用'); load(); }
                catch (e: any) { message.error(e?.response?.data?.message ?? '启用失败'); }
              }}>启用</Button>
            )}
          </Space>
        }
      >
        <Card size="small" title="节点列表" extra={<Button type="link" onClick={() => openNode(null)}>添加节点</Button>}>
          <Table rowKey="id" columns={nodeColumns} dataSource={nodes} pagination={false} size="small" />
        </Card>
      </Card>

      <Modal
        title={editingIndex === null ? '添加节点' : '编辑节点'}
        open={nodeModal}
        onOk={saveNode}
        onCancel={() => setNodeModal(false)}
        destroyOnHidden
      >
        <Form form={nodeForm} layout="vertical">
          <Form.Item name="type" label="节点类型" rules={[{ required: true, message: '请选择节点类型' }]}>
            <Select options={NODE_TYPES} />
          </Form.Item>
          <Form.Item
            name="sortOrder"
            label="审批顺序"
            rules={[
              { required: true, message: '请输入审批顺序' },
              { type: 'integer', min: 1, message: '必须是 ≥ 1 的整数' }
            ]}
            extra="与主界面表格一致：1、2、3...；必须唯一不能重复"
          >
            <InputNumber min={1} precision={0} style={{ width: '100%' }} placeholder="正整数，例如 1、2、3..." />
          </Form.Item>
          <Form.Item shouldUpdate={(a, b) => a.type !== b.type || a.sortOrder !== b.sortOrder} noStyle>
            {() => {
              const t = nodeForm.getFieldValue('type');
              const o = Number(nodeForm.getFieldValue('sortOrder') ?? 1);
              const preview = autoName(t, o);
              return (
                <div style={{ marginTop: -8, marginBottom: 16, padding: '6px 10px', background: '#fafafa', border: '1px dashed #d9d9d9', borderRadius: 4 }}>
                  节点名称（自动生成）：<strong>{preview || '—'}</strong>
                </div>
              );
            }}
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(a, b) => a.type !== b.type}>
            {({ getFieldValue }) =>
              (getFieldValue('type') === 'approval' || getFieldValue('type') === 'handle') ? (
                <>
                  <Form.Item name="approverAccount" label="审批人账号" rules={[{ required: true, message: '请填写审批人账号' }]}>
                    <AutoComplete
                      options={userOptions}
                      filterOption={(input, option) => {
                        const q = input.toLowerCase();
                        const label = (option?.label ?? '').toString().toLowerCase();
                        const v = (option?.value ?? '').toString().toLowerCase();
                        return label.includes(q) || v.includes(q);
                      }}
                      placeholder="输入或选择用户账号（也支持姓名、UUID）"
                    />
                  </Form.Item>
                  <Form.Item name="timeoutDays" label="审批超时（天）" extra="默认 15 天，到期后按下方策略处理">
                    <InputNumber min={1} defaultValue={15} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item name="timeoutAction" label="超时处理">
                    <Select
                      allowClear
                      defaultValue="return_to_initiator"
                      options={[
                        { value: 'return_to_initiator', label: '退回给发起人' },
                        { value: 'remind', label: '自动催办' },
                        { value: 'auto_approve', label: '自动同意' },
                        { value: 'auto_reject', label: '自动驳回' }
                      ]}
                    />
                  </Form.Item>
                </>
              ) : null
            }
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}