// frontend/src/contexts/AuthContext.jsx
import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [email, setEmail] = useState(() => localStorage.getItem('email') || '');

  useEffect(() => {
    if (token) localStorage.setItem('token', token);
    else localStorage.removeItem('token');
  }, [token]);

  useEffect(() => {
    if (email) localStorage.setItem('email', email);
    else localStorage.removeItem('email');
  }, [email]);

  async function login(emailInput, password) {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: emailInput, password }),
    });
    if (!res?.access_token) throw new Error('No token');
    setToken(res.access_token);
    setEmail(emailInput);
    return true;
  }

  function logout() {
    setToken(null);
    setEmail('');
  }

  const value = useMemo(() => ({ token, email, login, logout }), [token, email]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
