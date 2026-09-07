import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, App, Button, Card, Popconfirm, Space, Typography, Upload } from 'antd';
import { DeleteOutlined, EditOutlined, FileImageOutlined, UploadOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { signaturesApi, UserSignatureInfo } from '../api/endpoints';

function formatBytes(n?: number) {
  if (!n) return '-';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(2) + ' MB';
}

export function MySignaturePage() {
  const { message } = App.useApp();
  const [info, setInfo] = useState<UserSignatureInfo | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const previewUrlRef = useRef<string | null>(null);

  const revokePreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    revokePreview();
    try {
      const [meta, blob] = await Promise.all([signaturesApi.get(), signaturesApi.fetchBlob()]);
      setInfo(meta);
      if (blob) {
        const url = URL.createObjectURL(blob.blob);
        previewUrlRef.current = url;
        setPreviewUrl(url);
      }
    } catch (e: any) {
      message.error(e?.response?.data?.message || '加载签章失败');
    } finally {
      setLoading(false);
    }
  }, [message, revokePreview]);

  useEffect(() => {
    load();
    return () => { revokePreview(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uploadProps: UploadProps = useMemo(() => ({
    accept: 'image/png,image/jpeg',
    multiple: false,
    showUploadList: false,
    beforeUpload: async (file) => {
      if (!/^image\/(png|jpe?g)$/i.test(file.type)) {
        message.error('仅支持 PNG / JPG 图片');
        return Upload.LIST_IGNORE;
      }
      if (file.size > 2 * 1024 * 1024) {
        message.error('图片不能超过 2MB');
        return Upload.LIST_IGNORE;
      }
      setUploading(true);
      try {
        await signaturesApi.upload(file);
        message.success('签章已保存，下次审批即可使用');
        await load();
      } catch (e: any) {
        message.error(e?.response?.data?.message || '上传失败');
      } finally {
        setUploading(false);
      }
      return false; // prevent antd default upload
    }
  }), [load, message]);

  const onDelete = async () => {
    try {
      await signaturesApi.remove();
      message.success('已删除');
      await load();
    } catch (e: any) {
      message.error(e?.response?.data?.message || '删除失败');
    }
  };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <Card
        title={<Space><EditOutlined /> 我的签章</Space>}
        extra={info?.hasSignature ? (
          <Popconfirm
            title="确认删除我的签章？"
            description="删除后审批将自动改用系统公章。"
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={onDelete}
          >
            <Button danger icon={<DeleteOutlined />}>删除签章</Button>
          </Popconfirm>
        ) : null}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="个人签章说明"
          description={
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>上传一张 PNG 或 JPG 图片作为你的个人签章，建议使用透明背景。</li>
              <li>签章文件最大 2MB；上传后立即生效，下一次作为终审人时即可使用。</li>
              <li>审批流程中<strong>可选</strong>使用：上传后默认使用个人签章，若图片无法嵌入会自动改用系统公章。</li>
              <li>可以随时重新上传或删除，重新上传会替换之前的签章。</li>
            </ul>
          }
        />

        <div style={{
          display: 'flex',
          gap: 24,
          alignItems: 'flex-start',
          flexWrap: 'wrap'
        }}>
          <div style={{
            width: 260,
            minHeight: 160,
            border: '1px dashed #d9d9d9',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: previewUrl ? '#fafafa' : '#fafafa',
            padding: 8,
            position: 'relative'
          }}>
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="签名预览"
                style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain' }}
              />
            ) : (
              <Typography.Text type="secondary">
                {loading ? '加载中…' : '尚未上传签章'}
              </Typography.Text>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 240 }}>
            {info?.hasSignature ? (
              <div style={{ marginBottom: 16 }}>
                <Typography.Text type="secondary">当前签章</Typography.Text>
                <div style={{ marginTop: 6 }}>
                  <FileImageOutlined /> {info.fileName}
                </div>
                <div style={{ marginTop: 4, color: 'rgba(0,0,0,0.45)', fontSize: 12 }}>
                  类型：{info.mimeType || '-'}　大小：{formatBytes(info.size)}　上传于：{info.createdAt ? new Date(info.createdAt).toLocaleString() : '-'}
                </div>
              </div>
            ) : (
              <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
                尚未上传个人签章。
              </Typography.Paragraph>
            )}

            <Upload {...uploadProps}>
              <Button type="primary" icon={<UploadOutlined />} loading={uploading}>
                {info?.hasSignature ? '重新上传签章' : '上传我的签章'}
              </Button>
            </Upload>
            <div style={{ marginTop: 8, color: 'rgba(0,0,0,0.45)', fontSize: 12 }}>
              支持 PNG / JPG，最大 2MB。建议尺寸 400×400 左右，透明背景效果更佳。
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}