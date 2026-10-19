import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from '../DashboardPage';

vi.mock('../../api/endpoints', () => ({
  dashboardApi: {
    summary: vi.fn(async () => ({ todoCount: 3, myPending: 2, myApproved: 5, myRejected: 1, recentInstances: [] }))
  }
}));
vi.mock('../../api/client', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));

// 仪表盘用 permissions 过滤快捷入口，测试里给一个最小可用的鉴权上下文
vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', username: 'tester', name: '测试用户', departmentId: null, roles: [] },
    token: 'test-token',
    permissions: [],
    mustChangePassword: false,
    login: vi.fn(),
    logout: vi.fn(),
    clearMustChangePassword: vi.fn()
  })
}));

describe('DashboardPage', () => {
  it('renders stat cards', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );
    expect(await screen.findByText('3')).toBeInTheDocument();
    expect(await screen.findByText('5')).toBeInTheDocument();
  });
});