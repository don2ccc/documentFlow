import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Form, Input, InputNumber, Modal, Space, Table, message } from 'antd';
import { categoriesApi, CategoryItem } from '../../api/endpoints';

export function CategoriesPage() {
  const [items, setItems] = useState<CategoryItem[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryItem | null>(null);
  const [form] = Form.useForm();

  const load = useCallback(async () => setItems(await categoriesApi.list()), []);
  useEffect(() => { load(); }, [load]);

  const openEdit = (c?: CategoryItem) => {
    setEditing(c ?? null);
    form.resetFields();
    if (c) form.setFieldsValue(c);
    setOpen(true);
  };

  const save = async () => {
    const values = await form.validateFields();
    if (editing) await categoriesApi.update(editing.id, values);
    else await categoriesApi.create(values);
    message.success('已保存');
    setOpen(false);
    load();
  };

  return (
    <Card title="分类管理" extra={<Button type="primary" onClick={() => openEdit()}>新建分类</Button>}>
      <Table
        rowKey="id"
        dataSource={items}
        columns={[
          { title: '名称', dataIndex: 'name' },
          { title: '排序', dataIndex: 'sortOrder', width: 100 },
          {
            title: '操作',
            render: (_: unknown, r: CategoryItem) => (
              <Space>
                <Button size="small" type="link" onClick={() => openEdit(r)}>编辑</Button>
                <Button size="small" type="link" danger onClick={async () => { await categoriesApi.remove(r.id); load(); }}>删除</Button>
              </Space>
            )
          }
        ]}
      />
      <Modal title={editing ? '编辑分类' : '新建分类'} open={open} onOk={save} onCancel={() => setOpen(false)} destroyOnHidden>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="sortOrder" label="排序"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}