'use client';

import Link from 'next/link';
import { useAuth } from '../lib/auth';
import { useCart } from '../lib/cart';

export function Header() {
  const { user, ready, logout } = useAuth();
  const { count } = useCart();

  return (
    <header className="border-b border-stone-300 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <Link href="/" className="text-xl font-semibold tracking-tight">
          LibroYa
        </Link>
        <nav className="flex flex-wrap items-center gap-4 text-sm">
          <Link href="/" className="hover:underline">
            Catálogo
          </Link>
          {(!user || user.role === 'cliente') && (
            <Link href="/carrito" className="hover:underline">
              Carrito ({count})
            </Link>
          )}
          {ready && user?.role === 'cliente' && (
            <Link href="/pedidos" className="hover:underline">
              Mis pedidos
            </Link>
          )}
          {ready && user?.role === 'admin' && (
            <>
              <Link href="/admin/libros" className="hover:underline">
                Libros y stock
              </Link>
              <Link href="/admin/envios" className="hover:underline">
                Tablero de envíos
              </Link>
            </>
          )}
          {ready && user ? (
            <>
              <span className="text-stone-600">
                {user.name} · {user.role}
              </span>
              <button type="button" onClick={logout} className="underline">
                Salir
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="underline">
                Entrar
              </Link>
              <Link href="/registro" className="underline">
                Crear cuenta
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
