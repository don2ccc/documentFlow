import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Table, TreeSelect, message } from 'antd';
import { auditApi, departmentsApi, rolesApi, usersApi, UserItem } from '../../api/endpoints';
import { StatusTag } from '../../components/StatusTag';

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'pending', label: '待激活' },
  { value: 'active', label: '正常' },
  { value: 'disabled', label: '已停用' }
];

export function UsersPage() {
  const [data, setData] = useState<any>({ items: [], total: 0 });
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([]);
  const [depts, setDepts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserItem | null>(null);
  const [resetTarget, setResetTarget] = useState<UserItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [keyword, setKeyword] = useState<string>('');
  const [approveResult, setApproveResult] = useState<{ name: string; initialPassword: string; emailSent: boolean; email: string | null } | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [resetForm] = Form.useForm();

  const load = useCallback(async (page = 1) => {
    const params: Record<string, unknown> = { page, pageSize: 20 };
    if (statusFilter) params.status = statusFilter;
    if (keyword.trim()) params.keyword = keyword.trim();
    const [list, roleList, tree] = await Promise.all([
      usersApi.list(params),
      rolesApi.list(),
      departmentsApi.tree()
    ]);
    setData(list);
    setRoles(roleList);
    setDepts(tree);
  }, [statusFilter, keyword]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    const values = await form.validateFields();
    await usersApi.create(values);
    message.success('用户已创建');
    setOpen(false);
    form.resetFields();
    load();
  };

  const toggleStatus = async (u: UserItem) => {
    await usersApi.updateStatus(u.id, u.status === 'disabled' ? 'active' : 'disabled');
    load();
  };

  const remove = async (u: UserItem) => {
    await usersApi.remove(u.id);
    message.success('用户已删除');
    load();
  };

  const startEdit = (u: UserItem) => {
    setEditing(u);
    editForm.setFieldsValue({
      name: u.name,
      employeeNo: u.employeeNo ?? '',
      email: u.email ?? '',
      directSupervisor: u.directSupervisor ?? '',
      productionLine: u.productionLine ?? '',
      position: u.position ?? '',
      departmentId: u.departmentId ?? undefined,
      roleIds: u.roleIds ?? []
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    const values = await editForm.validateFields();
    await usersApi.update(editing.id, values);
    message.success('用户已保存');
    setEditing(null);
    load();
  };

  const startReset = (u: UserItem) => {
    setResetTarget(u);
    resetForm.resetFields();
  };

  const submitReset = async () => {
    if (!resetTarget) return;
    const values = await resetForm.validateFields();
    await usersApi.resetPassword(resetTarget.id, values.newPassword);
    message.success(`「${resetTarget.name}」的密码已重置，该用户下次登录必须修改密码`);
    setResetTarget(null);
    resetForm.resetFields();
  };

  const approve = async (u: UserItem) => {
    try {
      setApproving(u.id);
      const result = await usersApi.approve(u.id);
      setApproveResult({
        name: u.name,
        initialPassword: result.initialPassword,
        emailSent: result.emailSent,
        email: u.email ?? null
      });
      load();
    } catch (e: any) {
      message.error(e?.response?.data?.message || '激活失败');
    } finally {
      setApproving(null);
    }
  };

  const columns = [
    { title: '姓名', dataIndex: 'name' },
    { title: '用户名', dataIndex: 'username' },
    { title: '邮箱', dataIndex: 'email' },
    { title: '直属领导', dataIndex: 'directSupervisor' },
    { title: '生产线', dataIndex: 'productionLine' },
    { title: '职位', dataIndex: 'position' },
    { title: '角色', dataIndex: 'roles', render: (v: string[]) => v.map((r) => <span key={r}>{r}</span>) },
    { title: '状态', dataIndex: 'status', render: (v: string) => <StatusTag status={v} /> },
    {
      title: '操作',
      render: (_: unknown, r: UserItem) => (
        <Space size={4} wrap>
          {r.status === 'pending' && (
            <Button size="small" type="link" onClick={() => approve(r)} loading={approving === r.id}>
              激活并发送通知
            </Button>
          )}
          <Button size="small" type="link" onClick={() => startEdit(r)}>编辑</Button>
          <Button size="small" type="link" onClick={() => startReset(r)}>重置密码</Button>
          {r.status !== 'pending' && (
            <Button size="small" type="link" onClick={() => toggleStatus(r)}>
              {r.status === 'disabled' ? '启用' : '停用'}
            </Button>
          )}
          {r.roles.includes('sys_admin') ? null : (
            <Popconfirm title="确认删除该用户?" okText="删除" cancelText="取消" okButtonProps={{ danger: true }} onConfirm={() => remove(r)}>
              <Button size="small" type="link" danger>删除</Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  return (
    <Card
      title="用户管理"
      extra={<Button type="primary" onClick={() => setOpen(true)}>新建用户</Button>}
    >
      <Space style={{ marginBottom: 12 }} wrap>
        <Select
          value={statusFilter}
          onChange={(v) => setStatusFilter(v)}
          options={STATUS_OPTIONS}
          style={{ width: 140 }}
        />
        <Input.Search
          allowClear
          placeholder="搜索 姓名/用户名/工号"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onSearch={() => load()}
          style={{ width: 260 }}
        />
      </Space>
      <Table rowKey="id" columns={columns} dataSource={data.items} pagination={{ total: data.total, pageSize: 20, onChange: load }} />
      <Modal title="新建用户" open={open} onOk={create} onCancel={() => setOpen(false)} destroyOnHidden>
        <Form form={form} layout="vertical">
          <Form.Item name="username" label="用户名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="password" label="初始密码" rules={[{ required: true, min: 8 }]}><Input.Password /></Form.Item>
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="employeeNo" label="工号"><Input /></Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email', message: '请输入合法邮箱' }]}><Input /></Form.Item>
          <Form.Item name="directSupervisor" label="直属领导"><Input /></Form.Item>
          <Form.Item name="productionLine" label="生产线"><Input /></Form.Item>
          <Form.Item name="position" label="职位信息"><Input /></Form.Item>
          <Form.Item name="departmentId" label="部门">
            <TreeSelect treeData={depts} fieldNames={{ label: 'name', value: 'id' }} allowClear />
          </Form.Item>
          <Form.Item name="roleIds" label="角色">
            <Select mode="multiple" options={roles.map((r) => ({ value: r.id, label: r.name }))} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="编辑用户" open={!!editing} onOk={saveEdit} onCancel={() => setEditing(null)} destroyOnHidden okText="保存" cancelText="取消">
        <Form form={editForm} layout="vertical">
          <Form.Item label="用户名"><Input value={editing?.username} disabled /></Form.Item>
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="employeeNo" label="工号"><Input /></Form.Item>
          <Form.Item name="email" label="邮箱"><Input /></Form.Item>
          <Form.Item name="directSupervisor" label="直属领导"><Input /></Form.Item>
          <Form.Item name="productionLine" label="生产线"><Input /></Form.Item>
          <Form.Item name="position" label="职位信息"><Input /></Form.Item>
          <Form.Item name="departmentId" label="部门">
            <TreeSelect treeData={depts} fieldNames={{ label: 'name', value: 'id' }} allowClear />
          </Form.Item>
          <Form.Item name="roleIds" label="角色">
            <Select mode="multiple" options={roles.map((r) => ({ value: r.id, label: r.name }))} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={resetTarget ? `重置「${resetTarget.name}」的密码` : '重置密码'}
        open={!!resetTarget}
        onOk={submitReset}
        onCancel={() => { setResetTarget(null); resetForm.resetFields(); }}
        okText="确定重置"
        cancelText="取消"
        destroyOnHidden
      >
        <div style={{ marginBottom: 12, color: '#666' }}>
          请输入新的登录密码（至少 8 位）。该用户下次登录时必须立即修改密码。
        </div>
        <Form form={resetForm} layout="vertical">
          <Form.Item name="newPassword" label="新密码" rules={[{ required: true, min: 8, message: '至少 8 位' }]} hasFeedback>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="确认新密码"
            dependencies={['newPassword']}
            hasFeedback
            rules={[
              { required: true, message: '请再次输入新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                  return Promise.reject(new Error('两次输入的密码不一致'));
                }
              })
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="账号已激活"
        open={!!approveResult}
        onCancel={() => setApproveResult(null)}
        footer={<Button type="primary" onClick={() => setApproveResult(null)}>我知道了</Button>}
        destroyOnHidden
        width={480}
      >
        {approveResult && (
          <>
            <Alert
              type={approveResult.emailSent ? 'success' : 'warning'}
              showIcon
              style={{ marginBottom: 12 }}
              message={
                approveResult.emailSent
                  ? `已向 ${approveResult.email ?? '该用户'} 发送账号开通邮件`
                  : 'SMTP 未配置或发送失败，请把下面的初始密码告知该用户'
              }
            />
            <div style={{ marginBottom: 8 }}>
              <div style={{ color: '#666', fontSize: 12 }}>用户姓名</div>
              <div>{approveResult.name}</div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ color: '#666', fontSize: 12 }}>初始密码（首次登录后必须修改）</div>
              <div style={{ fontFamily: 'monospace', fontSize: 16, background: '#f5f5f5', padding: '6px 10px', borderRadius: 4, userSelect: 'all' }}>
                {approveResult.initialPassword}
              </div>
            </div>
          </>
        )}
      </Modal>
    </Card>
  );
}