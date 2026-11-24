'use client';

import Link from 'next/link';
import { useCart } from '../../lib/cart';
import { money } from '../../lib/format';

export default function CartPage() {
  const { items, subtotalCents, setQuantity, remove } = useCart();

  if (items.length === 0) {
    return (
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold">Carrito</h1>
        <p className="text-stone-600">
          Tu carrito está vacío. <Link href="/" className="underline">Ir al catálogo</Link>
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-semibold">Carrito</h1>
      <table className="w-full overflow-hidden rounded-md border border-stone-300 bg-white text-sm">
        <thead className="bg-stone-50 text-left">
          <tr>
            <th className="p-3">Libro</th>
            <th className="p-3">Formato</th>
            <th className="p-3">Precio</th>
            <th className="p-3">Cantidad</th>
            <th className="p-3">Subtotal</th>
            <th className="p-3" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.bookId} className="border-t border-stone-200">
              <td className="p-3">{item.title}</td>
              <td className="p-3">{item.format === 'EBOOK' ? 'Ebook' : 'Físico'}</td>
              <td className="p-3">{money(item.priceCents)}</td>
              <td className="p-3">
                {item.format === 'EBOOK' ? (
                  1
                ) : (
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={item.quantity}
                    onChange={(event) => setQuantity(item.bookId, Number(event.target.value))}
                    className="w-20 rounded border border-stone-300 px-2 py-1"
                  />
                )}
              </td>
              <td className="p-3">{money(item.priceCents * item.quantity)}</td>
              <td className="p-3">
                <button type="button" onClick={() => remove(item.bookId)} className="text-red-700 underline">
                  Quitar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-between">
        <p className="text-lg">
          Total estimado: <strong>{money(subtotalCents)}</strong>
          <span className="block text-xs text-stone-500">El total final lo calcula el servidor con los precios vigentes.</span>
        </p>
        <Link href="/checkout" className="rounded bg-stone-900 px-4 py-2 text-white">
          Continuar al pago
        </Link>
      </div>
    </section>
  );
}
