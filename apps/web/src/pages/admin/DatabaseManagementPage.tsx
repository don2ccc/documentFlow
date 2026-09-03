import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Form,
  Modal,
  Popconfirm,
  Progress,
  Space,
  Table,
  Tag,
  Upload,
  message
} from 'antd';
import type { UploadProps } from 'antd';
import {
  CloudDownloadOutlined,
  CloudUploadOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { databaseApi, DatabaseBackup, DatabaseInfo } from '../../api/endpoints';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../api/client';

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function DatabaseManagementPage() {
  const { user, permissions } = useAuth();
  const canManage = permissions.includes('database:manage');
  const [info, setInfo] = useState<DatabaseInfo | null>(null);
  const [items, setItems] = useState<DatabaseBackup[]>([]);
  const [loading, setLoading] = useState(false);
  const [backing, setBacking] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [i, list] = await Promise.all([databaseApi.info(), databaseApi.list()]);
      setInfo(i);
      setItems(list);
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canManage) load();
  }, [canManage, load]);

  const onBackup = useCallback(async () => {
    setBacking(true);
    try {
      const r = await databaseApi.create();
      message.success(`备份已生成：${r.filename}（${formatBytes(r.size)}）`);
      load();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? '备份失败，请查看服务器日志');
    } finally {
      setBacking(false);
    }
  }, [load]);

  const onDelete = useCallback(
    async (filename: string) => {
      try {
        await databaseApi.remove(filename);
        message.success(`已删除 ${filename}`);
        load();
      } catch (e: any) {
        message.error(e?.response?.data?.message ?? '删除失败');
      }
    },
    [load]
  );

  const onDownload = useCallback((filename: string) => {
    // 用 token 拼出可下载的 URL
    const token = localStorage.getItem('token') ?? '';
    const url = `/api/database/backups/${encodeURIComponent(filename)}/download`;
    // 走 fetch + blob 触发下载，避免浏览器拦截 Authorization header
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.blob();
      })
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);
      })
      .catch((e) => message.error(`下载失败：${e.message ?? e}`));
  }, []);

  const uploadProps: UploadProps = useMemo(
    () => ({
      accept: '.sql,.dump,.bak,text/plain',
      multiple: false,
      showUploadList: false,
      beforeUpload: (file) => {
        setRestoreFile(file);
        return false; // 阻止 antd 自动上传，改为手动提交
      },
      onRemove: () => {
        setRestoreFile(null);
      }
    }),
    []
  );

  const onRestoreClick = () => {
    if (!restoreFile) {
      message.warning('请先选择要恢复的备份文件');
      return;
    }
    Modal.confirm({
      title: '确认恢复数据库？',
      content: (
        <div>
          <p>恢复操作会直接覆盖当前数据库的全部内容，且不可撤销。</p>
          <p>
            建议先点「立即备份」生成一份当前快照，再执行恢复。
          </p>
          <p>即将从文件恢复：<strong>{restoreFile.name}</strong>（{formatBytes(restoreFile.size)}）</p>
        </div>
      ),
      okText: '确认恢复',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => doRestore()
    });
  };

  const doRestore = useCallback(async () => {
    if (!restoreFile) return;
    setRestoring(true);
    setRestoreProgress(0);
    try {
      await databaseApi.restore(restoreFile, (e) => {
        if (e.total) setRestoreProgress(Math.round((e.loaded / e.total) * 100));
      });
      message.success('数据库已恢复，请重新登录');
      setRestoreFile(null);
      // token 可能仍然有效，但 user 信息可能已变，强制刷新一次列表
      load();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? '恢复失败，请检查文件格式');
    } finally {
      setRestoring(false);
      setRestoreProgress(0);
    }
  }, [restoreFile, load]);

  if (!canManage) {
    return (
      <Card title="数据库管理">
        <Alert
          type="warning"
          showIcon
          message="当前账号没有数据库管理权限（database:manage），无法访问此页面。"
          description="如需开通，请联系系统管理员在「角色管理」中授予该权限。"
        />
      </Card>
    );
  }

  return (
    <Card
      title={
        <Space>
          <DatabaseOutlined />
          数据库管理 · 备份与恢复
        </Space>
      }
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<CloudUploadOutlined />}
            onClick={onBackup}
            loading={backing}
          >
            立即备份
          </Button>
        </Space>
      }
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="备份与恢复说明"
        description={
          <ul style={{ marginBottom: 0, paddingLeft: 18 }}>
            <li>使用 <code>pg_dump</code> 导出 plain-text SQL，再以 <code>psql</code> 回放，保留表结构、数据、序列、视图。</li>
            <li>备份文件保存在服务器 <code>data/backups/</code> 目录下，文件名形如 <code>backup-YYYYMMDD-HHMMSS.sql</code>。</li>
            <li>恢复操作会先备份当前库到本地再覆盖写入；若文件来自其它环境，请确保 schema 兼容。</li>
            <li>恢复成功后所有用户需重新登录。</li>
          </ul>
        }
      />

      <Card type="inner" title="数据库连接信息" style={{ marginBottom: 16 }}>
        {info ? (
          <Space size="large" wrap>
            <span>主机：<Tag>{info.host}</Tag></span>
            <span>端口：<Tag>{info.port}</Tag></span>
            <span>数据库：<Tag color="blue">{info.database}</Tag></span>
            <span>用户：<Tag>{info.user}</Tag></span>
            <span>
              已有快照：<Tag color="green">{info.backupCount} 个</Tag>
              （合计 {formatBytes(info.backupTotalSize)}）
            </span>
          </Space>
        ) : (
          <span>加载中…</span>
        )}
      </Card>

      <Card type="inner" title="从备份文件恢复" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space wrap>
            <Upload {...uploadProps} maxCount={1}>
              <Button icon={<CloudDownloadOutlined />} disabled={restoring}>
                选择 SQL 文件
              </Button>
            </Upload>
            {restoreFile && (
              <span>
                已选择：<strong>{restoreFile.name}</strong>（{formatBytes(restoreFile.size)}）
              </span>
            )}
            <Button
              danger
              type="primary"
              disabled={!restoreFile || restoring}
              loading={restoring}
              onClick={onRestoreClick}
            >
              立即恢复
            </Button>
          </Space>
          {restoring && (
            <Progress percent={restoreProgress} status="active" />
          )}
        </Space>
      </Card>

      <Card type="inner" title="已有备份">
        <Table<DatabaseBackup>
          rowKey="filename"
          loading={loading}
          dataSource={items}
          pagination={false}
          size="middle"
          locale={{ emptyText: '暂无备份，点击右上角「立即备份」即可生成' }}
          columns={[
            { title: '文件名', dataIndex: 'filename', ellipsis: true },
            {
              title: '大小',
              dataIndex: 'size',
              width: 120,
              render: (n: number) => formatBytes(n)
            },
            {
              title: '备份时间',
              dataIndex: 'createdAt',
              width: 200,
              render: (v: string) => new Date(v).toLocaleString()
            },
            {
              title: '操作',
              width: 220,
              render: (_v, r) => (
                <Space>
                  <Button
                    size="small"
                    icon={<CloudDownloadOutlined />}
                    onClick={() => onDownload(r.filename)}
                  >
                    下载
                  </Button>
                  <Popconfirm
                    title={`确定删除 ${r.filename}？`}
                    okText="删除"
                    okButtonProps={{ danger: true }}
                    cancelText="取消"
                    onConfirm={() => onDelete(r.filename)}
                  >
                    <Button size="small" danger icon={<DeleteOutlined />}>
                      删除
                    </Button>
                  </Popconfirm>
                </Space>
              )
            }
          ]}
        />
      </Card>
    </Card>
  );
}