import axios from 'axios';

export const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
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