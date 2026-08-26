import { useEffect, useState } from 'react';
import { Form, Input, InputNumber, Modal, Select, Upload, message } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { categoriesApi, CategoryItem, documentsApi } from '../api/endpoints';

export function UploadDocumentModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [form] = Form.useForm();
  const [file, setFile] = useState<File | null>(null);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) categoriesApi.list().then(setCategories).catch(() => undefined);
  }, [open]);

  const submit = async () => {
    const values = await form.validateFields();
    if (!file) {
      message.warning('请选择文件');
      return;
    }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('title', values.title);
    if (values.categoryId) fd.append('categoryId', values.categoryId);
    if (values.description) fd.append('description', values.description);
    if (values.amount != null) fd.append('amount', String(values.amount));
    setLoading(true);
    try {
      await documentsApi.upload(fd);
      message.success('上传成功');
      form.resetFields();
      setFile(null);
      onSuccess();
    } catch {
      message.error('上传失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="上传新文档" open={open} onOk={submit} onCancel={onClose} confirmLoading={loading} destroyOnHidden>
      <Form form={form} layout="vertical">
        <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
          <Input placeholder="文档标题" />
        </Form.Item>
        <Form.Item name="categoryId" label="分类">
          <Select allowClear options={categories.map((c) => ({ value: c.id, label: c.name }))} placeholder="选择分类" />
        </Form.Item>
        <Form.Item name="amount" label="金额（元）">
          <InputNumber style={{ width: '100%' }} min={0} />
        </Form.Item>
        <Form.Item name="description" label="说明">
          <Input.TextArea rows={3} placeholder="补充说明（可选）" />
        </Form.Item>
        <Form.Item label="文件" required>
          <Upload.Dragger
            beforeUpload={(f) => {
              setFile(f);
              return false;
            }}
            maxCount={1}
            fileList={file ? [{ uid: '-1', name: file.name, status: 'done' }] : []}
            onRemove={() => setFile(null)}
          >
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p className="ant-upload-text">点击或拖拽文件上传</p>
            <p className="ant-upload-hint">支持 PDF/Word/Excel/PPT/图片，单个文件不超过 20MB</p>
          </Upload.Dragger>
        </Form.Item>
      </Form>
    </Modal>
  );
}