import { useEffect, useRef, useState } from 'react';
import { Button, Card, Col, Descriptions, Modal, Row, Space, Spin, Tag, Upload, message } from 'antd';
import { useParams } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import { LockOutlined } from '@ant-design/icons';
import { api } from '../api/client';
import { documentsApi, DocumentDetail } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { ApprovalTimeline } from '../components/ApprovalTimeline';
import { StatusTag } from '../components/StatusTag';
import { SubmitFlowModal } from '../components/SubmitFlowModal';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

type PreviewState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; file: File }
  | { kind: 'converting' }
  | { kind: 'failed'; message: string }
  | { kind: 'forbidden' };

const RIGHT_PANEL_CSS = `
.app-doc-right-card.ant-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}
.app-doc-right-card.ant-card > .ant-card-head {
  border-bottom: 1px solid #eef2f7;
  min-height: 44px;
  padding: 0 16px;
}
.app-doc-right-card.ant-card > .ant-card-head > .ant-card-head-wrapper > .ant-card-head-title {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  letter-spacing: 0.2px;
}
.app-doc-right-card.ant-card > .ant-card-body {
  padding: 14px 16px 16px;
}
.app-doc-right-card .ant-descriptions-item-label {
  color: #64748b;
  font-size: 13px;
  font-weight: 400;
  width: 88px;
}
.app-doc-right-card .ant-descriptions-item-content {
  color: #0f172a;
  font-size: 13px;
}
.app-doc-right-version-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  font-size: 13px;
  color: #0f172a;
  border-bottom: 1px dashed #eef2f7;
}
.app-doc-right-version-row:last-child {
  border-bottom: none;
}
.app-doc-right-version-row a,
.app-doc-right-version-row .app-doc-right-version-disabled {
  font-size: 13px;
}
`;

export function DocumentDetailPage() {
  const { id } = useParams();
  const [detail, setDetail] = useState<DocumentDetail | null>(null);
  const [preview, setPreview] = useState<PreviewState>({ kind: 'idle' });
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [submitOpen, setSubmitOpen] = useState(false);
  const { user, permissions } = useAuth();
  const previewDataRef = useRef<Uint8Array | null>(null);

  const canPreview = permissions.includes('document:preview');
  const canDownload = permissions.includes('document:download');
  const canUpload = permissions.includes('document:upload');
  const isOwner = !!user && !!detail && detail.ownerId === user.id;

  const releasePreviewUrl = () => {};

  const downloadVersion = async (docId: string, versionId: string, fileName: string) => {
    if (!canDownload) {
      message.warning('您没有下载权限，请联系管理员');
      return;
    }
    try {
      const res = await api.get(`/documents/${docId}/versions/${versionId}/download`, { responseType: 'blob', timeout: 60000 });
      const blobUrl = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName || `document-${versionId}`;
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

  const loadPreview = async (docId: string, versionId: string, attempt = 0) => {
    if (!canPreview) {
      setPreview({ kind: 'forbidden' });
      return;
    }
    setPreview({ kind: 'loading' });
    releasePreviewUrl();
    try {
      const res = await api.get(`/documents/${docId}/versions/${versionId}/preview`, {
        responseType: 'arraybuffer',
        timeout: 45_000
      });
      const file = new File([new Uint8Array(res.data)], 'preview.pdf', { type: 'application/pdf' });
      setPreview({ kind: 'ok', file });
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 403) {
        setPreview({ kind: 'forbidden' });
        return;
      }
      if (status === 202) {
        setPreview({ kind: 'converting' });
        return;
      }
      // 5xx / network / timeout — back off and retry once after 2s, otherwise surface failure
      if (attempt < 1 && (!status || status >= 500)) {
        await new Promise((r) => setTimeout(r, 2000));
        return loadPreview(docId, versionId, attempt + 1);
      }
      const msg =
        e?.code === 'ECONNABORTED'
          ? '预览加载超时，请刷新或重试'
          : status === 422
            ? '预览生成失败，可下载原件查看'
            : `预览加载失败（${status ?? '网络异常'}）`;
      setPreview({ kind: 'failed', message: msg });
    }
  };

  const retryConvert = async (versionId: string) => {
    try {
      await api.post(`/documents/versions/${versionId}/retry-convert`);
      message.success('已重新触发预览生成');
      setPreview({ kind: 'converting' });
    } catch {
      message.error('操作失败');
    }
  };

  const load = async () => {
    if (!id) return;
    setDetail(null);
    setPreview({ kind: 'idle' });
    releasePreviewUrl();
    try {
      const d = await documentsApi.get(id);
      setDetail(d);
      const v = d.versions[0];
      if (!canPreview) {
        setPreview({ kind: 'forbidden' });
        return;
      }
      if (!v) {
        setPreview({ kind: 'failed', message: '该文档没有可预览的版本' });
        return;
      }
      void loadPreview(d.id, v.id);
    } catch (e: any) {
      const status = e?.response?.status;
      const detail = e?.response?.data?.message || e?.message || String(e);
      const url = e?.config?.url;
      console.error('[DocumentDetail] load failed', { status, detail, url, e });
      message.error(`加载文档失败（${status ?? '网络异常'}）：${detail}`);
      setPreview({ kind: 'failed', message: `文档加载失败：${detail}` });
    }
  };

  useEffect(() => {
    load();
    return () => releasePreviewUrl();
  }, [id]);

  const withdraw = () => {
    Modal.confirm({
      title: '撤回申请',
      content: '确定撤回该文档的审批申请吗？',
      onOk: async () => {
        await documentsApi.withdraw(id!);
        message.success('已撤回');
        load();
      }
    });
  };

  const removeDoc = () => {
    Modal.confirm({
      title: '删除文档',
      content: '确定删除该文档吗？该操作仅系统管理员可用，删除后无法恢复。',
      okButtonProps: { danger: true },
      okText: '删除',
      cancelText: '取消',
      onOk: async () => {
        try {
          await documentsApi.remove(id!);
          message.success('已删除');
          window.history.back();
        } catch (e: any) {
          message.error(e?.response?.data?.message || '删除失败');
        }
      }
    });
  };

  const _BUILD = 'bust1788193000000';

  const remind = async () => {
    await documentsApi.remind(id!);
    message.success('已催办');
  };

  const uploadVersion = async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('reason', '重新提交');
    await documentsApi.addVersion(id!, fd);
    message.success('新版本已上传');
    load();
  };

  if (!detail) return <Spin style={{ display: 'block', marginTop: 80 }} />;

  const latest = detail.versions[0];

  const permissionLockBlock = (
    <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
      <LockOutlined style={{ fontSize: 48, marginBottom: 12 }} />
      <p style={{ fontSize: 14, marginBottom: 4 }}>没有预览权限</p>
      <p style={{ fontSize: 12 }}>请联系管理员在「角色管理」中授予 <Tag color="blue">document:preview</Tag> 权限</p>
    </div>
  );

  return (
    <div data-build={_BUILD}>
      <style>{RIGHT_PANEL_CSS}</style>
      <Card
        title={<Space><span>{detail.title}</span><StatusTag status={detail.status} /></Space>}
        extra={
          <Space wrap>
            {canUpload && detail.status === 'draft' && <Button type="primary" onClick={() => setSubmitOpen(true)}>提交审批</Button>}
            {canUpload && detail.status === 'rejected' && (
              <Upload accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif" showUploadList={false} beforeUpload={(f) => { uploadVersion(f); return false; }}>
                <Button type="primary">上传新版本并重新提交</Button>
              </Upload>
            )}
            {canUpload && detail.status === 'in_approval' && (
              <>
                <Button onClick={withdraw}>撤回</Button>
                <Button onClick={remind}>催办</Button>
              </>
            )}
            {permissions.includes('user:manage') && (
              <Button danger onClick={removeDoc}>删除</Button>
            )}
          </Space>
        }
      >
        <Row gutter={24}>
          <Col span={16}>
            <Card size="small" title="文档预览" style={{ minHeight: 480 }}>
              {!canPreview && permissionLockBlock}
              {canPreview && preview.kind === 'idle' && (
                <div style={{ textAlign: 'center', padding: 80 }}>
                  <Spin tip="正在加载预览…" />
                </div>
              )}
              {canPreview && preview.kind === 'loading' && (
                <div style={{ textAlign: 'center', padding: 80 }}>
                  <Spin tip="正在加载预览…" />
                </div>
              )}
              {canPreview && preview.kind === 'converting' && (
                <div style={{ textAlign: 'center', padding: 80 }}>
                  <p>正在生成预览，请稍后…</p>
                  {latest && <Button type="link" onClick={() => loadPreview(detail.id, latest.id)}>手动刷新</Button>}
                </div>
              )}
              {canPreview && preview.kind === 'failed' && (
                <div style={{ textAlign: 'center', padding: 80 }}>
                  <p>{preview.message}</p>
                  {latest && (
                    <Space>
                      <Button type="primary" onClick={() => loadPreview(detail.id, latest.id)}>重新加载</Button>
                      <Button onClick={() => retryConvert(latest.id)}>重新生成预览</Button>
                    </Space>
                  )}
                </div>
              )}
              {canPreview && preview.kind === 'forbidden' && permissionLockBlock}
              {canPreview && preview.kind === 'ok' && (
                <>
                  <Document file={preview.file} onLoadSuccess={({ numPages: n }) => setNumPages(n)}>
                    <Page pageNumber={page} width={700} renderTextLayer={false} renderAnnotationLayer={false} />
                  </Document>
                  {numPages > 1 && (
                    <Space style={{ marginTop: 12 }}>
                      <Button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>上一页</Button>
                      <span>{page} / {numPages}</span>
                      <Button disabled={page >= numPages} onClick={() => setPage((p) => p + 1)}>下一页</Button>
                    </Space>
                  )}
                </>
              )}
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" title="基本信息" className="app-doc-right-card">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="创建人">{detail.ownerName || '-'}</Descriptions.Item>
                <Descriptions.Item label="分类">{detail.categoryId ? '已分类' : '未分类'}</Descriptions.Item>
                <Descriptions.Item label="金额">{detail.amount ? `¥ ${detail.amount}` : '-'}</Descriptions.Item>
                <Descriptions.Item label="说明">{detail.description || '-'}</Descriptions.Item>
                <Descriptions.Item label="上传时间">{detail.createdAt.slice(0, 16).replace('T', ' ')}</Descriptions.Item>
              </Descriptions>
            </Card>
            <Card size="small" title="版本历史" className="app-doc-right-card" style={{ marginTop: 16 }}>
              {detail.versions.map((v) => (
                <div key={v.id} className="app-doc-right-version-row">
                  <span>v{v.versionNo} · {v.fileName}</span>
                  {canDownload ? (
                    <a onClick={(e) => { e.preventDefault(); downloadVersion(detail.id, v.id, v.fileName); }} href="#">下载</a>
                  ) : (
                    <span className="app-doc-right-version-disabled" style={{ color: '#bbb' }} title="需要 document:download 权限">下载</span>
                  )}
                </div>
              ))}
            </Card>
          </Col>
        </Row>
        <Card size="small" title="审批进度" style={{ marginTop: 16 }}>
          <ApprovalTimeline progress={detail.progress} />
        </Card>
      </Card>
      {detail && canUpload && (
        <SubmitFlowModal documentId={detail.id} open={submitOpen} onClose={() => setSubmitOpen(false)} onSuccess={() => { setSubmitOpen(false); load(); }} />
      )}
    </div>
  );
}