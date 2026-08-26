import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { authApi } from '../api/endpoints';
import { decodeToken } from '../api/client';

interface AuthState {
  user: { id: string; username: string; name: string; departmentId: string | null; roles: string[] } | null;
  token: string | null;
  permissions: string[];
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

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

  useEffect(() => {
    if (token) {
      const payload = decodeToken(token);
      setUser((prev) => prev ?? { id: payload.sub, username: payload.username, name: payload.username, departmentId: null, roles: payload.roles });
    }
  }, [token]);

  const permissions = useMemo(() => {
    if (!token) return [];
    try {
      return decodeToken(token).permissions;
    } catch {
      return [];
    }
  }, [token]);

  const login = async (username: string, password: string) => {
    const result = await authApi.login(username, password);
    localStorage.setItem('token', result.accessToken);
    localStorage.setItem('auth-user', JSON.stringify(result.user));
    setToken(result.accessToken);
    setUser(result.user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('auth-user');
    setToken(null);
    setUser(null);
  };

  const value = useMemo(() => ({ user, token, permissions, login, logout }), [user, token, permissions]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}