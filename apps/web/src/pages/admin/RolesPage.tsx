import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Checkbox, Form, Input, Modal, Space, Table, Typography, message } from "antd";
import { ApartmentOutlined, BankOutlined, IdcardOutlined, SettingOutlined, ToolOutlined } from "@ant-design/icons";
import { PermissionItem, rolesApi, RoleItem } from "../../api/endpoints";

interface CategoryDef {
  key: string;
  label: string;
  icon: React.ReactNode;
}

// permission categories for the roles page
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

export function RolesPage() {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [perms, setPerms] = useState<PermissionItem[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RoleItem | null>(null);
  const [saving, setSaving] = useState(false);
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
    if (r) {
      form.setFieldsValue({
        name: r.name,
        description: r.description ?? "",
        permissionCodes: r.permissions.map((p) => p.code)
      });
    }
    setOpen(true);
  };

  const grouped = useMemo(() => {
    const out: Record<string, PermissionItem[]> = {};
    for (const c of CATEGORIES) out[c.key] = [];
    for (const p of perms) {
      const cat = PERM_CATEGORY[p.code] ?? "system";
      if (!out[cat]) out[cat] = [];
      out[cat].push(p);
    }
    return out;
  }, [perms]);

  const selected: string[] = (Form.useWatch("permissionCodes", form) as string[] | undefined) ?? [];

  const save = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      if (editing) await rolesApi.update(editing.id, values);
      else await rolesApi.create(values);
      message.success("已保存");
      setOpen(false);
      load();
    } catch (e: any) {
      if (e?.errorFields) return; // 表单校验失败，Antd 已展示
      const msg = e?.response?.data?.message ?? e?.message ?? "保存失败";
      message.error(msg);
    } finally {
      setSaving(false);
    }
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

  return (
    <Card title="角色管理" extra={<Button type="primary" onClick={() => openEdit()}>新建角色</Button>}>
      <Table rowKey="id" columns={columns} dataSource={roles} pagination={{ pageSize: 10 }} />
      <Modal
        title={editing ? "编辑角色" : "新建角色"}
        open={open}
        onOk={save}
        onCancel={() => setOpen(false)}
        confirmLoading={saving}
        destroyOnHidden
        width={720}
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: "请输入角色名称" }]}>
            <Input placeholder="例如：审批人" />
          </Form.Item>
          {!editing && (
            <Form.Item name="code" label="编码" rules={[{ required: true, pattern: /^[a-z_][a-z0-9_]*$/, message: "编码只能包含小写字母、数字和下划线" }]}>
              <Input placeholder="例如 approver" />
            </Form.Item>
          )}
          <Form.Item name="description" label="描述">
            <Input placeholder="可选：说明该角色的用途" />
          </Form.Item>
          <Form.Item
            name="permissionCodes"
            label="权限"
            rules={[{ required: true, message: "请至少勾选一项权限" }]}
          >
            <Checkbox.Group>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {CATEGORIES.map((cat) => {
                  const items = grouped[cat.key] ?? [];
                  const picked = items.filter((p) => selected.includes(p.code)).length;
                  return (
                    <div key={cat.key}>
                      <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
                        <span style={{ marginRight: 6 }}>{cat.icon}</span>{cat.label}
                        <Typography.Text type="secondary" style={{ fontSize: 12, marginLeft: 8, fontWeight: "normal" }}>
                          （已选 {picked} / {items.length || 0}）
                        </Typography.Text>
                      </Typography.Title>
                      {items.length === 0 ? (
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          该模块暂未配置权限项
                        </Typography.Text>
                      ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "4px 16px" }}>
                          {items.map((p) => (
                            <Checkbox key={p.id} value={p.code}>
                              <span>{p.name}</span>
                              <Typography.Text type="secondary" style={{ fontSize: 12, marginLeft: 6 }}>
                                {p.code}
                              </Typography.Text>
                            </Checkbox>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Checkbox.Group>
          </Form.Item>
          <Alert
            showIcon
            type="info"
            message={`当前共勾选 ${selected.length} 项权限`}
            style={{ marginTop: -8 }}
          />
        </Form>
      </Modal>
    </Card>
  );
}
// build: invalidate cached bundle
