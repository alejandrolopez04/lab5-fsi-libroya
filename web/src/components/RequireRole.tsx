'use client';

import Link from 'next/link';
import { useAuth } from '../lib/auth';

export function RequireRole({ role, children }: { role?: 'cliente' | 'admin'; children: React.ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return <p className="text-stone-600">Cargando…</p>;
  if (!user) {
    return (
      <p className="rounded-md border border-stone-300 bg-white p-4">
        Debes <Link href="/login" className="underline">iniciar sesión</Link> para ver esta página.
      </p>
    );
  }
  if (role && user.role !== role) {
    return (
      <p className="rounded-md border border-red-300 bg-red-50 p-4 text-red-800">
        Acceso denegado: esta sección es solo para el rol {role}.
      </p>
    );
  }
  return <>{children}</>;
}
