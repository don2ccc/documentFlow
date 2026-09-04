import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ApartmentOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { workshopsApi, WorkshopFlatItem, usersApi, UserItem, departmentsApi, DepartmentFlatItem } from '../../api/endpoints';

type FormValues = { name: string; departmentId?: string | null; parentId?: string | null; managerId?: string | null };

interface Row extends WorkshopFlatItem {
  parentName?: string;
  managerName?: string;
  departmentName?: string;
}

function errMsg(e: unknown, fallback: string): string {
  const x = e as { response?: { data?: { message?: string } } };
  return x?.response?.data?.message ?? fallback;
}

export function WorkshopsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentFlatItem[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form] = Form.useForm<FormValues>();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, userList, deptList] = await Promise.all([
        workshopsApi.list(),
        usersApi.list({ pageSize: 1000 }),
        departmentsApi.list()
      ]);
      const userMap = new Map((userList.items ?? []).map((u) => [u.id, u.name] as const));
      const nameMap = new Map(list.map((w) => [w.id, w.name] as const));
      const deptMap = new Map(deptList.map((d) => [d.id, d.name] as const));
      setDepartments(deptList);
      setRows(
        list.map((w) => ({
          ...w,
          parentName: w.parentId ? nameMap.get(w.parentId) ?? '-' : undefined,
          managerName: w.managerId ? userMap.get(w.managerId) ?? '-' : undefined,
          departmentName: w.departmentId ? deptMap.get(w.departmentId) ?? '-' : undefined
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
    form.setFieldsValue({ name: r.name, departmentId: r.departmentId ?? undefined, parentId: r.parentId ?? undefined, managerId: r.managerId ?? undefined });
    setOpen(true);
  };

  const submit = useCallback(async () => {
    let values: FormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    const payload = { name: values.name, parentId: values.parentId ?? null, managerId: values.managerId ?? null, departmentId: values.departmentId ?? null };
    setSubmitting(true);
    try {
      if (editing) await workshopsApi.update(editing.id, payload);
      else await workshopsApi.create(payload);
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
        await workshopsApi.remove(r.id);
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
      { title: '科室名称', dataIndex: 'name', key: 'name' },
      { title: '所属部门', dataIndex: 'departmentName', key: 'departmentName', render: (v?: string) => v ?? <Tag color="default">未指定</Tag> },
      { title: '上级科室', dataIndex: 'parentName', key: 'parentName', render: (v?: string) => v ?? <Tag color="default">顶级</Tag> },
      { title: '科室负责人', dataIndex: 'managerName', key: 'managerName', render: (v?: string) => v ?? '-' },
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
              title={`删除科室「${r.name}」？`}
              description="若该科室下仍有子科室或用户，将无法删除。"
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
            <span style={{ fontSize: 16, fontWeight: 600 }}>科室管理</span>
            <span style={{ color: '#64748b', fontSize: 13 }}>维护科室结构，支持多级科室与负责人</span>
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新建科室
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
          title={editing ? '编辑科室' : '新建科室'}
          open={open}
          onOk={submit}
          onCancel={() => setOpen(false)}
          confirmLoading={submitting}
          destroyOnHidden
          okText="确定"
          cancelText="取消"
        >
          <Form form={form} layout="vertical" preserve={false}>
            <Form.Item name="name" label="科室名称" rules={[{ required: true, message: '请输入科室名称' }]}>
              <Input placeholder="例如：研发一科" autoFocus />
            </Form.Item>
            <Form.Item name="departmentId" label="所属部门">
              <Select
                allowClear
                placeholder="不选表示暂不归属任何部门"
                options={departments.map((d) => ({ value: d.id, label: d.name }))}
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
            <Form.Item name="parentId" label="上级科室">
              <Select
                allowClear
                placeholder="不选表示顶级科室"
                options={rows
                  .filter((r) => r.id !== editing?.id)
                  .map((r) => ({ value: r.id, label: r.name }))}
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
            <Form.Item name="managerId" label="科室负责人">
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
