import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  timeout: 60_000
});

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err.response?.status;
    const url: string = err.config?.url || '';
    // 登录接口的 401 是「用户名不存在 / 密码错误 / 账号已停用」，
    // 不能被当成「会话过期」清掉凭据再跳转回 /login，否则错误 toast 根本来不及显示页面就被刷新了。
    const isLoginRequest = url.includes('/auth/login');
    if (status === 401 && !isLoginRequest) {
      localStorage.removeItem('token');
      localStorage.removeItem('auth-user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export interface JwtPayload {
  sub: string;
  username: string;
  roles: string[];
  permissions: string[];
}

export function decodeToken(token: string): JwtPayload {
  const part = token.split('.')[1];
  const json = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
  return { sub: json.sub, username: json.username, roles: json.roles ?? [], permissions: json.permissions ?? [] };
}