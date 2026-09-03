import { useEffect, useState } from 'react';
import { Alert, Button, Form, Input, Modal, Popconfirm, Select, Space, Table, Upload, message } from 'antd';
import { DeleteOutlined, InboxOutlined, PlusOutlined } from '@ant-design/icons';
import { categoriesApi, CategoryItem, documentsApi, workflowsApi, WorkflowItem } from '../api/endpoints';

type Item = { key: string; file: File; title: string };

const stripExt = (name: string) => name.replace(/\.[^./\\]+$/, '');

export function UploadDocumentModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [form] = Form.useForm();
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; failed: { name: string; msg: string }[] }>({ done: 0, failed: [] });

  useEffect(() => {
    if (!open) return;
    setItems([]);
    setProgress({ done: 0, failed: [] });
    form.resetFields();
    Promise.all([
      categoriesApi.list().catch(() => []),
      workflowsApi.list().catch(() => [])
    ]).then(([cats, wfs]) => {
      setCategories(cats);
      setWorkflows((wfs as WorkflowItem[]).filter((w) => w.status === 'active'));
    });
  }, [open, form]);

  const onAddFiles = (incoming: File[]) => {
    const next = incoming.map((f) => ({
      key: `${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
      file: f,
      title: stripExt(f.name)
    }));
    setItems((prev) => [...prev, ...next]);
  };

  const updateTitle = (key: string, title: string) => {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, title } : it)));
  };

  const removeItem = (key: string) => {
    setItems((prev) => prev.filter((it) => it.key !== key));
  };

  const submit = async () => {
    if (items.length === 0) {
      message.warning('请选择至少一个文件');
      return;
    }
    const values = await form.validateFields();
    setLoading(true);
    setProgress({ done: 0, failed: [] });
    let failed: { name: string; msg: string }[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      try {
        const fd = new FormData();
        fd.append('file', it.file);
        fd.append('title', it.title.trim() || it.file.name);
        if (values.categoryId) fd.append('categoryId', values.categoryId);
        if (values.description) fd.append('description', values.description);
        if (values.workflowId) fd.append('workflowId', values.workflowId);
        await documentsApi.upload(fd);
      } catch (e: any) {
        const msg = e?.response?.data?.message || e?.message || '上传失败';
        failed.push({ name: it.file.name, msg });
      }
      setProgress({ done: i + 1, failed });
    }
    setLoading(false);
    if (failed.length === 0) {
      message.success(values.workflowId ? `已上传 ${items.length} 份文档并发起审批` : `已上传 ${items.length} 份文档`);
      onSuccess();
    } else {
      message.warning(`完成 ${items.length - failed.length}/${items.length}，有 ${failed.length} 份失败`);
      // 部分失败：仅关闭不刷新列表，让用户看到失败明细。
    }
  };

  const columns = [
    { title: '文件', dataIndex: 'file', width: 220, render: (_: unknown, r: Item) => <span title={r.file.name}>{r.file.name}</span> },
    {
      title: '标题',
      dataIndex: 'title',
      render: (_: unknown, r: Item) => (
        <Input
          value={r.title}
          placeholder='文档标题'
          onChange={(e) => updateTitle(r.key, e.target.value)}
        />
      )
    },
    { title: '大小', dataIndex: ['file', 'size'], width: 90, render: (s: number) => `${(s / 1024).toFixed(1)} KB` },
    {
      title: '操作',
      width: 80,
      render: (_: unknown, r: Item) => (
        <Popconfirm title='确认移除?' onConfirm={() => removeItem(r.key)} okText='移除' cancelText='取消'>
          <Button size='small' type='link' danger icon={<DeleteOutlined />}>移除</Button>
        </Popconfirm>
      )
    }
  ];

  const totalSize = items.reduce((s, it) => s + it.file.size, 0);

  return (
    <Modal
      title={`上传新文档${items.length ? ` · 已选 ${items.length} 件` : ''}`}
      open={open}
      onOk={submit}
      onCancel={onClose}
      confirmLoading={loading}
      okText={loading ? `上传中 ${progress.done}/${items.length}` : '上传并发起审批'}
      destroyOnHidden
      width={760}
    >
      <Form form={form} layout='vertical'>
          <Form.Item name='categoryId' label='分类'>
            <Select allowClear options={categories.map((c) => ({ value: c.id, label: c.name }))} placeholder='选择分类' />
          </Form.Item>
          <Form.Item name='workflowId' label='审批流程' extra='选择后上传完业会自动发起审批；不选则仅作为草稿保存'>
            <Select
              allowClear
              placeholder={workflows.length === 0 ? '暂无可用流程（请先在「流程配置」中启用至少一个）' : '选择审批流程（可选）'}
              options={workflows.map((w) => ({ value: w.id, label: w.name }))}
              notFoundContent={workflows.length === 0 ? '暂无可用流程' : '未找到'}
            />
          </Form.Item>
          <Form.Item name='description' label='说明'>
            <Input.TextArea rows={2} placeholder='补充说明（适用于所有文档，可选）' />
          </Form.Item>
          <Form.Item label={`文件（可选多个，总计 ${items.length} 件 · ${(totalSize / 1024).toFixed(1)} KB）`} required>
            <Upload.Dragger
              multiple
              showUploadList={false}
              beforeUpload={(f, list) => {
                onAddFiles(list && list.length ? list : [f]);
                return false;
              }}
              accept='.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif'
            >
              <p className='ant-upload-drag-icon'><InboxOutlined /></p>
              <p className='ant-upload-text'>点击或拖拽文件上传</p>
              <p className='ant-upload-hint'>支持 PDF/Word/Excel/PPT/图片，单个文件不超过 20MB；可多选</p>
            </Upload.Dragger>
          </Form.Item>
          {items.length > 0 && (
            <Table
              rowKey='key'
              size='small'
              pagination={false}
              columns={columns}
              dataSource={items}
              style={{ marginTop: 8 }}
            />
          )}
          {progress.failed.length > 0 && (
            <Alert
              style={{ marginTop: 12 }}
              type='error'
              message={`以下 ${progress.failed.length} 份文件上传失败`}
              description={
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {progress.failed.map((f, i) => (
                    <li key={i}>{f.name}：{f.msg}</li>
                  ))}
                </ul>
              }
            />
          )}
        </Form>
      </Modal>
  );
}
