'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RequireRole } from '../../components/RequireRole';
import { api } from '../../lib/api';
import { useCart } from '../../lib/cart';
import { money } from '../../lib/format';

type Order = { _id: string; totalCents: number };

const EMPTY_ADDRESS = { fullName: '', line1: '', city: '', region: '', postalCode: '', phone: '' };
const FIELDS: Array<[keyof typeof EMPTY_ADDRESS, string]> = [
  ['fullName', 'Nombre de quien recibe'],
  ['line1', 'Dirección'],
  ['city', 'Ciudad'],
  ['region', 'Departamento'],
  ['postalCode', 'Código postal'],
  ['phone', 'Teléfono'],
];

export default function CheckoutPage() {
  return (
    <RequireRole role="cliente">
      <Checkout />
    </RequireRole>
  );
}

function Checkout() {
  const router = useRouter();
  const { items, subtotalCents, clear } = useCart();
  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const needsAddress = items.some((item) => item.format === 'FISICO');

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setPending(true);
    let order: Order;
    try {
      // Si la validación falla aquí, el servidor no guarda ningún pedido.
      order = await api<Order>('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          items: items.map((item) => ({ bookId: item.bookId, quantity: item.quantity })),
          address: needsAddress ? address : undefined,
        }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el pedido');
      setPending(false);
      return;
    }
    // El pedido ya existe: se vacía el carrito para que un reintento no cree otro pedido.
    clear();
    try {
      const payment = await api<{ approveUrl: string }>('/api/payments/paypal/order', {
        method: 'POST',
        body: JSON.stringify({ orderId: order._id }),
      });
      window.location.href = payment.approveUrl;
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'No se pudo iniciar el pago';
      router.push(`/pedidos?aviso=${encodeURIComponent(`${reason}. Tu pedido quedó pendiente de pago; puedes pagarlo desde aquí.`)}`);
    }
  }

  if (items.length === 0) return <p className="text-stone-600">No hay libros en el carrito.</p>;

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-xl space-y-5 rounded-md border border-stone-300 bg-white p-6">
      <h1 className="text-2xl font-semibold">Resumen y pago</h1>
      <ul className="space-y-1 text-sm">
        {items.map((item) => (
          <li key={item.bookId} className="flex justify-between">
            <span>
              {item.title} × {item.quantity}
            </span>
            <span>{money(item.priceCents * item.quantity)}</span>
          </li>
        ))}
      </ul>
      <p className="border-t border-stone-200 pt-3 text-lg">
        Total: <strong>{money(subtotalCents)}</strong>
      </p>
      {needsAddress ? (
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 font-medium">Dirección de envío</legend>
          {FIELDS.map(([key, label]) => (
            <label key={key} className="block text-sm">
              {label}
              <input
                required
                value={address[key]}
                onChange={(event) => setAddress({ ...address, [key]: event.target.value })}
                className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
              />
            </label>
          ))}
        </fieldset>
      ) : (
        <p className="text-sm text-stone-600">Tu pedido solo tiene ebooks: no necesita dirección de envío.</p>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={pending} className="w-full rounded bg-[#ffc439] px-4 py-3 font-semibold text-stone-900 disabled:opacity-60">
        {pending ? 'Redirigiendo a PayPal…' : 'Pagar con PayPal (Sandbox)'}
      </button>
    </form>
  );
}
