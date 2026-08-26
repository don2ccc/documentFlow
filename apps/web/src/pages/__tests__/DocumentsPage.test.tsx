import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DocumentsPage } from '../DocumentsPage';

vi.mock('../../api/endpoints', () => ({
  documentsApi: {
    list: vi.fn(async () => ({
      items: [{ id: 'd1', title: '测试文档', status: 'in_approval', createdAt: '2026-08-01T10:00:00Z', latestVersion: null }],
      total: 1, page: 1, pageSize: 20
    })),
    withdraw: vi.fn(), remind: vi.fn(), submit: vi.fn(), upload: vi.fn(), get: vi.fn(), addVersion: vi.fn()
  },
  dashboardApi: { summary: vi.fn(async () => ({ todoCount: 0, myPending: 1, myApproved: 2, myRejected: 0, recentInstances: [] })) },
  workflowsApi: { list: vi.fn(async () => []) },
  categoriesApi: { list: vi.fn(async () => []) }
}));

vi.mock('../../api/client', () => ({ api: { get: vi.fn(), post: vi.fn() } }));

describe('DocumentsPage', () => {
  it('renders document rows with status tag', async () => {
    render(
      <MemoryRouter>
        <DocumentsPage />
      </MemoryRouter>
    );
    expect(await screen.findByText('测试文档')).toBeInTheDocument();
    expect(await screen.findByText('审批中')).toBeInTheDocument();
  });
});