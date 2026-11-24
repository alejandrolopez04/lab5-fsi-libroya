'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useCart } from '../lib/cart';
import { useToast } from '../lib/toast';
import { type Book, money } from '../lib/format';

export default function CatalogPage() {
  const { user } = useAuth();
  const { add, items } = useCart();
  const { notify } = useToast();
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState('');
  const [format, setFormat] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Book[]>('/api/books')
      .then((all) => setCategories([...new Set(all.map((book) => book.category))].sort()))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (format) params.set('format', format);
    if (q.trim()) params.set('q', q.trim());
    setLoading(true);
    const timer = setTimeout(() => {
      api<Book[]>(`/api/books?${params.toString()}`)
        .then((data) => {
          setBooks(data);
          setError('');
        })
        .catch((err: Error) => setError(err.message))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [category, format, q]);

  const canBuy = !user || user.role === 'cliente';

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-semibold">Catálogo</h1>
      <div className="flex flex-wrap gap-3">
        <input
          placeholder="Buscar por título o autor"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          className="w-64 rounded border border-stone-300 px-3 py-2"
        />
        <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded border border-stone-300 px-3 py-2">
          <option value="">Todas las categorías</option>
          {categories.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select value={format} onChange={(event) => setFormat(event.target.value)} className="rounded border border-stone-300 px-3 py-2">
          <option value="">Todos los formatos</option>
          <option value="EBOOK">Ebook</option>
          <option value="FISICO">Físico</option>
        </select>
      </div>
      {error && <p className="text-red-700">{error}</p>}
      {loading ? (
        <p className="text-stone-600">Cargando…</p>
      ) : books.length === 0 ? (
        <p className="text-stone-600">No hay libros con esos filtros.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {books.map((book) => {
            const inCart = items.find((item) => item.bookId === book._id);
            const soldOut = book.format === 'FISICO' && book.stock <= 0;
            const ebookInCart = book.format === 'EBOOK' && Boolean(inCart);
            return (
              <li key={book._id} className="flex flex-col overflow-hidden rounded-md border border-stone-300 bg-white">
                <Link href={`/libros/${book._id}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={book.coverUrl || 'https://placehold.co/400x600?text=LibroYa'} alt={book.title} className="h-56 w-full object-cover" />
                </Link>
                <div className="flex flex-1 flex-col gap-1 p-3">
                  <span className="text-xs uppercase tracking-wide text-stone-500">
                    {book.category} · {book.format === 'EBOOK' ? 'Ebook' : 'Físico'}
                  </span>
                  <Link href={`/libros/${book._id}`} className="font-semibold hover:underline">
                    {book.title}
                  </Link>
                  <span className="text-sm text-stone-600">{book.author}</span>
                  <span className="mt-auto pt-2 font-medium">{money(book.priceCents)}</span>
                  {book.format === 'FISICO' && (
                    <span className="text-xs text-stone-500">{soldOut ? 'Agotado' : `Stock: ${book.stock}`}</span>
                  )}
                  {canBuy && (
                    <button
                      type="button"
                      disabled={soldOut || ebookInCart}
                      onClick={() => {
                        add(book);
                        notify('success', `«${book.title}» agregado al carrito`);
                      }}
                      className="mt-2 rounded bg-stone-900 px-3 py-2 text-sm text-white disabled:opacity-50"
                    >
                      {ebookInCart ? 'En el carrito' : soldOut ? 'Agotado' : 'Agregar al carrito'}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
