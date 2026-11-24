'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { useCart } from '../../../lib/cart';
import { useToast } from '../../../lib/toast';
import { type Book, money } from '../../../lib/format';

export default function BookPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { add } = useCart();
  const { notify } = useToast();
  const [book, setBook] = useState<Book | null>(null);
  const [error, setError] = useState('');
  const [added, setAdded] = useState(false);

  useEffect(() => {
    api<Book>(`/api/books/${id}`).then(setBook).catch((err: Error) => setError(err.message));
  }, [id]);

  if (error) return <p className="text-red-700">{error}</p>;
  if (!book) return <p className="text-stone-600">Cargando…</p>;
  const soldOut = book.format === 'FISICO' && book.stock <= 0;

  return (
    <article className="grid gap-6 md:grid-cols-[280px_1fr]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={book.coverUrl || 'https://placehold.co/400x600?text=LibroYa'} alt={book.title} className="w-full rounded-md border border-stone-300" />
      <div className="space-y-3">
        <Link href="/" className="text-sm underline">
          ← Volver al catálogo
        </Link>
        <h1 className="text-3xl font-semibold">{book.title}</h1>
        <p className="text-stone-700">{book.author}</p>
        <p className="text-sm text-stone-500">
          {book.category} · {book.format === 'EBOOK' ? 'Ebook (descarga digital)' : `Físico (stock: ${book.stock})`}
        </p>
        <p>{book.description}</p>
        <p className="text-2xl font-medium">{money(book.priceCents)}</p>
        {(!user || user.role === 'cliente') && (
          <button
            type="button"
            disabled={soldOut}
            onClick={() => {
              add(book);
              setAdded(true);
              notify('success', `«${book.title}» agregado al carrito`);
            }}
            className="rounded bg-stone-900 px-4 py-2 text-white disabled:opacity-50"
          >
            {soldOut ? 'Agotado' : 'Agregar al carrito'}
          </button>
        )}
        {added && (
          <p className="text-sm text-green-700">
            Agregado. <Link href="/carrito" className="underline">Ver carrito</Link>
          </p>
        )}
      </div>
    </article>
  );
}
