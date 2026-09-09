import { useCallback, useEffect, useState } from 'react';
import React from 'react';
import { Button, Card, Col, Descriptions, Input, Modal, Row, Select, Space, Spin, Table, Tag, message } from 'antd';
import { DownloadOutlined, EyeOutlined } from '@ant-design/icons';
import { Document, Page, pdfjs } from 'react-pdf';
import { useLocation, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { OfficePreview } from '../components/OfficePreview';
import { applicationsApi, ApplicationDetail, ApprovalTaskAccess, approvalsApi, UserItem, usersApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { ApprovalTimeline } from '../components/ApprovalTimeline';
import { StatusTag } from '../components/StatusTag';
import { formatDateMinute, formatDateTime } from '../utils/datetime';



pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();


const MIME_TYPE_LABEL: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.ms-excel': 'XLS',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'application/vnd.ms-powerpoint': 'PPT',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
  'application/vnd.oasis.opendocument.text': 'ODT',
  'application/vnd.oasis.opendocument.spreadsheet': 'ODS',
  'application/vnd.oasis.opendocument.presentation': 'ODP',
  'application/rtf': 'RTF',
  'application/zip': 'ZIP',
  'application/x-rar-compressed': 'RAR',
  'application/x-7z-compressed': '7Z',
  'application/x-tar': 'TAR',
  'application/gzip': 'GZ',
  'application/json': 'JSON',
  'application/xml': 'XML',
  'application/octet-stream': 'BIN',
  'text/plain': 'TXT',
  'text/csv': 'CSV',
  'text/html': 'HTML',
  'text/xml': 'XML',
  'text/markdown': 'MD',
  'text/x-markdown': 'MD',
  'image/png': 'PNG',
  'image/jpeg': 'JPG',
  'image/gif': 'GIF',
  'image/bmp': 'BMP',
  'image/webp': 'WEBP',
  'image/svg+xml': 'SVG',
  'image/tiff': 'TIFF',
  'video/mp4': 'MP4',
  'video/quicktime': 'MOV',
  'video/x-msvideo': 'AVI',
  'video/x-matroska': 'MKV',
  'audio/mpeg': 'MP3',
  'audio/wav': 'WAV',
  'audio/ogg': 'OGG',
  'audio/flac': 'FLAC',
  'audio/aac': 'AAC',
};

function formatFileType(mimeType: string, fileName: string): string {
  if (mimeType && MIME_TYPE_LABEL[mimeType.toLowerCase()]) {
    return MIME_TYPE_LABEL[mimeType.toLowerCase()];
  }
  const ext = (fileName || '').split('.').pop();
  if (ext && ext.length <= 5 && /^[a-zA-Z0-9]+$/.test(ext)) {
    return ext.toUpperCase();
  }
  return mimeType || '-';
}

export function ApplicationDetailPage() {
  const { id } = useParams();
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<ApplicationDetail['progress']>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTarget, setPreviewTarget] = useState<{ fileId: string; fileName: string } | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [officeBlob, setOfficeBlob] = useState<Blob | null>(null);
  const [officeMime, setOfficeMime] = useState<string>('');
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const { user, permissions } = useAuth();
  const [approvalTask, setApprovalTask] = useState<ApprovalTaskAccess | null>(null);
  const [actionMode, setActionMode] = useState<null | 'approve' | 'reject' | 'transfer'>(null);
  const [comment, setComment] = useState('');
  const [transferUserId, setTransferUserId] = useState<string | undefined>(undefined);
  const [transferUsers, setTransferUsers] = useState<UserItem[]>([]);
  const [transferLoading, setTransferLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isOwner = !!user && !!detail && detail.ownerId === user.id;
  const canDownload = permissions.includes('document:download') || isOwner;
  const canUpload = permissions.includes('document:upload');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const d = await applicationsApi.get(id);
      setDetail(d);
      try {
        const p = await api.get(`/approvals/instances/${d.currentInstanceId}/progress`).then((r) => r.data).catch(() => null);
        setProgress(p ?? null);
      } catch {
        setProgress(null);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || '加载申请项目失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!id) {
      setApprovalTask(null);
      return;
    }
    approvalsApi.taskForDocument(id).then(setApprovalTask).catch(() => setApprovalTask(null));
  }, [id]);

  const downloadFile = async (fileId: string, fileName: string) => {
    if (!id) return;
    if (!canDownload) {
      message.warning('您没有下载权限，请联系管理员');
      return;
    }
    try {
      const res = await api.get(`/applications/${id}/files/${fileId}/download`, { responseType: 'blob', timeout: 60000 });
      const blobUrl = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName || `file-${fileId}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 403) message.warning('您没有下载权限，请联系管理员');
      else message.error(`下载失败（${status ?? '网络异常'}）`);
    }
  };

  const withdraw = async () => {
    if (!id) return;
    Modal.confirm({
      title: '撤回申请项目',
      content: '确定撤回当前审批吗？',
      onOk: async () => {
        await applicationsApi.withdraw(id);
        message.success('已撤回');
        load();
      }
    });
  };

  const remind = async () => {
    if (!id) return;
    await applicationsApi.remind(id);
    message.success('已催办');
  };

  const openApprove = () => { setActionMode('approve'); setComment(''); };
  const openReject = () => { setActionMode('reject'); setComment(''); };
  const openTransfer = async () => {
    setActionMode('transfer');
    setComment('');
    setTransferUserId(undefined);
    if (transferUsers.length === 0) {
      setTransferLoading(true);
      try {
        const r = await usersApi.list({ pageSize: 100 });
        setTransferUsers(r.items.filter((u) => u.id !== user?.id && (u.status ?? 'active') === 'active'));
      } catch {
        // ignore
      } finally {
        setTransferLoading(false);
      }
    }
  };

  const submitAction = async () => {
    if (!approvalTask?.taskId || !actionMode) return;
    if (actionMode === 'reject' && !comment.trim()) {
      message.warning('请填写驳回意见');
      return;
    }
    if (actionMode === 'transfer' && !transferUserId) {
      message.warning('请选择转办人');
      return;
    }
    setSubmitting(true);
    try {
      if (actionMode === 'approve') {
        await approvalsApi.approve(approvalTask.taskId, comment.trim() || undefined);
        message.success('已同意');
      } else if (actionMode === 'reject') {
        await approvalsApi.reject(approvalTask.taskId, comment.trim());
        message.success('已驳回');
      } else {
        await approvalsApi.transfer(approvalTask.taskId, transferUserId!, comment.trim() || undefined);
        message.success('已转办');
      }
      setActionMode(null);
      setComment('');
      setTransferUserId(undefined);
      await load();
      try {
        const r = await approvalsApi.taskForDocument(id!);
        setApprovalTask(r);
      } catch {
        setApprovalTask(null);
      }
    } catch (e: any) {
      const m = e?.response?.data?.message || '操作失败';
      message.error(m);
    } finally {
      setSubmitting(false);
    }
  };

  const loadPreview = async (fileId: string, fileName: string) => {
    setPreviewOpen(true);
    setPreviewLoading(true);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewFile(null);
    setPreviewUrl(null);
    setOfficeBlob(null);
    setOfficeMime('');
    setPreviewTarget({ fileId, fileName });
    setPreviewError('');
    setPage(1);
    setNumPages(0);
    try {
      const res = await api.get(`/applications/${id}/files/${fileId}/preview`, { responseType: 'arraybuffer', timeout: 120_000 });
      const rawMode = (res.headers['x-preview-mode'] || '') === 'raw';
      const ct = String(res.headers['content-type'] || '').toLowerCase();
      const isOffice = rawMode || /(spreadsheet|wordprocessing|presentation|ms-excel|msword|opendocument)/.test(ct);
      if (isOffice) {
        const mime = ct || 'application/octet-stream';
        const blob = new Blob([new Uint8Array(res.data)], { type: mime });
        setOfficeMime(mime);
        setOfficeBlob(blob);
      } else {
        const file = new File([new Uint8Array(res.data)], 'preview.pdf', { type: 'application/pdf' });
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewFile(file);
        setPreviewUrl(URL.createObjectURL(file));
      }
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 403) setPreviewError('您没有预览权限，请联系管理员');
      else if (status === 422) setPreviewError('该文件无法生成预览（格式不受支持或转换失败）');
      else setPreviewError('预览加载失败（' + (status ?? '网络异常') + '）');
    } finally {
      setPreviewLoading(false);
    }
  };

  const formatSize = (n: number) => n >= 1024 * 1024 ? `${(n / (1024 * 1024)).toFixed(2)} MB` : `${(n / 1024).toFixed(1)} KB`;

  const fileColumns = [
    { title: '序号', width: 60, render: (_: unknown, _r: ApplicationDetail['files'][number], idx: number) => idx + 1 },
    {
      title: '文件名',
      dataIndex: 'fileName',
      render: (v: string, r: ApplicationDetail['files'][number]) => (
        <span>
          <Tag style={{ marginRight: 8 }}>v{r.versionNo}</Tag>
          <span title={v}>{v}</span>
        </span>
      )
    },
    {
      title: '类型',
      dataIndex: 'mimeType',
      width: 100,
      render: (v: string, r: ApplicationDetail['files'][number]) => <Tag>{formatFileType(v, r.fileName)}</Tag>
    },
    { title: '大小', dataIndex: 'size', width: 110, render: (v: number) => formatSize(v) },
    { title: '上传时间', dataIndex: 'createdAt', width: 180, render: (v: string) => v.slice(0, 16).replace('T', ' ') },
    {
      title: '操作',
      width: 180,
      render: (_: unknown, r: ApplicationDetail['files'][number]) => (
        <Space size={4}>
          {canDownload ? (
            <Button size="small" type="link" icon={<EyeOutlined />} onClick={() => loadPreview(r.id, r.fileName)}>预览</Button>
          ) : (
            <span style={{ color: '#bbb' }} title="需要 document:download 权限">预览</span>
          )}
          {canDownload ? (
            <Button size="small" type="link" icon={<DownloadOutlined />} onClick={() => downloadFile(r.id, r.fileName)}>下载</Button>
          ) : (
            <span style={{ color: '#bbb' }} title="需要 document:download 权限">下载</span>
          )}
        </Space>
      )
    }
  ];

  if (loading && !detail) {
    return <Card loading />;
  }
  if (!detail) {
    return <Card>未找到申请项目</Card>;
  }

  return (
    <PageErrorBoundary>
    <div>
      <Card
        title={
          <Space>
            <span>{detail.title}</span>
            <StatusTag status={detail.status} />
          </Space>
        }
        extra={
          approvalTask?.canApprove && approvalTask.taskId ? (
            <Space>
              <Button type="primary" onClick={openApprove}>同意</Button>
              <Button danger onClick={openReject}>驳回</Button>
              <Button onClick={openTransfer} disabled={!approvalTask.canTransfer}>转办</Button>
            </Space>
          ) : canUpload && detail.status === 'in_approval' && isOwner ? (
            <Space>
              <Button onClick={remind}>催办</Button>
              <Button danger onClick={withdraw}>撤回</Button>
            </Space>
          ) : null
        }
      >
        <Descriptions column={3} size="small" bordered>
          <Descriptions.Item label="项目标题">{detail.title}</Descriptions.Item>
          <Descriptions.Item label="状态"><StatusTag status={detail.status} /></Descriptions.Item>
          <Descriptions.Item label="创建人">{detail.ownerName || '-'}</Descriptions.Item>
          <Descriptions.Item label="文件数">{detail.files.length}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{formatDateTime(detail.createdAt)}</Descriptions.Item>
          <Descriptions.Item label="最近更新">{formatDateTime(detail.updatedAt)}</Descriptions.Item>
          <Descriptions.Item label="说明" span={3}>
            {detail.description || <span style={{ color: '#bbb' }}>-</span>}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title={`附件（${detail.files.length}）`} style={{ marginTop: 16 }}>
        {detail.files.length === 0 ? (
          <div style={{ color: '#999' }}>暂无文件</div>
        ) : (
          <Table rowKey="id" size="small" pagination={false} columns={fileColumns} dataSource={detail.files} />
        )}
      </Card>

      <Card title="审批进度" style={{ marginTop: 16 }}>
        {progress && progress.nodes && progress.nodes.length > 0 ? (
          <ApprovalTimeline progress={progress} />
        ) : (
          <div style={{ color: '#999' }}>{detail.currentInstanceId ? '暂无审批进度' : '该申请项目尚未发起审批'}</div>
        )}
      </Card>

      <Modal
        title={(previewTarget ? previewTarget.fileName : '') || '文件预览'}
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        footer={null}
        width={760}
        destroyOnClose
      >
        {previewLoading ? (
          <div style={{ textAlign: 'center', padding: 80 }}>
            <Spin tip="正在加载预览..." />
          </div>
        ) : previewError ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
            <p>{previewError}</p>
            {previewTarget && <Button onClick={() => loadPreview(previewTarget.fileId, previewTarget.fileName)}>重试</Button>}
          </div>
        ) : officeBlob && previewTarget ? (
          <OfficePreview blob={officeBlob} fileName={previewTarget.fileName} mimeType={officeMime} />
        ) : previewFile ? (
          <>
            <div style={{ maxHeight: '70vh', overflow: 'auto', textAlign: 'center' }}>
              <Document file={previewUrl ? { url: previewUrl } : null} options={{ cMapUrl: '/cmaps/', standardFontDataUrl: '/standard_fonts/' }} onLoadSuccess={({ numPages: n }) => setNumPages(n)} onLoadError={(err) => setPreviewError("PDF 解析失败：" + (err?.message || ''))}>
                <Page pageNumber={page} width={700} renderTextLayer={false} renderAnnotationLayer={false} />
              </Document>
            </div>
            {numPages > 1 && (
              <Space style={{ marginTop: 12, justifyContent: 'center', width: '100%' }}>
                <Button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>上一页</Button>
                <span>{page} / {numPages}</span>
                <Button disabled={page >= numPages} onClick={() => setPage((p) => p + 1)}>下一页</Button>
              </Space>
            )}
          </>
        ) : null}
      </Modal>

      <Modal
        title={actionMode === 'approve' ? '同意审批' : actionMode === 'reject' ? '驳回审批' : '转办任务'}
        open={actionMode !== null}
        onCancel={() => { if (!submitting) setActionMode(null); }}
        onOk={submitAction}
        confirmLoading={submitting}
        okText={actionMode === 'reject' ? '确认驳回' : actionMode === 'transfer' ? '确认转办' : '确认同意'}
        okButtonProps={actionMode === 'reject' ? { danger: true } : undefined}
        destroyOnClose
      >
        {actionMode === 'transfer' ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Select
              showSearch
              placeholder="选择转办人"
              loading={transferLoading}
              value={transferUserId}
              onChange={setTransferUserId}
              optionFilterProp="label"
              style={{ width: '100%' }}
              options={transferUsers.map((u) => ({ value: u.id, label: `${u.name}（${u.username}）` }))}
            />
            <Input.TextArea rows={3} placeholder="备注（可选）" value={comment} onChange={(e) => setComment(e.target.value)} />
          </Space>
        ) : (
          <Input.TextArea
            rows={4}
            placeholder={actionMode === 'reject' ? '请填写驳回意见' : '备注（可选）'}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        )}
      </Modal>
    </div>
    </PageErrorBoundary>
  );
}

class PageErrorBoundary extends React.Component<{ children?: React.ReactNode }, { error: any; info: any }> {
  constructor(props: { children?: React.ReactNode }) {
    super(props);
    this.state = { error: null, info: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ info: info as any });
    try { console.error('[ApplicationDetailPage] render error:', error, info); } catch (_) {}
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24 }}>
          <h3 style={{ color: '#c00' }}>页面渲染错误</h3>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#fff5f5', padding: 12, border: '1px solid #ffd6d6' }}>
{String(this.state.error && (this.state.error.stack || this.state.error.message || this.state.error))}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
