import { useEffect, useState } from 'react';
import { Button, Card, Col, Descriptions, Modal, Row, Space, Spin, Tag, Upload, message } from 'antd';
import { useParams } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import { api } from '../api/client';
import { documentsApi, DocumentDetail } from '../api/endpoints';
import { ApprovalTimeline } from '../components/ApprovalTimeline';
import { StatusTag } from '../components/StatusTag';
import { SubmitFlowModal } from '../components/SubmitFlowModal';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

export function DocumentDetailPage() {
  const { id } = useParams();
  const [detail, setDetail] = useState<DocumentDetail | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [previewState, setPreviewState] = useState<'loading' | 'ok' | 'converting' | 'failed'>('loading');
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [submitOpen, setSubmitOpen] = useState(false);

  const load = async () => {
    if (!id) return;
    const d = await documentsApi.get(id);
    setDetail(d);
    const v = d.versions[0];
    if (v) {
      try {
        const res = await api.get(`/documents/${d.id}/versions/${v.id}/preview`, { responseType: 'blob' });
        setPreviewUrl(URL.createObjectURL(res.data));
        setPreviewState('ok');
      } catch (e: any) {
        if (e?.response?.status === 202) setPreviewState('converting');
        else setPreviewState('failed');
      }
    } else {
      setPreviewState('failed');
    }
  };

  useEffect(() => {
    load();
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

  return (
    <div>
      <Card
        title={<Space><span>{detail.title}</span><StatusTag status={detail.status} /></Space>}
        extra={
          <Space>
            {detail.status === 'draft' && <Button type="primary" onClick={() => setSubmitOpen(true)}>提交审批</Button>}
            {detail.status === 'rejected' && (
              <>
                <Upload accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif" showUploadList={false} beforeUpload={(f) => { uploadVersion(f); return false; }}>
                  <Button type="primary">上传新版本并重新提交</Button>
                </Upload>
              </>
            )}
            {detail.status === 'in_approval' && (
              <>
                <Button onClick={withdraw}>撤回</Button>
                <Button onClick={remind}>催办</Button>
              </>
            )}
            {latest && <Button href={`/api/documents/${detail.id}/versions/${latest.id}/download`} target="_blank">下载</Button>}
          </Space>
        }
      >
        <Row gutter={24}>
          <Col span={16}>
            <Card size="small" title="文档预览" style={{ minHeight: 480 }}>
              {previewState === 'loading' && <Spin />}
              {previewState === 'converting' && <div style={{ textAlign: 'center', padding: 80 }}>正在生成预览，请稍后刷新…</div>}
              {previewState === 'failed' && (
                <div style={{ textAlign: 'center', padding: 80 }}>
                  <p>预览生成失败，可下载原件查看</p>
                  {latest && <Button type="link" onClick={async () => { await documentsApi.remind(id!); }}>重新生成</Button>}
                </div>
              )}
              {previewState === 'ok' && previewUrl && (
                <Document file={previewUrl} onLoadSuccess={({ numPages: n }) => setNumPages(n)}>
                  <Page pageNumber={page} width={700} />
                </Document>
              )}
              {previewState === 'ok' && numPages > 1 && (
                <Space style={{ marginTop: 12 }}>
                  <Button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>上一页</Button>
                  <span>{page} / {numPages}</span>
                  <Button disabled={page >= numPages} onClick={() => setPage((p) => p + 1)}>下一页</Button>
                </Space>
              )}
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" title="基本信息">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="分类">{detail.categoryId ? '已分类' : '未分类'}</Descriptions.Item>
                <Descriptions.Item label="金额">{detail.amount ? `¥ ${detail.amount}` : '-'}</Descriptions.Item>
                <Descriptions.Item label="说明">{detail.description || '-'}</Descriptions.Item>
                <Descriptions.Item label="上传时间">{detail.createdAt.slice(0, 16).replace('T', ' ')}</Descriptions.Item>
              </Descriptions>
            </Card>
            <Card size="small" title="版本历史" style={{ marginTop: 16 }}>
              {detail.versions.map((v) => (
                <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span>v{v.versionNo} · {v.fileName}</span>
                  <a href={`/api/documents/${detail.id}/versions/${v.id}/download`}>下载</a>
                </div>
              ))}
            </Card>
          </Col>
        </Row>
        <Card size="small" title="审批进度" style={{ marginTop: 16 }}>
          <ApprovalTimeline progress={detail.progress} />
        </Card>
      </Card>
      {detail && (
        <SubmitFlowModal documentId={detail.id} open={submitOpen} onClose={() => setSubmitOpen(false)} onSuccess={() => { setSubmitOpen(false); load(); }} />
      )}
    </div>
  );
}