// frontend/src/contexts/AuthContext.jsx
import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const me = await apiFetch('/api/auth/whoami');
        setUser(me);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function login(email, password) {
    await apiFetch('/api/auth/login', { method: 'POST', body: { email, password } });
    const me = await apiFetch('/api/auth/whoami'); // ← Cookieで本人を取得
    setUser(me);
    return me;
  }

  async function logout() {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
  }

  const value = useMemo(() => ({
    user, authenticated: !!user, loading, login, logout,
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth(){ return useContext(AuthContext); }
