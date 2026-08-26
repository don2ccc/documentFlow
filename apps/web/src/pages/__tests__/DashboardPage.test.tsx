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