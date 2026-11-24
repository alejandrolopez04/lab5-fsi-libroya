'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { RequireRole } from '../../../components/RequireRole';
import { api } from '../../../lib/api';
import { type Book, money } from '../../../lib/format';
import { useToast } from '../../../lib/toast';

type BookForm = {
  title: string;
  author: string;
  category: string;
  format: 'FISICO' | 'EBOOK';
  description: string;
  price: string;
  coverUrl: string;
  stock: string;
};

const EMPTY: BookForm = { title: '', author: '', category: '', format: 'FISICO', description: '', price: '', coverUrl: '', stock: '0' };
const INPUT = 'rounded border border-stone-300 px-3 py-2';

function toCents(value: string): number {
  return Math.round(Number(value) * 100);
}

export default function AdminBooksPage() {
  return (
    <RequireRole role="admin">
      <AdminBooks />
    </RequireRole>
  );
}

function AdminBooks() {
  const { notify } = useToast();
  const [books, setBooks] = useState<Book[]>([]);
  const [form, setForm] = useState<BookForm>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deltas, setDeltas] = useState<Record<string, string>>({});
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<Book[]>('/api/admin/books')
      .then(setBooks)
      .catch((err: Error) => notify('error', err.message));
  }, [notify]);
  useEffect(load, [load]);

  async function run(action: () => Promise<unknown>, ok: string): Promise<boolean> {
    setBusy(true);
    try {
      await action();
      notify('success', ok);
      load();
      return true;
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Error');
      return false;
    } finally {
      setBusy(false);
    }
  }

  function startEdit(book: Book) {
    setEditingId(book._id);
    setForm({
      title: book.title,
      author: book.author,
      category: book.category,
      format: book.format,
      description: book.description,
      price: (book.priceCents / 100).toFixed(2),
      coverUrl: book.coverUrl ?? '',
      stock: String(book.stock),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const common = {
      title: form.title,
      author: form.author,
      category: form.category,
      description: form.description,
      priceCents: toCents(form.price),
      coverUrl: form.coverUrl,
    };
    if (editingId) {
      // El formato no se edita: cambiarlo alteraría el manejo de stock y de envíos.
      const ok = await run(
        () => api(`/api/admin/books/${editingId}`, { method: 'PATCH', body: JSON.stringify(common) }),
        `«${form.title}» actualizado`,
      );
      if (ok) cancelEdit();
      return;
    }
    const ok = await run(
      () =>
        api('/api/admin/books', {
          method: 'POST',
          body: JSON.stringify({ ...common, format: form.format, stock: form.format === 'FISICO' ? Number(form.stock) : 0 }),
        }),
      `«${form.title}» creado`,
    );
    if (ok) setForm(EMPTY);
  }

  async function savePrice(book: Book) {
    const value = prices[book._id];
    if (!value || Number(value) <= 0) {
      notify('error', 'Escribe un precio mayor que 0');
      return;
    }
    const ok = await run(
      () => api(`/api/admin/books/${book._id}`, { method: 'PATCH', body: JSON.stringify({ priceCents: toCents(value) }) }),
      `Precio de «${book.title}» actualizado a ${money(toCents(value))}`,
    );
    if (ok) setPrices((current) => ({ ...current, [book._id]: '' }));
  }

  async function applyStock(book: Book) {
    const delta = Number(deltas[book._id]);
    if (!Number.isInteger(delta) || delta === 0) {
      notify('error', 'El ajuste de stock debe ser un entero distinto de 0 (ej. 5 o -2)');
      return;
    }
    const ok = await run(
      () => api(`/api/admin/books/${book._id}/stock`, { method: 'PATCH', body: JSON.stringify({ delta }) }),
      `Stock de «${book.title}» ajustado (${delta > 0 ? '+' : ''}${delta})`,
    );
    if (ok) setDeltas((current) => ({ ...current, [book._id]: '' }));
  }

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-semibold">Libros y stock</h1>

      <form
        onSubmit={submit}
        className={`grid gap-3 rounded-md border-2 bg-white p-4 sm:grid-cols-4 ${editingId ? 'border-amber-400' : 'border-stone-300'}`}
      >
        <h2 className="font-medium sm:col-span-4">{editingId ? `Editando «${books.find((b) => b._id === editingId)?.title ?? ''}»` : 'Nuevo libro'}</h2>
        <input required placeholder="Título" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={INPUT} />
        <input required placeholder="Autor" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} className={INPUT} />
        <input required placeholder="Categoría" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={INPUT} />
        <select
          value={form.format}
          disabled={Boolean(editingId)}
          title={editingId ? 'El formato no se puede cambiar' : undefined}
          onChange={(e) => setForm({ ...form, format: e.target.value as BookForm['format'] })}
          className={`${INPUT} disabled:bg-stone-100`}
        >
          <option value="FISICO">Físico</option>
          <option value="EBOOK">Ebook</option>
        </select>
        <input required type="number" min="0.01" step="0.01" placeholder="Precio USD" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className={INPUT} />
        {!editingId && form.format === 'FISICO' && (
          <input type="number" min="0" step="1" placeholder="Stock inicial" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className={INPUT} />
        )}
        <input placeholder="URL de portada (opcional)" value={form.coverUrl} onChange={(e) => setForm({ ...form, coverUrl: e.target.value })} className={`${INPUT} sm:col-span-2`} />
        <textarea required placeholder="Descripción" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${INPUT} sm:col-span-4`} />
        <div className="flex gap-2 sm:col-span-4">
          <button type="submit" disabled={busy} className="rounded bg-stone-900 px-4 py-2 text-white disabled:opacity-60">
            {editingId ? 'Guardar cambios' : 'Crear libro'}
          </button>
          {editingId && (
            <button type="button" onClick={cancelEdit} className="rounded border border-stone-300 px-4 py-2">
              Cancelar
            </button>
          )}
        </div>
        {editingId && <p className="text-xs text-stone-500 sm:col-span-4">El stock se ajusta desde la tabla; el formato no se puede cambiar.</p>}
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
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {books.map((book) => (
              <tr key={book._id} className={`border-t border-stone-200 ${editingId === book._id ? 'bg-amber-50' : ''}`}>
                <td className="p-2">
                  <div className="font-medium">{book.title}</div>
                  <div className="text-xs text-stone-500">
                    {book.author} · {book.category}
                  </div>
                </td>
                <td className="p-2">{book.format === 'EBOOK' ? 'Ebook' : 'Físico'}</td>
                <td className="p-2">
                  <div className="flex items-center gap-1">
                    <span className="w-16">{money(book.priceCents)}</span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="Nuevo"
                      value={prices[book._id] ?? ''}
                      onChange={(e) => setPrices({ ...prices, [book._id]: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && savePrice(book)}
                      className="w-20 rounded border border-stone-300 px-2 py-1"
                    />
                    <button type="button" disabled={busy} className="underline disabled:opacity-50" onClick={() => savePrice(book)}>
                      Guardar
                    </button>
                  </div>
                </td>
                <td className="p-2">{book.format === 'FISICO' ? book.stock : '—'}</td>
                <td className="p-2">
                  {book.format === 'FISICO' ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="1"
                        placeholder="+5 / -2"
                        value={deltas[book._id] ?? ''}
                        onChange={(e) => setDeltas({ ...deltas, [book._id]: e.target.value })}
                        onKeyDown={(e) => e.key === 'Enter' && applyStock(book)}
                        className="w-20 rounded border border-stone-300 px-2 py-1"
                      />
                      <button type="button" disabled={busy} className="underline disabled:opacity-50" onClick={() => applyStock(book)}>
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
                    disabled={busy}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${book.active ? 'bg-green-100 text-green-800' : 'bg-stone-200 text-stone-600'}`}
                    onClick={() =>
                      run(
                        () => api(`/api/admin/books/${book._id}`, { method: 'PATCH', body: JSON.stringify({ active: !book.active }) }),
                        book.active ? `«${book.title}» desactivado (ya no aparece en el catálogo)` : `«${book.title}» activado`,
                      )
                    }
                  >
                    {book.active ? 'Activo' : 'Inactivo'}
                  </button>
                </td>
                <td className="p-2">
                  <button type="button" onClick={() => startEdit(book)} className="rounded border border-stone-300 px-3 py-1 hover:bg-stone-100">
                    Editar
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
