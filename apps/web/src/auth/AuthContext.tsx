import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { authApi } from '../api/endpoints';
import { decodeToken } from '../api/client';

interface AuthState {
  user: { id: string; username: string; name: string; departmentId: string | null; roles: string[] } | null;
  token: string | null;
  permissions: string[];
  mustChangePassword: boolean;
  login: (username: string, password: string) => Promise<{ mustChangePassword: boolean }>;
  logout: () => void;
  clearMustChangePassword: () => void;
}

const AuthContext = createContext<AuthState | null>(null);
const MCP_FLAG_KEY = 'auth-must-change-password';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<AuthState['user']>(() => {
    try {
      const raw = localStorage.getItem('auth-user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(
    () => localStorage.getItem(MCP_FLAG_KEY) === '1'
  );

  useEffect(() => {
    if (token) {
      const payload = decodeToken(token);
      setUser((prev) => prev ?? { id: payload.sub, username: payload.username, name: payload.username, departmentId: null, roles: payload.roles });
    }
  }, [token]);

  useEffect(() => {
    if (mustChangePassword) localStorage.setItem(MCP_FLAG_KEY, '1');
    else localStorage.removeItem(MCP_FLAG_KEY);
  }, [mustChangePassword]);

  const permissions = useMemo(() => {
    if (!token) return [];
    try {
      return decodeToken(token).permissions;
    } catch {
      return [];
    }
  }, [token]);

  const login = useCallback(async (username: string, password: string) => {
    const result = await authApi.login(username, password);
    localStorage.setItem('token', result.accessToken);
    localStorage.setItem('auth-user', JSON.stringify(result.user));
    setToken(result.accessToken);
    setUser(result.user);
    const flag = !!result.mustChangePassword;
    setMustChangePassword(flag);
    return { mustChangePassword: flag };
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('auth-user');
    localStorage.removeItem(MCP_FLAG_KEY);
    setToken(null);
    setUser(null);
    setMustChangePassword(false);
  }, []);

  const clearMustChangePassword = useCallback(() => {
    setMustChangePassword(false);
  }, []);

  const value = useMemo(
    () => ({ user, token, permissions, mustChangePassword, login, logout, clearMustChangePassword }),
    [user, token, permissions, mustChangePassword, login, logout, clearMustChangePassword]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}