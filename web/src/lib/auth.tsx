'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: 'cliente' | 'admin';
};

type AuthResponse = { token: string; user: SessionUser };

type AuthState = {
  user: SessionUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('libroya_token');
    if (!token) {
      setReady(true);
      return;
    }
    api<SessionUser>('/api/auth/me')
      .then(setUser)
      .catch(() => localStorage.removeItem('libroya_token'))
      .finally(() => setReady(true));
  }, []);

  function persist(data: AuthResponse) {
    localStorage.setItem('libroya_token', data.token);
    setUser(data.user);
  }

  async function login(email: string, password: string) {
    const data = await api<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    persist(data);
  }

  async function register(name: string, email: string, password: string) {
    const data = await api<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    persist(data);
  }

  function logout() {
    localStorage.removeItem('libroya_token');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return value;
}
