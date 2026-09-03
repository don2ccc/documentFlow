import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Checkbox, Form, Input, Modal, Space, Table, Typography, message } from "antd";
import { ApartmentOutlined, BankOutlined, IdcardOutlined, SettingOutlined, ToolOutlined } from "@ant-design/icons";
import { PermissionItem, rolesApi, RoleItem } from "../../api/endpoints";

interface CategoryDef {
  key: string;
  label: string;
  icon: React.ReactNode;
}

const CATEGORIES: CategoryDef[] = [
  { key: "workflow", label: "WorkFlow管理", icon: <ApartmentOutlined /> },
  { key: "admin", label: "行政管理", icon: <BankOutlined /> },
  { key: "production", label: "生产管理", icon: <ToolOutlined /> },
  { key: "hr", label: "HR管理", icon: <IdcardOutlined /> },
  { key: "system", label: "系统管理", icon: <SettingOutlined /> }
];

// 按一级菜单分类的权限映射，未列为系统管理。后续新增权限只需补入此表。
const PERM_CATEGORY: Record<string, string> = {
  "document:upload": "workflow",
  "document:preview": "workflow",
  "document:download": "workflow",
  "application:query": "workflow",
  "approval:handle": "workflow",
  "dashboard:view": "workflow",
  "user:manage": "system",
  "role:manage": "system",
  "category:manage": "system",
  "workflow:manage": "system",
  "audit:view": "system",
  "setting:manage": "system",
  "database:manage": "system"
};

function groupPerms(perms: PermissionItem[]) {
  const out: Record<string, PermissionItem[]> = {};
  for (const c of CATEGORIES) out[c.key] = [];
  for (const p of perms) {
    const cat = PERM_CATEGORY[p.code] ?? "system";
    if (!out[cat]) out[cat] = [];
    out[cat].push(p);
  }
  return out;
}

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
    if (r) form.setFieldsValue({ name: r.name, description: r.description ?? "", permissionCodes: r.permissions.map((p) => p.code) });
    setOpen(true);
  };

  const save = async () => {
    const values = await form.validateFields();
    if (editing) await rolesApi.update(editing.id, values);
    else await rolesApi.create(values);
    message.success("已保存");
    setOpen(false);
    load();
  };

  const columns = [
    { title: "角色名称", dataIndex: "name" },
    { title: "编码", dataIndex: "code" },
    { title: "描述", dataIndex: "description" },
    {
      title: "操作",
      render: (_: unknown, r: RoleItem) => (
        <Space>
          <Button size="small" type="link" onClick={() => openEdit(r)}>编辑</Button>
          <Button size="small" type="link" danger onClick={async () => { await rolesApi.remove(r.id); load(); }}>删除</Button>
        </Space>
      )
    }
  ];

  const grouped = useMemo(() => groupPerms(perms), [perms]);
  const selected = (Form.useWatch("permissionCodes", form) as string[] | undefined) ?? [];

  return (
    <Card title="角色管理" extra={<Button type="primary" onClick={() => openEdit()}>新建角色</Button>}>
      <Table rowKey="id" columns={columns} dataSource={roles} />
      <Modal title={editing ? "编辑角色" : "新建角色"} open={open} onOk={save} onCancel={() => setOpen(false)} destroyOnHidden width={640}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          {!editing && <Form.Item name="code" label="编码" rules={[{ required: true, pattern: /^[a-z_][a-z0-9_]*$/ }]}><Input /></Form.Item>}
          <Form.Item name="description" label="描述"><Input /></Form.Item>
          <Form.Item name="permissionCodes" label="权限" rules={[{ required: true, message: "请选择至少一项权限" }]}>
            <div>
              {CATEGORIES.map((cat) => {
                const items = grouped[cat.key] ?? [];
                return (
                  <div key={cat.key} style={{ marginBottom: 20 }}>
                    <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 10 }}>
                      <span style={{ marginRight: 6 }}>{cat.icon}</span>{cat.label}
                      {items.length > 0 && (
                        <Typography.Text type="secondary" style={{ fontSize: 12, marginLeft: 8, fontWeight: "normal" }}>
                          （已选 {items.filter((p) => selected.includes(p.code)).length} / {items.length}）
                        </Typography.Text>
                      )}
                    </Typography.Title>
                    {items.length === 0 ? (
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>该模块暂未配置权限项</Typography.Text>
                    ) : (
                      <Checkbox.Group
                        options={items.map((p) => ({ value: p.code, label: p.name }))}
                        value={selected}
                        onChange={(vals) => form.setFieldValue("permissionCodes", vals)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
