import { api } from './client';

export interface LoginResult {
  accessToken: string;
  user: { id: string; username: string; name: string; departmentId: string | null; roles: string[] };
}

export const authApi = {
  login: (username: string, password: string) =>
    api.post<LoginResult>('/auth/login', { username, password }).then((r) => r.data)
};