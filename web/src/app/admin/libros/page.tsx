'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { RequireRole } from '../../../components/RequireRole';
import { api } from '../../../lib/api';
import { type Book, money } from '../../../lib/format';

const EMPTY = { title: '', author: '', category: '', format: 'FISICO', description: '', price: '', coverUrl: '', stock: '0' };

export default function AdminBooksPage() {
  return (
    <RequireRole role="admin">
      <AdminBooks />
    </RequireRole>
  );
}

function AdminBooks() {
  const [books, setBooks] = useState<Book[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [deltas, setDeltas] = useState<Record<string, string>>({});
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api<Book[]>('/api/admin/books').then(setBooks).catch((err: Error) => setError(err.message));
  }, []);
  useEffect(load, [load]);

  async function run(action: () => Promise<unknown>, ok: string) {
    setError('');
    setMessage('');
    try {
      await action();
      setMessage(ok);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  function create(event: FormEvent) {
    event.preventDefault();
    run(async () => {
      await api('/api/admin/books', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          author: form.author,
          category: form.category,
          format: form.format,
          description: form.description,
          priceCents: Math.round(Number(form.price) * 100),
          coverUrl: form.coverUrl,
          stock: form.format === 'FISICO' ? Number(form.stock) : 0,
        }),
      });
      setForm(EMPTY);
    }, 'Libro creado');
  }

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-semibold">Libros y stock</h1>
      {message && <p className="text-green-700">{message}</p>}
      {error && <p className="text-red-700">{error}</p>}

      <form onSubmit={create} className="grid gap-3 rounded-md border border-stone-300 bg-white p-4 sm:grid-cols-4">
        <h2 className="font-medium sm:col-span-4">Nuevo libro</h2>
        <input required placeholder="Título" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded border border-stone-300 px-3 py-2" />
        <input required placeholder="Autor" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} className="rounded border border-stone-300 px-3 py-2" />
        <input required placeholder="Categoría" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="rounded border border-stone-300 px-3 py-2" />
        <select value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })} className="rounded border border-stone-300 px-3 py-2">
          <option value="FISICO">Físico</option>
          <option value="EBOOK">Ebook</option>
        </select>
        <input required type="number" min="0.01" step="0.01" placeholder="Precio USD" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="rounded border border-stone-300 px-3 py-2" />
        {form.format === 'FISICO' && (
          <input type="number" min="0" step="1" placeholder="Stock inicial" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="rounded border border-stone-300 px-3 py-2" />
        )}
        <input placeholder="URL de portada (opcional)" value={form.coverUrl} onChange={(e) => setForm({ ...form, coverUrl: e.target.value })} className="rounded border border-stone-300 px-3 py-2 sm:col-span-2" />
        <textarea required placeholder="Descripción" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="rounded border border-stone-300 px-3 py-2 sm:col-span-4" />
        <button type="submit" className="rounded bg-stone-900 px-4 py-2 text-white sm:col-span-1">
          Crear libro
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full rounded-md border border-stone-300 bg-white text-sm">
          <thead className="bg-stone-50 text-left">
            <tr>
              <th className="p-2">Título</th>
              <th className="p-2">Formato</th>
              <th className="p-2">Precio</th>
              <th className="p-2">Stock</th>
              <th className="p-2">Ajustar stock</th>
              <th className="p-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {books.map((book) => (
              <tr key={book._id} className="border-t border-stone-200">
                <td className="p-2">
                  <div className="font-medium">{book.title}</div>
                  <div className="text-xs text-stone-500">{book.author} · {book.category}</div>
                </td>
                <td className="p-2">{book.format === 'EBOOK' ? 'Ebook' : 'Físico'}</td>
                <td className="p-2">
                  <div className="flex items-center gap-1">
                    <span className="w-16">{money(book.priceCents)}</span>
                    <input type="number" min="0.01" step="0.01" placeholder="Nuevo" value={prices[book._id] ?? ''} onChange={(e) => setPrices({ ...prices, [book._id]: e.target.value })} className="w-20 rounded border border-stone-300 px-2 py-1" />
                    <button
                      type="button"
                      className="underline"
                      onClick={() =>
                        run(
                          () => api(`/api/admin/books/${book._id}`, { method: 'PATCH', body: JSON.stringify({ priceCents: Math.round(Number(prices[book._id]) * 100) }) }),
                          'Precio actualizado',
                        )
                      }
                    >
                      Guardar
                    </button>
                  </div>
                </td>
                <td className="p-2">{book.format === 'FISICO' ? book.stock : '—'}</td>
                <td className="p-2">
                  {book.format === 'FISICO' ? (
                    <div className="flex items-center gap-1">
                      <input type="number" step="1" placeholder="+5 / -2" value={deltas[book._id] ?? ''} onChange={(e) => setDeltas({ ...deltas, [book._id]: e.target.value })} className="w-20 rounded border border-stone-300 px-2 py-1" />
                      <button
                        type="button"
                        className="underline"
                        onClick={() =>
                          run(async () => {
                            await api(`/api/admin/books/${book._id}/stock`, { method: 'PATCH', body: JSON.stringify({ delta: Number(deltas[book._id]) }) });
                            setDeltas({ ...deltas, [book._id]: '' });
                          }, 'Stock ajustado')
                        }
                      >
                        Aplicar
                      </button>
                    </div>
                  ) : (
                    <span className="text-stone-400">No aplica</span>
                  )}
                </td>
                <td className="p-2">
                  <button
                    type="button"
                    className={book.active ? 'text-green-700 underline' : 'text-stone-500 underline'}
                    onClick={() =>
                      run(() => api(`/api/admin/books/${book._id}`, { method: 'PATCH', body: JSON.stringify({ active: !book.active }) }), book.active ? 'Libro desactivado' : 'Libro activado')
                    }
                  >
                    {book.active ? 'Activo' : 'Inactivo'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
