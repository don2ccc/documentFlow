import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Checkbox, Form, Input, Modal, Space, Table, message } from 'antd';
import { PermissionItem, rolesApi, RoleItem } from '../../api/endpoints';

export function RolesPage() {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [perms, setPerms] = useState<PermissionItem[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RoleItem | null>(null);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    const [roleList, permList] = await Promise.all([rolesApi.list(), rolesApi.permissions()]);
    setRoles(roleList);
    setPerms(permList);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEdit = (r?: RoleItem) => {
    setEditing(r ?? null);
    form.resetFields();
    if (r) form.setFieldsValue({ name: r.name, description: r.description ?? '', permissionCodes: r.permissions.map((p) => p.code) });
    setOpen(true);
  };

  const save = async () => {
    const values = await form.validateFields();
    if (editing) await rolesApi.update(editing.id, values);
    else await rolesApi.create(values);
    message.success('已保存');
    setOpen(false);
    load();
  };

  const columns = [
    { title: '角色名称', dataIndex: 'name' },
    { title: '编码', dataIndex: 'code' },
    { title: '描述', dataIndex: 'description' },
    {
      title: '操作',
      render: (_: unknown, r: RoleItem) => (
        <Space>
          <Button size="small" type="link" onClick={() => openEdit(r)}>编辑</Button>
          <Button size="small" type="link" danger onClick={async () => { await rolesApi.remove(r.id); load(); }}>删除</Button>
        </Space>
      )
    }
  ];

  return (
    <Card title="角色管理" extra={<Button type="primary" onClick={() => openEdit()}>新建角色</Button>}>
      <Table rowKey="id" columns={columns} dataSource={roles} />
      <Modal title={editing ? '编辑角色' : '新建角色'} open={open} onOk={save} onCancel={() => setOpen(false)} destroyOnHidden>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          {!editing && <Form.Item name="code" label="编码" rules={[{ required: true, pattern: /^[a-z_][a-z0-9_]*$/ }]}><Input /></Form.Item>}
          <Form.Item name="description" label="描述"><Input /></Form.Item>
          <Form.Item name="permissionCodes" label="权限">
            <Checkbox.Group options={perms.map((p) => ({ value: p.code, label: p.name }))} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}