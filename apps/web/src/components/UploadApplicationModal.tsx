import { useEffect, useRef, useState } from 'react';
import { Button, Form, Input, Modal, Select, Space, Table, Tag, Upload, message } from 'antd';
import { DeleteOutlined, InboxOutlined } from '@ant-design/icons';
import { applicationsApi, categoriesApi, CategoryItem, workflowsApi, WorkflowItem } from '../api/endpoints';

export function UploadApplicationModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [form] = Form.useForm();
  // dedupe by File reference: antd's Upload.Dragger fires beforeUpload once per dropped file
  // and each call passes the full batch as `list`, which would double-count without a Set.
  const filesSetRef = useRef<Set<File>>(new Set());
  const [files, setFiles] = useState<File[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    filesSetRef.current = new Set();
    setFiles([]);
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
    for (const f of incoming) filesSetRef.current.add(f);
    setFiles(Array.from(filesSetRef.current));
  };

  const removeFile = (idx: number) => {
    const cur = Array.from(filesSetRef.current);
    const target = cur[idx];
    if (target) filesSetRef.current.delete(target);
    setFiles(Array.from(filesSetRef.current));
  };

  const submit = async () => {
    if (files.length === 0) {
      message.warning('请至少上传一个文件');
      return;
    }
    const values = await form.validateFields();
    setLoading(true);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append('files', f));
      fd.append('title', values.title.trim());
      if (values.description) fd.append('description', values.description);
      if (values.categoryId) fd.append('categoryId', values.categoryId);
      if (values.workflowId) fd.append('workflowId', values.workflowId);
      const result = await applicationsApi.create(fd);
      message.success(values.workflowId ? `已创建「${result.title}」并发起审批（共 ${result.fileCount} 个文件）` : `已创建「${result.title}」（共 ${result.fileCount} 个文件）`);
      onSuccess();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || '创建失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const fileColumns = [
    { title: '序号', width: 60, render: (_: unknown, _r: File, idx: number) => idx + 1 },
    { title: '文件名', dataIndex: 'name', render: (v: string) => <span title={v}>{v}</span> },
    { title: '大小', dataIndex: 'size', width: 110, render: (s: number) => s >= 1024 * 1024 ? `${(s / (1024 * 1024)).toFixed(1)} MB` : `${(s / 1024).toFixed(1)} KB` },
    {
      title: '操作',
      width: 80,
      render: (_: unknown, _r: File, idx: number) => (
        <Button size="small" type="link" danger icon={<DeleteOutlined />} onClick={() => removeFile(idx)}>移除</Button>
      )
    }
  ];

  const totalSize = files.reduce((s, f) => s + f.size, 0);

  return (
    <Modal
      title="新建申请项目"
      open={open}
      onOk={submit}
      onCancel={onClose}
      confirmLoading={loading}
      okText={loading ? '上传中...' : '创建并发起审批'}
      destroyOnHidden
      width={760}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="title"
          label="申请项目标题"
          rules={[{ required: true, message: '请输入申请项目标题' }, { max: 200, message: '标题不能超过 200 字' }]}
        >
          <Input placeholder="例如：DCC文件图纸审批报告" maxLength={200} showCount />
        </Form.Item>
        <Form.Item name="categoryId" label="分类">
          <Select allowClear options={categories.map((c) => ({ value: c.id, label: c.name }))} placeholder="选择分类" />
        </Form.Item>
        <Form.Item name="workflowId" label="审批流程" extra="选择后创建时自动发起审批；不选则作为草稿保存">
          <Select
            allowClear
            placeholder={workflows.length === 0 ? '暂无可用流程（请先在「流程配置」中启用至少一个）' : '选择审批流程（可选）'}
            options={workflows.map((w) => ({ value: w.id, label: w.name }))}
            notFoundContent={workflows.length === 0 ? '暂无可用流程' : '未找到'}
          />
        </Form.Item>
        <Form.Item name="description" label="说明">
          <Input.TextArea rows={2} placeholder="补充说明（适用于整个项目，可选）" maxLength={500} showCount />
        </Form.Item>
        <Form.Item
          label={
            <Space>
              <span>文件</span>
              {files.length > 0 && <Tag color="blue">{files.length} 个 · {(totalSize / 1024).toFixed(1)} KB</Tag>}
            </Space>
          }
          required
        >
          <Upload.Dragger
            multiple
            showUploadList={false}
            beforeUpload={(_f, list) => {
              if (list && list.length) onAddFiles(Array.from(list));
              return false;
            }}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif"
          >
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p className="ant-upload-text">点击或拖拽文件上传</p>
            <p className="ant-upload-hint">支持 PDF/Word/Excel/PPT/图片，单个文件不超过 20MB；可多选</p>
          </Upload.Dragger>
        </Form.Item>
        {files.length > 0 && (
          <Table
            rowKey={(_, idx) => String(idx)}
            size="small"
            pagination={false}
            columns={fileColumns}
            dataSource={files}
            style={{ marginTop: 8 }}
          />
        )}
      </Form>
    </Modal>
  );
}