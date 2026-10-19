import type { ThemeConfig } from 'antd';

/**
 * 全站设计令牌。
 *
 * 品牌色取自登录页与侧边栏（#ff6b1a），此前 antd 组件一直用默认蓝
 * #1677ff，导致「登录页橙色、进去以后全是蓝色」的割裂。这里统一到品牌色，
 * 色值不要再在页面里硬编码。
 */
export const brand = {
  primary: '#ff6b1a',
  primaryHover: '#e85f15',
  primaryActive: '#d4520f',
  primarySoft: '#fff3ec',
  gradient: 'linear-gradient(90deg, #ff6b1a 0%, #ff8c4a 100%)',
  navy: '#141e2f',
  navySoft: '#223149',
  navyText: '#c8d1df',
  navyMuted: '#8e9aae'
} as const;

/** 状态色：全站统一，避免每个页面各写一套 */
export const statusColor = {
  pending: '#2f6fed',
  progress: '#ff6b1a',
  success: '#22c55e',
  danger: '#ef4444',
  neutral: '#94a3b8'
} as const;

/** 页面级令牌：间距 / 圆角 / 文字层级 / 阴影 */
export const tokens = {
  space: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  radius: { sm: 6, md: 8, lg: 12 },
  text: {
    primary: '#0f172a',
    secondary: '#475569',
    muted: '#94a3b8'
  },
  border: '#e5e8ee',
  pageBg: '#f5f6f8',
  shadow: {
    sm: '0 1px 2px rgba(15,23,42,.06)',
    md: '0 2px 8px rgba(15,23,42,.08)',
    lg: '0 10px 28px rgba(15,23,42,.12)'
  }
} as const;

export const theme: ThemeConfig = {
  token: {
    colorPrimary: brand.primary,
    colorInfo: brand.primary,
    colorLink: brand.primary,
    colorLinkHover: brand.primaryHover,
    colorSuccess: statusColor.success,
    colorWarning: '#faad14',
    colorError: statusColor.danger,
    colorTextBase: tokens.text.primary,
    colorBorder: tokens.border,
    borderRadius: tokens.radius.md,
    controlHeight: 36,
    fontSize: 14,
    fontFamily:
      '"PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", "Source Han Sans SC", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
  },
  components: {
    Button: { primaryShadow: 'none', fontWeight: 500 },
    Card: { headerFontSize: 15 },
    Table: {
      headerBg: '#fafbfc',
      headerColor: tokens.text.secondary,
      borderColor: tokens.border
    },
    Layout: { headerBg: '#ffffff', bodyBg: tokens.pageBg },
    Menu: { itemBorderRadius: tokens.radius.md }
  }
};
