import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ApprovalsPage } from '../ApprovalsPage';

vi.mock('../../api/endpoints', () => ({
  approvalsApi: {
    todos: vi.fn(async () => ({
      items: [{ taskId: 't1', documentId: 'd1', title: 'Q3预算', nodeName: '财务审核', priority: 'high', dueAt: '2099-01-01T00:00:00Z', submittedByName: '张三', documentStatus: 'in_approval' }],
      total: 1, page: 1, pageSize: 20
    })),
    taskDetail: vi.fn(), approve: vi.fn(), reject: vi.fn(), transfer: vi.fn()
  },
  usersApi: { list: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 20 })) },
  documentsApi: {}, dashboardApi: {}, workflowsApi: {}, categoriesApi: {}
}));

vi.mock('../../api/client', () => ({ api: { get: vi.fn(), post: vi.fn() } }));

describe('ApprovalsPage', () => {
  it('renders todo with high priority tag', async () => {
    render(
      <MemoryRouter>
        <ApprovalsPage />
      </MemoryRouter>
    );
    expect(await screen.findByText('Q3预算')).toBeInTheDocument();
    expect(await screen.findByText('高')).toBeInTheDocument();
  });
});