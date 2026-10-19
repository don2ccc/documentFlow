import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Alert, Button, Card, Col, Empty, Row, Table } from 'antd';
import {
  AuditOutlined,
  BellOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  InboxOutlined,
  RightOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '../api/endpoints';
import { StatusTag } from '../components/StatusTag';
import { formatDateMinute } from '../utils/datetime';
import { useAuth } from '../auth/AuthContext';
import { statusColor, tokens } from '../theme';

type Summary = Awaited<ReturnType<typeof dashboardApi.summary>>;

interface StatDef {
  key: keyof Pick<Summary, 'todoCount' | 'myPending' | 'myApproved' | 'myRejected'>;
  label: string;
  color: string;
  tint: string;
  icon: ReactNode;
}

const STATS: StatDef[] = [
  { key: 'todoCount', label: '我的待办', color: statusColor.progress, tint: brandTint(statusColor.progress), icon: <InboxOutlined /> },
  { key: 'myPending', label: '审批中', color: statusColor.pending, tint: brandTint(statusColor.pending), icon: <ClockCircleOutlined /> },
  { key: 'myApproved', label: '已通过', color: statusColor.success, tint: brandTint(statusColor.success), icon: <CheckCircleOutlined /> },
  { key: 'myRejected', label: '已驳回', color: statusColor.danger, tint: brandTint(statusColor.danger), icon: <CloseCircleOutlined /> }
];

/** 把状态色转成 12% 透明度的浅底色，用于图标底衬 */
function brandTint(hex: string): string {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 0.12)`;
}

interface QuickAction {
  path: string;
  label: string;
  desc: string;
  icon: ReactNode;
  permission?: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { path: '/applications', label: '我的申请', desc: '查看已提交的流程', icon: <FileTextOutlined />, permission: 'document:upload' },
  { path: '/approvals', label: '审批中心', desc: '处理待我审批的单据', icon: <AuditOutlined />, permission: 'approval:handle' },
  { path: '/applications/query', label: '申请查询', desc: '按条件检索历史申请', icon: <SearchOutlined />, permission: 'application:query' },
  { path: '/notifications', label: '通知中心', desc: '系统消息与提醒', icon: <BellOutlined /> }
];

export function DashboardPage() {
  const navigate = useNavigate();
  const { permissions } = useAuth();
  const [data, setData] = useState<Summary | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    dashboardApi
      .summary()
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const has = (code: string) => permissions.includes(code);
  const actions = QUICK_ACTIONS.filter((a) => !a.permission || has(a.permission));

  const columns = [
    {
      title: '申请项目',
      dataIndex: 'title',
      render: (v: string, r: { id: string }) => (
        <a onClick={() => navigate(`/applications/${r.id}`)}>{v}</a>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (v: string) => <StatusTag status={v} />
    },
    {
      title: '提交时间',
      dataIndex: 'createdAt',
      width: 170,
      render: (v: string) => (
        <span style={{ color: tokens.text.secondary }}>{formatDateMinute(v)}</span>
      )
    }
  ];

  if (failed) {
    return (
      <Alert
        type="error"
        showIcon
        message="仪表盘数据加载失败"
        description="可能是网络波动或服务暂时不可用，请重试。"
        action={
          <Button size="small" onClick={load}>
            重新加载
          </Button>
        }
      />
    );
  }

  if (!data) {
    return (
      <Row gutter={[tokens.space.md, tokens.space.md]}>
        {[0, 1, 2, 3].map((i) => (
          <Col xs={12} lg={6} key={i}>
            <Card loading />
          </Col>
        ))}
      </Row>
    );
  }

  const recent = data.recentInstances ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space.md }}>
      {/* ---------- 关键指标 ---------- */}
      <Row gutter={[tokens.space.md, tokens.space.md]}>
        {STATS.map((stat) => (
          <Col xs={12} lg={6} key={stat.key}>
            <Card
              styles={{ body: { padding: 20 } }}
              style={{
                borderRadius: tokens.radius.lg,
                border: `1px solid ${tokens.border}`,
                boxShadow: tokens.shadow.sm
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: tokens.text.secondary }}>{stat.label}</div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 30,
                      lineHeight: 1.15,
                      fontWeight: 700,
                      letterSpacing: '-0.02em',
                      fontVariantNumeric: 'tabular-nums',
                      color: data[stat.key] > 0 ? stat.color : tokens.text.primary
                    }}
                  >
                    {data[stat.key]}
                  </div>
                </div>
                <div
                  aria-hidden="true"
                  style={{
                    width: 40,
                    height: 40,
                    flex: 'none',
                    borderRadius: 10,
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 19,
                    color: stat.color,
                    background: stat.tint
                  }}
                >
                  {stat.icon}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* ---------- 最近申请 + 快捷入口 ---------- */}
      <Row gutter={[tokens.space.md, tokens.space.md]}>
        <Col xs={24} xl={17}>
          <Card
            title="最近申请"
            extra={
              actions.some((a) => a.path === '/applications') ? (
                <a onClick={() => navigate('/applications')} style={{ fontSize: 13 }}>
                  查看全部
                </a>
              ) : null
            }
            style={{
              borderRadius: tokens.radius.lg,
              border: `1px solid ${tokens.border}`,
              boxShadow: tokens.shadow.sm,
              height: '100%'
            }}
          >
            {recent.length > 0 ? (
              <Table
                rowKey="id"
                columns={columns}
                dataSource={recent}
                pagination={false}
                size="middle"
              />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="还没有提交过申请"
                style={{ padding: '24px 0' }}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} xl={7}>
          <Card
            title="快捷入口"
            style={{
              borderRadius: tokens.radius.lg,
              border: `1px solid ${tokens.border}`,
              boxShadow: tokens.shadow.sm,
              height: '100%'
            }}
            styles={{ body: { padding: actions.length ? 8 : 24 } }}
          >
            {actions.length ? (
              actions.map((action) => (
                <button
                  key={action.path}
                  type="button"
                  onClick={() => navigate(action.path)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 12px',
                    marginBottom: 2,
                    border: 0,
                    borderRadius: tokens.radius.md,
                    background: 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background-color 160ms ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = tokens.pageBg;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 34,
                      height: 34,
                      flex: 'none',
                      borderRadius: 9,
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 16,
                      color: statusColor.progress,
                      background: brandTint(statusColor.progress)
                    }}
                  >
                    {action.icon}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 500, color: tokens.text.primary }}>
                      {action.label}
                    </span>
                    <span style={{ display: 'block', fontSize: 12, color: tokens.text.muted, marginTop: 1 }}>
                      {action.desc}
                    </span>
                  </span>
                  <RightOutlined style={{ fontSize: 12, color: tokens.text.muted }} />
                </button>
              ))
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无可用的快捷入口" />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
