'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { RequireRole } from '../../../components/RequireRole';
import { api } from '../../../lib/api';
import { ORDER_STATUS_LABEL } from '../../../lib/format';

type CaptureResult = { status: string; shipmentStatus: string | null };

export default function PaymentSuccessPage() {
  return (
    <RequireRole role="cliente">
      <Suspense fallback={<p>Cargando…</p>}>
        <Capture />
      </Suspense>
    </RequireRole>
  );
}

function Capture() {
  const params = useSearchParams();
  const orderId = params.get('orderId') ?? '';
  const paypalOrderId = params.get('token') ?? ''; // PayPal devuelve su id de orden como "token"
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [error, setError] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!orderId || !paypalOrderId) {
      setError('Faltan datos del pago.');
      return;
    }
    api<CaptureResult>('/api/payments/paypal/capture', {
      method: 'POST',
      body: JSON.stringify({ orderId, paypalOrderId }),
    })
      .then(setResult)
      .catch((err: Error) => setError(err.message));
  }, [orderId, paypalOrderId]);

  return (
    <section className="mx-auto max-w-xl space-y-4 rounded-md border border-stone-300 bg-white p-6">
      <h1 className="text-2xl font-semibold">Confirmación de pago</h1>
      {!result && !error && <p>Confirmando el pago con PayPal…</p>}
      {result && (
        <>
          <p className="text-green-700">Pago recibido. Estado del pedido: {ORDER_STATUS_LABEL[result.status] ?? result.status}.</p>
          {result.shipmentStatus && <p>Tu envío quedó en estado Pendiente. Puedes seguirlo en tiempo real.</p>}
        </>
      )}
      {error && <p className="text-red-700">{error}</p>}
      <Link href="/pedidos" className="inline-block rounded bg-stone-900 px-4 py-2 text-white">
        Ver mis pedidos
      </Link>
    </section>
  );
}
