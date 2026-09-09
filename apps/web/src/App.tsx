import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ApprovalsPage } from './pages/ApprovalsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ApplicationsPage } from './pages/ApplicationsPage';
import { ApplicationQueryPage } from './pages/ApplicationQueryPage';
import { ApplicationDetailPage } from './pages/ApplicationDetailPage';
import { DocumentDetailPage } from './pages/DocumentDetailPage';
import { AccountSettingsPage } from './pages/AccountSettingsPage';
import { UsersPage } from './pages/admin/UsersPage';
import { RolesPage } from './pages/admin/RolesPage';
import { CategoriesPage } from './pages/admin/CategoriesPage';
import { DepartmentsPage } from './pages/admin/DepartmentsPage';
import { WorkshopsPage } from './pages/admin/WorkshopsPage';
import { WorkflowsPage } from './pages/admin/WorkflowsPage';
import { WorkflowEditPage } from './pages/admin/WorkflowEditPage';
import { AuditLogsPage } from './pages/admin/AuditLogsPage';
import { SystemSettingsPage } from './pages/admin/SystemSettingsPage';
import { VersionsPage } from './pages/admin/VersionsPage';
import { DatabaseManagementPage } from './pages/admin/DatabaseManagementPage';
import { DormitoryPage } from './pages/admin/DormitoryPage';
import { ComingSoonPage } from './pages/ComingSoonPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';

export function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <AuthProvider>
        <BrowserRouter>
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
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ConfigProvider>
  );
}