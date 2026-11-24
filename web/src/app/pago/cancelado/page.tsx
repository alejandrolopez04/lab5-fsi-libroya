'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { RequireRole } from '../../../components/RequireRole';
import { api } from '../../../lib/api';

export default function PaymentCancelledPage() {
  return (
    <RequireRole role="cliente">
      <Suspense fallback={<p>Cargando…</p>}>
        <Cancelled />
      </Suspense>
    </RequireRole>
  );
}

function Cancelled() {
  const params = useSearchParams();
  const orderId = params.get('orderId') ?? '';
  const paypalOrderId = params.get('token') ?? '';
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !orderId || !paypalOrderId) return;
    started.current = true;
    api('/api/payments/paypal/cancel', { method: 'POST', body: JSON.stringify({ orderId, paypalOrderId }) }).catch(
      () => undefined,
    );
  }, [orderId, paypalOrderId]);

  async function retry() {
    setPending(true);
    setError('');
    try {
      const payment = await api<{ approveUrl: string }>('/api/payments/paypal/order', {
        method: 'POST',
        body: JSON.stringify({ orderId }),
      });
      window.location.href = payment.approveUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo reintentar');
      setPending(false);
    }
  }

  return (
    <section className="mx-auto max-w-xl space-y-4 rounded-md border border-stone-300 bg-white p-6">
      <h1 className="text-2xl font-semibold">Pago cancelado</h1>
      <p>No se realizó ningún cobro. Tu pedido sigue pendiente de pago.</p>
      {error && <p className="text-red-700">{error}</p>}
      <div className="flex gap-3">
        <button type="button" onClick={retry} disabled={!orderId || pending} className="rounded bg-[#ffc439] px-4 py-2 font-semibold disabled:opacity-60">
          {pending ? 'Redirigiendo…' : 'Reintentar pago'}
        </button>
        <Link href="/pedidos" className="rounded border border-stone-300 px-4 py-2">
          Mis pedidos
        </Link>
      </div>
    </section>
  );
}
