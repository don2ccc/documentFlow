import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Popconfirm, Space, Table, Tag, Typography, message } from 'antd';
import { ReloadOutlined, RollbackOutlined } from '@ant-design/icons';
import { versionsApi, VersionEntry, AppVersion } from '../../api/endpoints';

const { Title, Paragraph, Text } = Typography;

export function VersionsPage() {
  const [info, setInfo] = useState<AppVersion | null>(null);
  const [list, setList] = useState<VersionEntry[]>([]);
  const [current, setCurrent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [rolling, setRolling] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [v, listResp] = await Promise.all([versionsApi.current(), versionsApi.list()]);
      setInfo(v);
      setList(listResp.versions);
      setCurrent(listResp.current);
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const rollback = useCallback(async (tag: string) => {
    setRolling(tag);
    try {
      const r = await versionsApi.rollback(tag);
      message.success(r.message);
      setTimeout(load, 3000);
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? '回滚失败');
    } finally {
      setRolling(null);
    }
  }, [load]);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card
        title={<Title level={4} style={{ margin: 0 }}>系统版本</Title>}
        extra={<Button icon={<ReloadOutlined />} loading={loading} onClick={load}>刷新</Button>}
      >
        {info ? (
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <Space wrap>
              <Tag color="blue" style={{ fontSize: 14, padding: '4px 10px' }}>{info.version}</Tag>
              <Text type="secondary">提交: <Text code>{info.commit}</Text></Text>
              <Text type="secondary">分支: <Text code>{info.branch}</Text></Text>
            </Space>
            <Paragraph style={{ marginTop: 12, marginBottom: 4 }} copyable={{ text: info.subject }}>
              <Text strong>当前描述：</Text> {info.subject}
            </Paragraph>
            <Text type="secondary">构建时间：{new Date(info.builtAt).toLocaleString()}</Text>
          </Space>
        ) : (
          <Alert type="warning" message="暂未获取到版本信息" />
        )}
      </Card>

      <Card title={<Title level={4} style={{ margin: 0 }}>历史版本</Title>}>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={
            <span>
              如果最新版本不满意，可以选择以前的版本点击 <b>回到该版</b> 进行回滚。服务会重新打包并重启，预计 1-2 分钟后生效。
            </span>
          }
        />
        <Table<VersionEntry>
          rowKey="tag"
          loading={loading}
          dataSource={list}
          pagination={false}
          columns={[
            { title: '版本', dataIndex: 'tag', width: 120, render: (tag: string) => (
              <Space>
                <Tag color={tag === current ? 'green' : 'default'}>{tag}</Tag>
                {tag === current ? <Tag color="green">当前</Tag> : null}
              </Space>
            ) },
            { title: '提交', dataIndex: 'sha', width: 110, render: (s: string) => <Text code>{s}</Text> },
            { title: '描述', dataIndex: 'subject' },
            { title: '时间', dataIndex: 'date', width: 200, render: (d: string) => new Date(d).toLocaleString() },
            { title: '操作', key: 'op', width: 160, render: (_: any, row: VersionEntry) => (
              <Popconfirm
                title={`确认要回滚到 ${row.tag} 吗？`}
                description="服务会重新构建并重启。请确保你已提交当前版本。"
                okText="确认回滚"
                cancelText="取消"
                okButtonProps={{ danger: true }}
                onConfirm={() => rollback(row.tag)}
              >
                <Button danger size="small" icon={<RollbackOutlined />} loading={rolling === row.tag} disabled={row.tag === current}>
                  回到该版
                </Button>
              </Popconfirm>
            ) }
          ]}
        />
      </Card>
    </Space>
  );
}
