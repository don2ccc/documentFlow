import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Checkbox, Form, Input, Modal, Space, Table, Typography, message } from "antd";
import { ApartmentOutlined, BankOutlined, IdcardOutlined, SettingOutlined, ToolOutlined, EyeInvisibleOutlined, EyeOutlined } from "@ant-design/icons";
import { PermissionItem, rolesApi, RoleItem } from "../../api/endpoints";

interface CategoryDef {
  key: string;
  label: string;
  icon: React.ReactNode;
}

// 一级菜单与权限分组的对应关系（5 个一级菜单）
const CATEGORIES: CategoryDef[] = [
  { key: "workflow", label: "WorkFlow管理", icon: <ApartmentOutlined /> },
  { key: "admin", label: "行政管理", icon: <BankOutlined /> },
  { key: "production", label: "生产管理", icon: <ToolOutlined /> },
  { key: "hr", label: "HR管理", icon: <IdcardOutlined /> },
  { key: "system", label: "系统管理", icon: <SettingOutlined /> }
];

// 一级菜单可见性权限码（与后端 seed.ts 的 menu:* 一致）
const MENU_VISIBILITY_CODES = CATEGORIES.map((c) => `menu:${c.key}`);

// 按一级菜单分类的权限映射
const PERM_CATEGORY: Record<string, string> = {
  "document:upload": "workflow",
  "document:preview": "workflow",
  "document:download": "workflow",
  "application:query": "workflow",
  "application:query:all": "workflow",
  "application:query:department": "workflow",
  "application:query:self": "workflow",
  "approval:handle": "workflow",
  "dashboard:view": "workflow",
  "user:manage": "system",
  "role:manage": "system",
  "category:manage": "system",
  "workflow:manage": "system",
  "audit:view": "system",
  "setting:manage": "system",
  "database:manage": "system",
  "department:manage": "system",
  "workshop:manage": "system",
  "dormitory:manage": "admin"
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
      // 跳过 menu:* 可见性权限，它们只通过分类标题控制
      if (MENU_VISIBILITY_CODES.includes(p.code)) continue;
      const cat = PERM_CATEGORY[p.code] ?? "system";
      if (!out[cat]) out[cat] = [];
      out[cat].push(p);
    }
    return out;
  }, [perms]);

  const selected: string[] = (Form.useWatch("permissionCodes", form) as string[] | undefined) ?? [];

  // 切换一级菜单可见性
  const toggleVisible = (catKey: string, checked: boolean) => {
    const menuCode = `menu:${catKey}`;
    const subCodes = (grouped[catKey] ?? []).map((p) => p.code);
    const current: string[] = form.getFieldValue("permissionCodes") ?? [];
    if (checked) {
      const next = Array.from(new Set([...current, menuCode]));
      form.setFieldsValue({ permissionCodes: next });
    } else {
      // 取消可见：同时清空该分类下的所有子权限
      const next = current.filter((c) => c !== menuCode && !subCodes.includes(c));
      form.setFieldsValue({ permissionCodes: next });
    }
  };

  // 子权限变化
  const onSubChange = (catKey: string, subSelected: Array<string | number | boolean>) => {
    const menuCode = `menu:${catKey}`;
    const subCodes = (grouped[catKey] ?? []).map((p) => p.code);
    const current: string[] = form.getFieldValue("permissionCodes") ?? [];
    const others = current.filter((c) => !subCodes.includes(c) && c !== menuCode);
    const next = [...others, ...(subSelected as string[])];
    // 勾选任一子项时，自动勾上一级菜单可见性
    if (subSelected.length > 0 && !next.includes(menuCode)) next.push(menuCode);
    form.setFieldsValue({ permissionCodes: Array.from(new Set(next)) });
  };

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

  // 统计：可见的一级菜单数 + 子权限数
  const visibleMenuCount = MENU_VISIBILITY_CODES.filter((c) => selected.includes(c)).length;
  const subPermCount = selected.filter((c) => !MENU_VISIBILITY_CODES.includes(c)).length;

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
        width={760}
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
            rules={[{ required: true, message: "请至少勾选一项" }]}
            extra="勾选一级菜单的「可见」后，该菜单才会对用户显示。取消勾选会同时清空该菜单下的子权限。"
          >
            <input type="hidden" />
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {CATEGORIES.map((cat) => {
                const items = grouped[cat.key] ?? [];
                const menuCode = `menu:${cat.key}`;
                const visible = selected.includes(menuCode);
                const subPicked = items.filter((p) => selected.includes(p.code)).length;
                return (
                  <div
                    key={cat.key}
                    style={{
                      border: "1px solid " + (visible ? "#f36b21" : "#e5e7eb"),
                      borderRadius: 8,
                      background: visible ? "#fff7f0" : "#fafafa",
                      padding: "10px 12px"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: visible && items.length > 0 ? 8 : 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ color: visible ? "#f36b21" : "#94a3b8" }}>{cat.icon}</span>
                        <Typography.Text strong style={{ fontSize: 14 }}>{cat.label}</Typography.Text>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {items.length > 0 ? `（子权限 ${subPicked} / ${items.length}）` : "（占位模块，暂无子权限）"}
                        </Typography.Text>
                      </div>
                      <Checkbox
                        checked={visible}
                        onChange={(e) => toggleVisible(cat.key, e.target.checked)}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          {visible ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                          可见
                        </span>
                      </Checkbox>
                    </div>
                    {items.length > 0 && (
                      <div
                        style={{
                          opacity: visible ? 1 : 0.45,
                          pointerEvents: visible ? "auto" : "none",
                          transition: "opacity 0.15s"
                        }}
                      >
                        <Checkbox.Group
                          value={items.filter((p) => selected.includes(p.code)).map((p) => p.code)}
                          onChange={(vals) => onSubChange(cat.key, vals)}
                        >
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
                        </Checkbox.Group>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Form.Item>
          <Alert
            showIcon
            type="info"
            message={`已勾选 ${visibleMenuCount} 个一级菜单，子权限 ${subPermCount} 项`}
            style={{ marginTop: -8 }}
          />
        </Form>
      </Modal>
    </Card>
  );
}
// build: invalidate cached bundle

