import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: { name: '员工' },
    permissions: ['document:upload', 'approval:handle'],
    logout: vi.fn()
  })
}));

/**
 * 菜单在 6502d8c 之后改成默认折叠的二级菜单（177677a 又去掉了 defaultOpenKeys），
 * 子项在展开前不会进入 DOM。所以要断言子项必须先点开父级菜单，
 * 否则查不到任何子项，断言会形同虚设——原来的测试就是这么失效的。
 */
const expand = async (title: string, popupId: string) => {
  fireEvent.click(screen.getByText(title));
  await waitFor(() =>
    expect(document.querySelector(`[aria-controls$="${popupId}-popup"]`))
      .toHaveAttribute('aria-expanded', 'true')
  );
};

describe('AppLayout admin menu', () => {
  it('hides admin menu for employee without manage permissions', async () => {
    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>
    );

    // 无条件渲染的一级菜单
    expect(screen.getByText('WorkFlow管理')).toBeInTheDocument();
    expect(screen.getByText('行政管理')).toBeInTheDocument();
    expect(screen.getByText('生产管理')).toBeInTheDocument();
    expect(screen.getByText('HR管理')).toBeInTheDocument();

    // 该用户没有任何系统级权限，systemAdminChildren 为空，
    // AppLayout 里 if (systemAdminChildren.length) 才 push，整组「系统管理」不应出现
    expect(screen.queryByText('系统管理')).not.toBeInTheDocument();

    // 展开工作流菜单：document:upload / approval:handle 对应的子项可见
    await expand('WorkFlow管理', 'workflow');
    expect(screen.getByText('仪表盘')).toBeInTheDocument();
    expect(screen.getByText('我的申请')).toBeInTheDocument();
    expect(screen.getByText('审批中心')).toBeInTheDocument();
    expect(screen.getByText('通知中心')).toBeInTheDocument();
    // 没有 application:query
    expect(screen.queryByText('申请查询')).not.toBeInTheDocument();

    // 展开行政管理：只剩两个无条件项，管理类子项都不该出现
    await expand('行政管理', 'admin');
    expect(screen.getByText('宿舍管理')).toBeInTheDocument();
    expect(screen.getByText('劳保用品')).toBeInTheDocument();
    expect(screen.queryByText('用户管理')).not.toBeInTheDocument();
    expect(screen.queryByText('角色管理')).not.toBeInTheDocument();

    // 展开 HR 管理：没有 hr:view，不应出现员工档案
    await expand('HR管理', 'hr');
    expect(screen.queryByText('员工档案')).not.toBeInTheDocument();
  });
});