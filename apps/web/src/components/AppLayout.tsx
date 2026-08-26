import { Layout, Menu, Dropdown, Badge } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { HomeOutlined, FileTextOutlined, AuditOutlined, BellOutlined, TeamOutlined, TagsOutlined, ApartmentOutlined, SafetyCertificateOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { useAuth } from '../auth/AuthContext';

const { Sider, Header, Content } = Layout;

export function AppLayout() {
  const { user, permissions, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const has = (code: string) => permissions.includes(code);
  const adminItems = [
    ...(has('user:manage') ? [{ key: '/admin/users', icon: <TeamOutlined />, label: '用户管理' }] : []),
    ...(has('role:manage') || has('user:manage') ? [{ key: '/admin/roles', icon: <SafetyCertificateOutlined />, label: '角色管理' }] : []),
    ...(has('category:manage') ? [{ key: '/admin/categories', icon: <TagsOutlined />, label: '分类管理' }] : []),
    ...(has('workflow:manage') ? [{ key: '/admin/workflows', icon: <ApartmentOutlined />, label: '流程配置' }] : []),
    ...(has('audit:view') ? [{ key: '/admin/audit', icon: <AuditOutlined />, label: '审计日志' }] : [])
  ];

  const items = [
    { key: '/dashboard', icon: <HomeOutlined />, label: '仪表盘' },
    { key: '/documents', icon: <FileTextOutlined />, label: '我的文档' },
    { key: '/approvals', icon: <AuditOutlined />, label: '审批中心' },
    { key: '/notifications', icon: <BellOutlined />, label: '通知中心' },
    ...(adminItems.length ? [{ type: 'group' as const, label: '系统管理', children: adminItems }] : [])
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="dark" width={220}>
        <div style={{ color: '#fff', fontSize: 18, fontWeight: 600, padding: 16, textAlign: 'center' }}>文档审批系统</div>
        <Menu theme="dark" mode="inline" selectedKeys={[location.pathname]} items={items} onClick={(e) => navigate(e.key)} />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', paddingInline: 24 }}>
          <Badge dot style={{ marginRight: 16 }}>
            <BellOutlined style={{ fontSize: 18, cursor: 'pointer' }} onClick={() => navigate('/notifications')} />
          </Badge>
          <Dropdown
            menu={{
              items: [{ key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: () => { logout(); navigate('/login'); } }]
            }}
          >
            <span style={{ cursor: 'pointer' }}><UserOutlined /> {user?.name ?? '用户'}</span>
          </Dropdown>
        </Header>
        <Content style={{ margin: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}