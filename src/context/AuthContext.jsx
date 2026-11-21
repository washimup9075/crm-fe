import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api, { initCsrf, setUnauthorizedHandler } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMeta = useCallback(async () => {
    try { const r = await api.get('/meta'); setMeta(r.data.data); } catch { /* not logged in */ }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    (async () => {
      await initCsrf().catch(() => {});
      try {
        const r = await api.get('/auth/me');
        setUser(r.data.data);
        if (!r.data.data.mustChangePassword) await loadMeta();
      } catch { setUser(null); }
      setLoading(false);
    })();
  }, [loadMeta]);

  const login = async (login, password) => {
    const r = await api.post('/auth/login', { login, password });
    setUser(r.data.data);
    if (!r.data.data.mustChangePassword) await loadMeta();
    return r.data.data;
  };
  const register = async (data) => {
    const r = await api.post('/auth/register', data);
    setUser(r.data.data);
    await loadMeta();
    return r.data.data;
  };
  const logout = async () => {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    setUser(null);
  };
  const refresh = async () => {
    const r = await api.get('/auth/me');
    setUser(r.data.data);
    await loadMeta();
  };
  const can = (...perms) => !!user && perms.some((p) => user.permissions?.includes(p));

  return <AuthContext.Provider value={{ user, meta, loading, login, register, logout, refresh, can, setUser }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
