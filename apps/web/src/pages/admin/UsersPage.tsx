import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Form, Input, Modal, Select, Space, Table, TreeSelect, message } from 'antd';
import { auditApi, departmentsApi, rolesApi, usersApi, UserItem } from '../../api/endpoints';
import { StatusTag } from '../../components/StatusTag';

export function UsersPage() {
  const [data, setData] = useState<any>({ items: [], total: 0 });
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([]);
  const [depts, setDepts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async (page = 1) => {
    const [list, roleList, tree] = await Promise.all([usersApi.list({ page, pageSize: 20 }), rolesApi.list(), departmentsApi.tree()]);
    setData(list);
    setRoles(roleList);
    setDepts(tree);
  }, []);

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
    await usersApi.updateStatus(u.id, u.roles.includes('active') ? 'disabled' : 'active');
    load();
  };

  const columns = [
    { title: '姓名', dataIndex: 'name' },
    { title: '用户名', dataIndex: 'username' },
    { title: '角色', dataIndex: 'roles', render: (v: string[]) => v.map((r) => <span key={r}>{r}</span>) },
    { title: '状态', dataIndex: 'status', render: (v: string) => <StatusTag status={v} /> },
    {
      title: '操作',
      render: (_: unknown, r: any) => (
        <Space>
          <Button size="small" type="link" onClick={() => { auditApi.list({}); }}>重置密码</Button>
          <Button size="small" type="link" onClick={() => toggleStatus(r)}>{r.status === 'disabled' ? '启用' : '停用'}</Button>
        </Space>
      )
    }
  ];

  return (
    <Card title="用户管理" extra={<Button type="primary" onClick={() => setOpen(true)}>新建用户</Button>}>
      <Table rowKey="id" columns={columns} dataSource={data.items} pagination={{ total: data.total, pageSize: 20, onChange: load }} />
      <Modal title="新建用户" open={open} onOk={create} onCancel={() => setOpen(false)} destroyOnHidden>
        <Form form={form} layout="vertical">
          <Form.Item name="username" label="用户名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="password" label="初始密码" rules={[{ required: true, min: 8 }]}><Input.Password /></Form.Item>
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="employeeNo" label="工号"><Input /></Form.Item>
          <Form.Item name="email" label="邮箱"><Input /></Form.Item>
          <Form.Item name="departmentId" label="部门">
            <TreeSelect treeData={depts} fieldNames={{ label: 'name', value: 'id' }} allowClear />
          </Form.Item>
          <Form.Item name="roleIds" label="角色">
            <Select mode="multiple" options={roles.map((r) => ({ value: r.id, label: r.name }))} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}