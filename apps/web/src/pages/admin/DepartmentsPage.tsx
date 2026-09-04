import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ApartmentOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { departmentsApi, DepartmentFlatItem, usersApi, UserItem } from '../../api/endpoints';

type FormValues = { name: string; parentId?: string | null; managerId?: string | null };

interface Row extends DepartmentFlatItem {
  parentName?: string;
  managerName?: string;
}

function errMsg(e: unknown, fallback: string): string {
  const x = e as { response?: { data?: { message?: string } } };
  return x?.response?.data?.message ?? fallback;
}

export function DepartmentsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form] = Form.useForm<FormValues>();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, userList] = await Promise.all([departmentsApi.list(), usersApi.list({ pageSize: 1000 })]);
      const userMap = new Map((userList.items ?? []).map((u) => [u.id, u.name] as const));
      const nameMap = new Map(list.map((d) => [d.id, d.name] as const));
      setRows(
        list.map((d) => ({
          ...d,
          parentName: d.parentId ? nameMap.get(d.parentId) ?? '-' : undefined,
          managerName: d.managerId ? userMap.get(d.managerId) ?? '-' : undefined
        }))
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    usersApi.list({ pageSize: 1000 }).then((p) => setUsers(p.items ?? [])).catch(() => undefined);
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setOpen(true);
  };

  const openEdit = (r: Row) => {
    setEditing(r);
    form.resetFields();
    form.setFieldsValue({ name: r.name, parentId: r.parentId ?? undefined, managerId: r.managerId ?? undefined });
    setOpen(true);
  };

  const submit = useCallback(async () => {
    let values: FormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    const payload = { name: values.name, parentId: values.parentId ?? null, managerId: values.managerId ?? null };
    setSubmitting(true);
    try {
      if (editing) await departmentsApi.update(editing.id, payload);
      else await departmentsApi.create(payload);
      messageApi.success(editing ? '已保存' : '已创建');
      setOpen(false);
      load();
    } catch (e: unknown) {
      messageApi.error(errMsg(e, '保存失败'));
    } finally {
      setSubmitting(false);
    }
  }, [editing, form, load, messageApi]);

  const remove = useCallback(
    async (r: Row) => {
      try {
        await departmentsApi.remove(r.id);
        messageApi.success('已删除');
        load();
      } catch (e: unknown) {
        messageApi.error(errMsg(e, '删除失败'));
      }
    },
    [load, messageApi]
  );

  const columns: ColumnsType<Row> = useMemo(
    () => [
      { title: '部门名称', dataIndex: 'name', key: 'name' },
      { title: '上级部门', dataIndex: 'parentName', key: 'parentName', render: (v?: string) => v ?? <Tag color="default">顶级</Tag> },
      { title: '部门负责人', dataIndex: 'managerName', key: 'managerName', render: (v?: string) => v ?? '-' },
      {
        title: '操作',
        key: 'actions',
        width: 180,
        render: (_: unknown, r: Row) => (
          <Space>
            <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openEdit(r)}>
              编辑
            </Button>
            <Popconfirm
              title={`删除部门「${r.name}」？`}
              description="若该部门下仍有用户，将解除这些用户的部门关联后删除。"
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              onConfirm={() => remove(r)}
            >
              <Button size="small" type="link" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        )
      }
    ],
    [remove]
  );

  return (
    <>
      {contextHolder}
      <div style={{ padding: 16 }}>
        <div
          style={{
            background: '#fff',
            padding: '12px 16px',
            borderRadius: 8,
            marginBottom: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            border: '1px solid #e5e7eb'
          }}
        >
          <Space>
            <ApartmentOutlined style={{ fontSize: 18, color: '#1677ff' }} />
            <span style={{ fontSize: 16, fontWeight: 600 }}>部门管理</span>
            <span style={{ color: '#64748b', fontSize: 13 }}>维护组织结构，支持多级部门与负责人</span>
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新建部门
          </Button>
        </div>
        <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #e5e7eb' }}>
          <Table<Row>
            rowKey="id"
            loading={loading}
            dataSource={rows}
            columns={columns}
            pagination={{ pageSize: 20, showSizeChanger: true }}
          />
        </div>
        <Modal
          title={editing ? '编辑部门' : '新建部门'}
          open={open}
          onOk={submit}
          onCancel={() => setOpen(false)}
          confirmLoading={submitting}
          destroyOnHidden
          okText="确定"
          cancelText="取消"
        >
          <Form form={form} layout="vertical" preserve={false}>
            <Form.Item name="name" label="部门名称" rules={[{ required: true, message: '请输入部门名称' }]}>
              <Input placeholder="例如：研发部" autoFocus />
            </Form.Item>
            <Form.Item name="parentId" label="上级部门">
              <Select
                allowClear
                placeholder="不选表示顶级部门"
                options={rows
                  .filter((r) => r.id !== editing?.id)
                  .map((r) => ({ value: r.id, label: r.name }))}
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
            <Form.Item name="managerId" label="部门负责人">
              <Select
                allowClear
                placeholder="可不指定"
                options={users.map((u) => ({ value: u.id, label: `${u.name} (${u.username})` }))}
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </>
  );
}
