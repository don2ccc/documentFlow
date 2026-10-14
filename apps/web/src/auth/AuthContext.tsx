import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { authApi, usersApi } from '../api/endpoints';
import { decodeToken } from '../api/client';

interface AuthState {
  user: { id: string; username: string; name: string; departmentId: string | null; roles: string[] } | null;
  token: string | null;
  permissions: string[];
  mustChangePassword: boolean;
  login: (username: string, password: string, remember?: boolean) => Promise<{ mustChangePassword: boolean }>;
  logout: () => void;
  clearMustChangePassword: () => void;
}

const AuthContext = createContext<AuthState | null>(null);
const MCP_FLAG_KEY = 'auth-must-change-password';
const REMEMBER_KEY = 'auth-remember';
const TOKEN_KEY = 'token';
const USER_KEY = 'auth-user';

// remember=true  → localStorage (持久)
// remember=false → sessionStorage (关闭浏览器即失效)
function pickStorage(remember: boolean): Storage {
  return remember ? localStorage : sessionStorage;
}

function readToken(): string | null {
  if (typeof window === 'undefined') return null;
  // 默认按 localStorage 读取，兼容旧版无 REMEMBER_KEY 的浏览器
  const remembered = localStorage.getItem(REMEMBER_KEY) !== '0';
  return pickStorage(remembered).getItem(TOKEN_KEY);
}

function readUser<T>(): T | null {
  if (typeof window === 'undefined') return null;
  const remembered = localStorage.getItem(REMEMBER_KEY) !== '0';
  const raw = pickStorage(remembered).getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => readToken());
  const [user, setUser] = useState<AuthState['user']>(() => readUser<AuthState['user']>());
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(
    () => localStorage.getItem(MCP_FLAG_KEY) === '1'
  );
  // fresh permissions fetched from /api/users/me on mount + visibilitychange
  // preferred over the JWT-baked permissions for UI gating
  const [livePermissions, setLivePermissions] = useState<string[] | null>(null);

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
    if (livePermissions && livePermissions.length >= 0) return livePermissions;
    if (!token) return [];
    try {
      return decodeToken(token).permissions;
    } catch {
      return [];
    }
  }, [token, livePermissions]);

  const login = useCallback(async (username: string, password: string, remember = true) => {
    const result = await authApi.login(username, password);
    const storage = pickStorage(remember);
    storage.setItem(TOKEN_KEY, result.accessToken);
    storage.setItem(USER_KEY, JSON.stringify(result.user));
    // 清理反向存储，避免旧 token 残留
    const other = remember ? sessionStorage : localStorage;
    other.removeItem(TOKEN_KEY);
    other.removeItem(USER_KEY);
    localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0');
    setToken(result.accessToken);
    setUser(result.user);
    const flag = !!result.mustChangePassword;
    setMustChangePassword(flag);
    return { mustChangePassword: flag };
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    localStorage.removeItem(REMEMBER_KEY);
    setToken(null);
    setUser(null);
    setMustChangePassword(false);
  }, []);

  const clearMustChangePassword = useCallback(() => {
    setMustChangePassword(false);
  }, []);

  // fresh permissions: fetch /api/users/me on mount + whenever the tab becomes visible.
  // /me returns the latest permissions resolved from DB roles, so a stale JWT
  // (issued before admin granted a perm) no longer leaves the UI stuck.
  // /auth/refresh is kept as a fallback to mint a fresh JWT.
  useEffect(() => {
    if (!token) {
      setLivePermissions([]);
      return;
    }
    let inFlight = false;
    const run = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const me = await usersApi.getMe();
        if (Array.isArray(me?.permissions)) {
          setLivePermissions(me.permissions);
          if (me?.id) {
            // also persist the fresh user record so a refresh keeps it
            const remembered = localStorage.getItem(REMEMBER_KEY) !== '0';
            const storage = pickStorage(remembered);
            storage.setItem(USER_KEY, JSON.stringify(me));
          }
        }
      } catch {
        // /me failed (token expired/network) ? fall back to /auth/refresh
        try {
          const refreshed = await authApi.refresh();
          const remembered = localStorage.getItem(REMEMBER_KEY) !== '0';
          const storage = pickStorage(remembered);
          storage.setItem(TOKEN_KEY, refreshed.accessToken);
          storage.setItem(USER_KEY, JSON.stringify(refreshed.user));
          const other = remembered ? sessionStorage : localStorage;
          other.removeItem(TOKEN_KEY);
          other.removeItem(USER_KEY);
          setToken(refreshed.accessToken);
          setUser(refreshed.user);
          setMustChangePassword(!!refreshed.mustChangePassword);
          // also re-fetch me with the new token
          try {
            const me2 = await usersApi.getMe();
            if (Array.isArray(me2?.permissions)) setLivePermissions(me2.permissions);
          } catch { /* give up; fall back to JWT-baked perms */ }
        } catch { /* token really expired ? keep current state, app will redirect */ }
      } finally {
        inFlight = false;
      }
    };
    void run();
    const onVis = () => {
      if (document.visibilityState === 'visible') void run();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [token]);

  // when logout clears the token, drop the live perms too
  useEffect(() => {
    if (!token) setLivePermissions(null);
  }, [token]);

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