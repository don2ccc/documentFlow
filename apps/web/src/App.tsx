import { lazy, Suspense } from 'react';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/AppLayout';
import { PageLoader } from './components/PageLoader';
import { LoginPage } from './pages/LoginPage';
import { theme } from './theme';

// 登录页保持同步加载：它是未鉴权时的首屏，多一次网络往返没有意义。
// 其余页面全部按路由懒加载，各自打成独立 chunk，首屏不再下载 xlsx / mammoth / react-pdf。
const ChangePasswordPage = lazy(() =>
  import('./pages/ChangePasswordPage').then((m) => ({ default: m.ChangePasswordPage }))
);
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage }))
);
const ApprovalsPage = lazy(() =>
  import('./pages/ApprovalsPage').then((m) => ({ default: m.ApprovalsPage }))
);
const NotificationsPage = lazy(() =>
  import('./pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage }))
);
const ApplicationsPage = lazy(() =>
  import('./pages/ApplicationsPage').then((m) => ({ default: m.ApplicationsPage }))
);
const ApplicationQueryPage = lazy(() =>
  import('./pages/ApplicationQueryPage').then((m) => ({ default: m.ApplicationQueryPage }))
);
const ApplicationDetailPage = lazy(() =>
  import('./pages/ApplicationDetailPage').then((m) => ({ default: m.ApplicationDetailPage }))
);
const DocumentDetailPage = lazy(() =>
  import('./pages/DocumentDetailPage').then((m) => ({ default: m.DocumentDetailPage }))
);
const AccountSettingsPage = lazy(() =>
  import('./pages/AccountSettingsPage').then((m) => ({ default: m.AccountSettingsPage }))
);
const UsersPage = lazy(() =>
  import('./pages/admin/UsersPage').then((m) => ({ default: m.UsersPage }))
);
const RolesPage = lazy(() =>
  import('./pages/admin/RolesPage').then((m) => ({ default: m.RolesPage }))
);
const CategoriesPage = lazy(() =>
  import('./pages/admin/CategoriesPage').then((m) => ({ default: m.CategoriesPage }))
);
const DepartmentsPage = lazy(() =>
  import('./pages/admin/DepartmentsPage').then((m) => ({ default: m.DepartmentsPage }))
);
const WorkshopsPage = lazy(() =>
  import('./pages/admin/WorkshopsPage').then((m) => ({ default: m.WorkshopsPage }))
);
const WorkflowsPage = lazy(() =>
  import('./pages/admin/WorkflowsPage').then((m) => ({ default: m.WorkflowsPage }))
);
const WorkflowEditPage = lazy(() =>
  import('./pages/admin/WorkflowEditPage').then((m) => ({ default: m.WorkflowEditPage }))
);
const AuditLogsPage = lazy(() =>
  import('./pages/admin/AuditLogsPage').then((m) => ({ default: m.AuditLogsPage }))
);
const SystemSettingsPage = lazy(() =>
  import('./pages/admin/SystemSettingsPage').then((m) => ({ default: m.SystemSettingsPage }))
);
const VersionsPage = lazy(() =>
  import('./pages/admin/VersionsPage').then((m) => ({ default: m.VersionsPage }))
);
const DatabaseManagementPage = lazy(() =>
  import('./pages/admin/DatabaseManagementPage').then((m) => ({ default: m.DatabaseManagementPage }))
);
const DormitoryPage = lazy(() =>
  import('./pages/admin/DormitoryPage').then((m) => ({ default: m.DormitoryPage }))
);
const EmployeesPage = lazy(() =>
  import('./pages/admin/EmployeesPage').then((m) => ({ default: m.EmployeesPage }))
);
const ComingSoonPage = lazy(() =>
  import('./pages/ComingSoonPage').then((m) => ({ default: m.ComingSoonPage }))
);

export function App() {
  return (
    <ConfigProvider locale={zhCN} theme={theme}>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader full />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/change-password" element={<ChangePasswordPage />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/documents/:id" element={<DocumentDetailPage />} />
                  <Route path="/applications" element={<ApplicationsPage />} />
                  <Route path="/applications/query" element={<ApplicationQueryPage />} />
                  <Route path="/applications/:id" element={<ApplicationDetailPage />} />
                  <Route path="/approvals" element={<ApprovalsPage />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                  <Route path="/account-settings" element={<AccountSettingsPage />} />
                  <Route path="/admin/users" element={<UsersPage />} />
                  <Route path="/admin/roles" element={<RolesPage />} />
                  <Route path="/admin/categories" element={<CategoriesPage />} />
                  <Route path="/admin/departments" element={<DepartmentsPage />} />
                  <Route path="/admin/workshops" element={<WorkshopsPage />} />
                  <Route path="/admin/workflows" element={<WorkflowsPage />} />
                  <Route path="/admin/workflows/:id" element={<WorkflowEditPage />} />
                  <Route path="/admin/audit" element={<AuditLogsPage />} />
                  <Route path="/admin/settings" element={<SystemSettingsPage />} />
                  <Route path="/admin/versions" element={<VersionsPage />} />
                  <Route path="/admin/database" element={<DatabaseManagementPage />} />
                  <Route path="/admin/dormitory" element={<DormitoryPage />} />
                  <Route path="/admin/labor-protection" element={<ComingSoonPage />} />
                  <Route path="/production" element={<ComingSoonPage />} />
                  <Route path="/hr" element={<ComingSoonPage />} />
                  <Route path="/hr/employees" element={<EmployeesPage />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Route>
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ConfigProvider>
  );
}
