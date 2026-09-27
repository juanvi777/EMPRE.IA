'use client';

import { useEffect, useState } from 'react';
import Login from './login';
import Dashboard from './dashboard';
import type { ApiState } from './dashboard';

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:3001';

export default function SessionGate({ api }: { api: ApiState }) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  useEffect(() => { const token = localStorage.getItem('empre-token'); if (!token) { setAuthenticated(false); return; } fetch(`${API}/auth/me`, { headers: { authorization: `Bearer ${token}` } }).then(r => setAuthenticated(r.ok)).catch(() => setAuthenticated(false)); }, []);
  if (authenticated === null) return <div className="boot-screen">Cargando EMPRE.IA…</div>;
  if (!authenticated) return <Login onAuthenticated={() => setAuthenticated(true)} />;
  return <Dashboard api={api} onLogout={() => { localStorage.removeItem('empre-token'); setAuthenticated(false); }} />;
}
