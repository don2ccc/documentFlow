import { Layout, Menu, Dropdown, Badge } from "antd";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  AuditOutlined, BellOutlined, TeamOutlined, TagsOutlined,
  ApartmentOutlined, SafetyCertificateOutlined, LogoutOutlined, UserOutlined,
  SettingOutlined, ProjectOutlined, SearchOutlined, DatabaseOutlined, HistoryOutlined,
  ToolOutlined, IdcardOutlined, HomeOutlined, SkinOutlined, BankOutlined, ClusterOutlined,

} from "@ant-design/icons";
import { Suspense, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { PageLoader } from "./PageLoader";
import { versionsApi, AppVersion } from "../api/endpoints";
import { StorageIndicator } from "./StorageIndicator";

const SIDEBAR_CSS = `
.app-sider {
  background: #141e2f !important;
}
.app-sider .app-sidebar-header {
  margin: 14px 10px 10px;
  padding: 14px 8px 10px;
  background: transparent;
  border: 0;
  border-radius: 0;
  color: #ffffff;
  letter-spacing: 0.3px;
}
.app-sider .app-sidebar-header-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.app-sider .app-sidebar-logo {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 2px 6px rgba(0,0,0,0.28);
}
.app-sider .app-sidebar-logo img {
  width: 30px;
  height: 30px;
  object-fit: contain;
  display: block;
}
.app-sider .app-sidebar-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
  flex: 1;
  min-width: 0;
}
.app-sider .app-sidebar-title-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.app-sider .app-sidebar-pro-badge {
  background: linear-gradient(90deg, #ff6b1a 0%, #ff8c4a 100%);
  color: #ffffff;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  flex-shrink: 0;
  letter-spacing: 0.5px;
}
.app-sider .app-sidebar-subtitle {
  margin-top: 8px;
  font-size: 11px;
  color: #8e9aae;
  padding-left: 44px;
  letter-spacing: 0.4px;
}
.app-sider .ant-menu-dark,
.app-sider .ant-menu-dark .ant-menu {
  background: transparent !important;
}
.app-sider .ant-menu-dark .ant-menu-item,
.app-sider .ant-menu-dark .ant-menu-submenu-title {
  color: #c8d1df !important;
  margin: 4px 12px !important;
  width: calc(100% - 24px) !important;
  border-radius: 8px !important;
}
.app-sider .ant-menu-dark .ant-menu-item .ant-menu-item-icon,
.app-sider .ant-menu-dark .ant-menu-submenu-title .ant-menu-item-icon {
  color: #aeb9c9 !important;
}
.app-sider .ant-menu-dark .ant-menu-item:hover,
.app-sider .ant-menu-dark .ant-menu-submenu-title:hover {
  color: #ffffff !important;
  background: #223149 !important;
}
.app-sider .ant-menu-dark .ant-menu-item-selected,
.app-sider .ant-menu-dark .ant-menu-submenu-selected > .ant-menu-submenu-title {
  background: #f36b21 !important;
  color: #ffffff !important;
  box-shadow: 0 4px 12px rgba(243,107,33,0.25);
}
.app-sider .ant-menu-dark .ant-menu-item-selected::after,
.app-sider .ant-menu-dark .ant-menu-submenu-selected::after {
  display: none !important;
}
.app-sider .ant-menu-dark .ant-menu-item-selected .ant-menu-item-icon,
.app-sider .ant-menu-dark .ant-menu-item-selected .anticon,
.app-sider .ant-menu-dark .ant-menu-submenu-selected > .ant-menu-submenu-title .ant-menu-item-icon,
.app-sider .ant-menu-dark .ant-menu-submenu-selected > .ant-menu-submenu-title .anticon {
  color: #ffffff !important;
}
.app-sider .ant-menu-dark .ant-menu-sub .ant-menu-item {
  margin: 2px 12px 2px 28px !important;
  width: calc(100% - 40px) !important;
}
.app-sider .ant-menu-dark .ant-menu-sub .ant-menu-item-selected {
  background: rgba(243,107,33,0.16) !important;
  color: #ff9a5d !important;
  box-shadow: none;
}
.app-sider .ant-menu-dark .ant-menu-sub .ant-menu-item-selected .ant-menu-item-icon {
  color: #ff9a5d !important;
}
.app-sider .ant-menu-dark .ant-menu-inline > .ant-menu-submenu > .ant-menu-submenu-title .ant-menu-submenu-arrow {
  color: #f36b21;
}
`;

const { Sider, Header, Content } = Layout;

const KEY_WORKFLOW = "menu-workflow";
const KEY_ADMIN = "menu-admin";
const KEY_PRODUCTION = "menu-production";
const KEY_HR = "menu-hr";
const KEY_SYSTEM = "menu-system";

export function AppLayout() {
  const { user, permissions, logout } = useAuth();
  const [appVersion, setAppVersion] = useState<AppVersion | null>(null);
  useEffect(() => {
    versionsApi.current().then(setAppVersion).catch(() => setAppVersion(null));
  }, []);
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
    // Older admin tokens may not include the newly added permission.
    ...(has("department:manage") || user?.roles?.includes("sys_admin") ? [{ key: "/admin/departments", icon: <ClusterOutlined />, label: "部门管理" }] : []),
    ...(has("workshop:manage") || user?.roles?.includes("sys_admin") ? [{ key: "/admin/workshops", icon: <ApartmentOutlined />, label: "科室管理" }] : []),
    ...(has("workflow:manage") ? [{ key: "/admin/workflows", icon: <ApartmentOutlined />, label: "流程配置" }] : []),
    ...(has("audit:view") ? [{ key: "/admin/audit", icon: <AuditOutlined />, label: "审计日志" }] : []),
    ...(has("setting:manage") ? [{ key: "/admin/settings", icon: <SettingOutlined />, label: "邮件设置" }] : []),
    ...(has("setting:manage") || user?.roles?.includes("sys_admin") ? [{ key: "/admin/versions", icon: <HistoryOutlined />, label: "版本管理" }] : []),
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
      icon: <TeamOutlined />,
      label: "HR管理",
      children: [
        // 只读权限即可查看档案，写操作由 hr:manage 控制
        ...(has("hr:view") || user?.roles?.includes("sys_admin")
          ? [{ key: "/hr/employees", icon: <IdcardOutlined />, label: "员工档案" }]
          : []),
        { key: "/hr", icon: <TeamOutlined />, label: "（正在开发中）" }
      ]
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

  // ---- 顶栏标题：原来顶栏重复了一遍侧边栏的品牌信息，改成显示当前位置 ----
  const menuTitles = new Map<string, { label: string; group: string }>();
  items.forEach((group: any) => {
    (group.children ?? []).forEach((child: any) => {
      menuTitles.set(child.key, { label: child.label, group: group.label });
    });
  });

  const EXTRA_TITLES: Record<string, string> = {
    "/account-settings": "帐号设置",
    "/change-password": "修改密码"
  };

  function resolveTitle(pathname: string): { label: string; group: string } {
    const hit = menuTitles.get(pathname);
    if (hit) return hit;
    if (EXTRA_TITLES[pathname]) return { label: EXTRA_TITLES[pathname], group: "个人中心" };
    if (/^\/applications\/[^/]+$/.test(pathname)) return { label: "申请详情", group: "WorkFlow管理" };
    if (/^\/documents\/[^/]+$/.test(pathname)) return { label: "文档详情", group: "WorkFlow管理" };
    if (/^\/admin\/workflows\/[^/]+$/.test(pathname)) return { label: "流程编辑", group: "系统管理" };
    return { label: "SPO 办公系统", group: "企业协同中枢平台" };
  }

  const current = resolveTitle(location.pathname);

  return (
    <>
      <style>{SIDEBAR_CSS}</style>
    <Layout style={{ minHeight: "100vh" }}>
      <Sider theme="dark" width={220} className="app-sider" style={{ display: "flex", flexDirection: "column" }}>
        <div className="app-sidebar-header">
          <div className="app-sidebar-header-row">
            <div className="app-sidebar-logo">
              <img src="/yageo-logo.png" alt="YAGEO" />
            </div>
            <div className="app-sidebar-title">
              <span className="app-sidebar-title-text">SPO 办公系统</span>
              <span className="app-sidebar-pro-badge">PRO</span>
            </div>
          </div>
          <div className="app-sidebar-subtitle">企业协同中枢平台</div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={items}
          onClick={(e) => navigate(e.key)}
        />
        </div>
        <StorageIndicator />
        {appVersion ? (
          <div style={{ margin: "6px 16px 4px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, color: "rgba(255,255,255,0.55)", letterSpacing: 0.3 }}>
            <span>版本</span>
            <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: "rgba(255,255,255,0.85)" }}>
              {appVersion.version}
              {appVersion.commit ? <span style={{ opacity: 0.5 }}> · {appVersion.commit}</span> : null}
            </span>
          </div>
        ) : null}
      </Sider>
      <Layout>
        <Header style={{ background: "#ffffff", display: "flex", justifyContent: "space-between", alignItems: "center", paddingInline: 24, boxShadow: "0 1px 4px rgba(15, 23, 42, 0.06)" }}>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2, minWidth: 0 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", letterSpacing: 0.2 }}>
              {current.label}
            </span>
            <span style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.45)", marginTop: 2 }}>
              {current.group}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>
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
          </div>
        </Header>
        <Content style={{ margin: 24 }}>
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </Content>
      </Layout>
    </Layout>
    </>
  );
}
