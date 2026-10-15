import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../auth/AuthContext';
import { LoginPage } from '../LoginPage';

vi.mock('../../api/client', () => ({
  api: {
    post: vi.fn(async () => ({
      data: {
        accessToken: 't',
        user: { id: '1', username: 'admin', name: '管理员', departmentId: null, roles: ['sys_admin'] }
      }
    }))
  },
  decodeToken: (token: string) => ({ sub: '1', username: 'admin', roles: ['sys_admin'], permissions: ['user:manage'] })
}));

describe('LoginPage', () => {
  beforeEach(() => localStorage.clear());

  it('calls login and stores token', async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>
    );
    // placeholder 已随登录页改版变为「用户名 / 员工工号」，见 LoginPage.tsx
fireEvent.change(screen.getByPlaceholderText('用户名 / 员工工号'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('密码'), { target: { value: 'Admin@123' } });
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(localStorage.getItem('token')).toBe('t'));
  });
});