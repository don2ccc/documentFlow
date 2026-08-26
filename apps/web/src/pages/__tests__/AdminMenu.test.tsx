import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: { name: '员工' },
    permissions: ['document:upload', 'approval:handle'],
    logout: vi.fn()
  })
}));

describe('AppLayout admin menu', () => {
  it('hides admin menu for employee without manage permissions', async () => {
    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>
    );
    expect(screen.queryByText('用户管理')).not.toBeInTheDocument();
    expect(screen.getByText('我的文档')).toBeInTheDocument();
  });
});