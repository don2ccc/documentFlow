import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Checkbox, Form, Input, Modal, Space, Table, Typography, message } from "antd";
import { ApartmentOutlined, BankOutlined, IdcardOutlined, SettingOutlined, ToolOutlined, WarningOutlined } from "@ant-design/icons";
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

/**
 * 已废弃的一级菜单「可见性」权限（menu:*）。
 *
 * 这些权限曾经想控制侧边栏的显示，但 AppLayout 从来没有读过它们 ——
 * 菜单实际是按子权限（如 user:manage / hr:view）显隐的，
 * 于是角色编辑里的「可见」开关形同虚设，唯一作用是「取消勾选会清空该组子权限」。
 *
 * 现在去掉该开关，并删除这批权限（见 migrations/004）。
 * 这里保留常量仅用于过滤：万一库里还有残留的 menu:* 记录，
 * 不要把它们当作可编辑的子权限暴露出来。
 */
const LEGACY_MENU_CODES = CATEGORIES.map((c) => `menu:${c.key}`);

// 按一级菜单分类的权限映射。
// 新增权限时必须在这里登记，否则会落进「未分类」分组（见 UNMAPPED_KEY）。
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
  "dormitory:manage": "admin",
  "hr:view": "hr",
  "hr:manage": "hr"
};

/**
 * 兜底分组的 key。
 *
 * 原来未登记的权限会静默落进「系统管理」，导致 HR 员工档案的 hr:view / hr:manage
 * 被显示在系统管理下面，管理员在错误的分组里配权限。改成显式暴露「未分类」。
 */
const UNMAPPED_KEY = "__unmapped";

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
    out[UNMAPPED_KEY] = [];
    for (const p of perms) {
      // 跳过已废弃的 menu:* 权限，它们不该出现在可编辑的子权限里
      if (LEGACY_MENU_CODES.includes(p.code)) continue;
      const cat = PERM_CATEGORY[p.code];
      if (cat && out[cat]) out[cat].push(p);
      else out[UNMAPPED_KEY].push(p);
    }
    return out;
  }, [perms]);

  const selected: string[] = (Form.useWatch("permissionCodes", form) as string[] | undefined) ?? [];

  // 子权限变化：直接用该组的新选择替换旧选择
  const onSubChange = (catKey: string, subSelected: Array<string | number | boolean>) => {
    const subCodes = (grouped[catKey] ?? []).map((p) => p.code);
    const current: string[] = form.getFieldValue("permissionCodes") ?? [];
    const others = current.filter((c) => !subCodes.includes(c));
    const next = [...others, ...(subSelected as string[])];
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

  // 统计：已勾选的子权限总数
  const subPermCount = selected.filter((c) => !LEGACY_MENU_CODES.includes(c)).length;

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
            extra="勾选该角色可用的权限。菜单会按所勾选的权限自动显示：某菜单下一项都没勾时不会出现在侧边栏。"
          >
            <input type="hidden" />
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {CATEGORIES.map((cat) => {
                const items = grouped[cat.key] ?? [];
                const subPicked = items.filter((p) => selected.includes(p.code)).length;
                return (
                  <div
                    key={cat.key}
                    style={{
                      border: "1px solid " + (subPicked > 0 ? "#f36b21" : "#e5e7eb"),
                      borderRadius: 8,
                      background: subPicked > 0 ? "#fff7f0" : "#fafafa",
                      padding: "10px 12px"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: items.length > 0 ? 8 : 0 }}>
                      <span style={{ color: subPicked > 0 ? "#f36b21" : "#94a3b8" }}>{cat.icon}</span>
                      <Typography.Text strong style={{ fontSize: 14 }}>{cat.label}</Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {items.length > 0 ? `（${subPicked} / ${items.length}）` : "（暂无权限项）"}
                      </Typography.Text>
                    </div>
                    {items.length > 0 && (
                      <div>
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
              {grouped[UNMAPPED_KEY]?.length > 0 && (
                <div
                  style={{
                    border: "1px solid #f59e0b",
                    borderRadius: 8,
                    background: "#fffbeb",
                    padding: "10px 12px"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <WarningOutlined style={{ color: "#f59e0b" }} />
                    <Typography.Text strong style={{ fontSize: 14 }}>未分类权限</Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      （{grouped[UNMAPPED_KEY].length} 项）
                    </Typography.Text>
                  </div>
                  <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 8 }}>
                    以下权限尚未归入任何一级菜单分组，通常是新增权限时忘记在 RolesPage 的
                    PERM_CATEGORY 中登记，请联系管理员处理。
                  </Typography.Paragraph>
                  <Checkbox.Group
                    value={grouped[UNMAPPED_KEY].filter((p) => selected.includes(p.code)).map((p) => p.code)}
                    onChange={(vals) => onSubChange(UNMAPPED_KEY, vals)}
                  >
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "4px 16px" }}>
                      {grouped[UNMAPPED_KEY].map((p) => (
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
          </Form.Item>
          <Alert
            showIcon
            type="info"
            message={`已勾选 ${subPermCount} 项权限`}
            style={{ marginTop: -8 }}
          />
        </Form>
      </Modal>
    </Card>
  );
}
// build: invalidate cached bundle

