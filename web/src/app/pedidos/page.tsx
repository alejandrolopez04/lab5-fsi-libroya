'use client';

import { useCallback, useEffect, useState } from 'react';
import { RequireRole } from '../../components/RequireRole';
import { api, downloadFile } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { money, ORDER_STATUS_LABEL, SHIPMENT_STATUS_LABEL } from '../../lib/format';
import { useSocketEvents } from '../../lib/socket';
import { useToast } from '../../lib/toast';

type OrderItem = { bookId: string; title: string; format: 'EBOOK' | 'FISICO'; quantity: number; lineTotalCents: number };
type Order = {
  _id: string;
  items: OrderItem[];
  totalCents: number;
  status: string;
  paymentStatus?: string;
  shipmentStatus: string | null;
  trackingNumber: string | null;
  createdAt: string;
};

export default function OrdersPage() {
  return (
    <RequireRole role="cliente">
      <Orders />
    </RequireRole>
  );
}

function Orders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const { notify } = useToast();

  useEffect(() => {
    const aviso = new URLSearchParams(window.location.search).get('aviso');
    if (aviso) setNotice(aviso);
  }, []);

  const load = useCallback(() => {
    api<Order[]>('/api/orders/me')
      .then(setOrders)
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(load, [load]);

  useSocketEvents(
    {
      'order:updated': () => {
        notify('info', 'Tu pedido se actualizó en tiempo real');
        load();
      },
      resync: load,
    },
    Boolean(user),
  );

  async function pay(orderId: string) {
    try {
      const payment = await api<{ approveUrl: string }>('/api/payments/paypal/order', {
        method: 'POST',
        body: JSON.stringify({ orderId }),
      });
      window.location.href = payment.approveUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar el pago');
    }
  }

  async function download(orderId: string, item: OrderItem) {
    try {
      await downloadFile(`/api/orders/${orderId}/download/${item.bookId}`, `${item.title}.txt`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo descargar');
    }
  }

  return (
    <section className="space-y-5">
      <h1 className="text-3xl font-semibold">Mis pedidos</h1>
      {notice && <p className="rounded-lg border-2 border-amber-400 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">{notice}</p>}
      {error && <p className="text-red-700">{error}</p>}
      {orders.length === 0 && <p className="text-stone-600">Aún no tienes pedidos.</p>}
      {orders.map((order) => {
        const paid = order.status === 'PAID' || order.status === 'COMPLETED';
        return (
          <article key={order._id} className="space-y-3 rounded-md border border-stone-300 bg-white p-4">
            <header className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-xs text-stone-500">#{order._id.slice(-8)} · {new Date(order.createdAt).toLocaleString('es-CO')}</span>
              <span className="rounded bg-stone-100 px-2 py-1 text-sm">{ORDER_STATUS_LABEL[order.status] ?? order.status}</span>
            </header>
            <ul className="space-y-1 text-sm">
              {order.items.map((item) => (
                <li key={item.bookId} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {item.title} × {item.quantity} ({item.format === 'EBOOK' ? 'Ebook' : 'Físico'})
                  </span>
                  <span className="flex items-center gap-3">
                    {money(item.lineTotalCents)}
                    {item.format === 'EBOOK' && paid && (
                      <button type="button" onClick={() => download(order._id, item)} className="text-blue-700 underline">
                        Descargar
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 pt-3 text-sm">
              <strong>Total: {money(order.totalCents)}</strong>
              {order.shipmentStatus && (
                <span>
                  Envío: <strong>{SHIPMENT_STATUS_LABEL[order.shipmentStatus]}</strong>
                  {order.trackingNumber && <> · Guía {order.trackingNumber}</>}
                </span>
              )}
              {order.status === 'PENDING_PAYMENT' && (
                <button type="button" onClick={() => pay(order._id)} className="rounded bg-[#ffc439] px-3 py-1 font-semibold">
                  Pagar con PayPal
                </button>
              )}
            </footer>
          </article>
        );
      })}
    </section>
  );
}
