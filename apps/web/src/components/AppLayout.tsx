import { Layout, Menu, Dropdown, Badge } from "antd";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  AuditOutlined, BellOutlined, TeamOutlined, TagsOutlined,
  ApartmentOutlined, SafetyCertificateOutlined, LogoutOutlined, UserOutlined,
  SettingOutlined, ProjectOutlined, SearchOutlined, DatabaseOutlined,
  ToolOutlined, IdcardOutlined, HomeOutlined, SkinOutlined, BankOutlined
} from "@ant-design/icons";
import { useAuth } from "../auth/AuthContext";

const { Sider, Header, Content } = Layout;

const KEY_WORKFLOW = "menu-workflow";
const KEY_ADMIN = "menu-admin";
const KEY_PRODUCTION = "menu-production";
const KEY_HR = "menu-hr";
const KEY_SYSTEM = "menu-system";

export function AppLayout() {
  const { user, permissions, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const has = (code: string) => permissions.includes(code);

  const workflowChildren: any[] = [
    { key: "/dashboard", icon: <HomeOutlined />, label: "仪表盘" },
    ...(has("document:upload") ? [{ key: "/applications", icon: <ProjectOutlined />, label: "我的申请" }] : []),
    ...(has("application:query") ? [{ key: "/applications/query", icon: <SearchOutlined />, label: "申请查询" }] : []),
    ...(has("approval:handle") ? [{ key: "/approvals", icon: <AuditOutlined />, label: "审批中心" }] : []),
    { key: "/notifications", icon: <BellOutlined />, label: "通知中心" }
  ];

  const systemAdminChildren: any[] = [
    ...(has("user:manage") ? [{ key: "/admin/users", icon: <TeamOutlined />, label: "用户管理" }] : []),
    ...(has("role:manage") || has("user:manage") ? [{ key: "/admin/roles", icon: <SafetyCertificateOutlined />, label: "角色管理" }] : []),
    ...(has("category:manage") ? [{ key: "/admin/categories", icon: <TagsOutlined />, label: "分类管理" }] : []),
    ...(has("workflow:manage") ? [{ key: "/admin/workflows", icon: <ApartmentOutlined />, label: "流程配置" }] : []),
    ...(has("audit:view") ? [{ key: "/admin/audit", icon: <AuditOutlined />, label: "审计日志" }] : []),
    ...(has("setting:manage") ? [{ key: "/admin/settings", icon: <SettingOutlined />, label: "邮件设置" }] : []),
    ...(has("database:manage") ? [{ key: "/admin/database", icon: <DatabaseOutlined />, label: "数据库管理" }] : [])
  ];

  const adminChildren: any[] = [
    { key: "/admin/dormitory", icon: <HomeOutlined />, label: "宿舍管理" },
    { key: "/admin/labor-protection", icon: <SkinOutlined />, label: "劳保用品" }
  ];

  const items: any[] = [
    {
      key: KEY_WORKFLOW,
      icon: <ApartmentOutlined />,
      label: "WorkFlow管理",
      children: workflowChildren
    },
    {
      key: KEY_ADMIN,
      icon: <BankOutlined />,
      label: "行政管理",
      children: adminChildren
    },
    {
      key: KEY_PRODUCTION,
      icon: <ToolOutlined />,
      label: "生产管理",
      children: [{ key: "/production", icon: <ToolOutlined />, label: "（正在开发中）" }]
    },
    {
      key: KEY_HR,
      icon: <IdcardOutlined />,
      label: "HR管理",
      children: [{ key: "/hr", icon: <IdcardOutlined />, label: "（正在开发中）" }]
    }
  ];

  if (systemAdminChildren.length) {
    items.push({
      key: KEY_SYSTEM,
      icon: <SettingOutlined />,
      label: "系统管理",
      children: systemAdminChildren
    });
  }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider theme="dark" width={220}>
        <div style={{ color: "#fff", fontSize: 18, fontWeight: 600, padding: 16, textAlign: "center" }}>SPO 办公系统</div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={items}
          onClick={(e) => navigate(e.key)}
        />
      </Sider>
      <Layout>
        <Header style={{ background: "#fff", display: "flex", justifyContent: "flex-end", alignItems: "center", paddingInline: 24 }}>
          <Badge dot style={{ marginRight: 16 }}>
            <BellOutlined style={{ fontSize: 18, cursor: "pointer" }} onClick={() => navigate("/notifications")} />
          </Badge>
          <Dropdown
            menu={{
              items: [
                { key: "account-settings", icon: <SettingOutlined />, label: "帐号设置", onClick: () => navigate("/account-settings") },
                { type: "divider" },
                { key: "logout", icon: <LogoutOutlined />, label: "退出登录", onClick: () => { logout(); navigate("/login"); } }
              ]
            }}
          >
            <span style={{ cursor: "pointer" }}><UserOutlined /> {user?.name ?? "用户"}</span>
          </Dropdown>
        </Header>
        <Content style={{ margin: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
