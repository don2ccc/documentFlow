import { Spin } from 'antd';

/**
 * 路由懒加载时的占位。
 * 内页用默认值：只在内容区居中显示，侧边栏与顶栏保持不动，避免整页闪白。
 * 整页场景（登录 / 改密）传 full，占满一屏。
 */
export function PageLoader({ full = false }: { full?: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="页面加载中"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: full ? '100vh' : 240,
        background: full ? '#f5f5f5' : 'transparent'
      }}
    >
      <Spin size="large" />
    </div>
  );
}
