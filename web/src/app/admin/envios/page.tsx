'use client';

import { DragEvent, useCallback, useEffect, useState } from 'react';
import { RequireRole } from '../../../components/RequireRole';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { SHIPMENT_STATUS_LABEL } from '../../../lib/format';
import { useSocketEvents } from '../../../lib/socket';

type Shipment = {
  _id: string;
  orderId: string;
  status: string;
  trackingNumber?: string;
  customerName: string;
  city: string;
  items: Array<{ title: string; quantity: number }>;
};

const COLUMNS = ['PENDIENTE', 'EN_PREPARACION', 'ENVIADO', 'ENTREGADO'];
const NEXT: Record<string, string | undefined> = { PENDIENTE: 'EN_PREPARACION', EN_PREPARACION: 'ENVIADO', ENVIADO: 'ENTREGADO' };

export default function ShipmentsBoardPage() {
  return (
    <RequireRole role="admin">
      <Board />
    </RequireRole>
  );
}

function Board() {
  const { user } = useAuth();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [tracking, setTracking] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [live, setLive] = useState('');

  const load = useCallback(() => {
    api<Shipment[]>('/api/admin/shipments').then(setShipments).catch((err: Error) => setError(err.message));
  }, []);
  useEffect(load, [load]);

  useSocketEvents(
    {
      'shipment:created': () => {
        setLive('Llegó un pedido nuevo');
        load();
      },
      'shipment:statusChanged': load,
      resync: load,
    },
    Boolean(user),
  );

  async function advance(shipment: Shipment, target: string) {
    setError('');
    if (NEXT[shipment.status] !== target) {
      setError('Solo puedes mover el envío a la siguiente columna.');
      return;
    }
    const body: Record<string, string> = { status: target };
    if (target === 'ENVIADO') {
      const guide = tracking[shipment._id]?.trim();
      if (!guide) {
        setError('Escribe el número de guía antes de marcar como Enviado.');
        return;
      }
      body.trackingNumber = guide;
    }
    try {
      await api(`/api/admin/shipments/${shipment._id}/status`, { method: 'PATCH', body: JSON.stringify(body) });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar');
    }
  }

  function onDrop(event: DragEvent, column: string) {
    event.preventDefault();
    const shipment = shipments.find((item) => item._id === event.dataTransfer.getData('text/plain'));
    if (shipment) advance(shipment, column);
  }

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-semibold">Tablero de envíos</h1>
      <p className="text-sm text-stone-600">Arrastra una tarjeta a la siguiente columna o usa el botón. Se actualiza en tiempo real.</p>
      {live && <p className="rounded border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-800">{live}</p>}
      {error && <p className="text-red-700">{error}</p>}
      <div className="grid gap-4 md:grid-cols-4">
        {COLUMNS.map((column) => (
          <div
            key={column}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => onDrop(event, column)}
            className="min-h-64 space-y-3 rounded-md border border-stone-300 bg-stone-50 p-3"
          >
            <h2 className="font-semibold">
              {SHIPMENT_STATUS_LABEL[column]} ({shipments.filter((s) => s.status === column).length})
            </h2>
            {shipments
              .filter((shipment) => shipment.status === column)
              .map((shipment) => {
                const next = NEXT[shipment.status];
                return (
                  <div
                    key={shipment._id}
                    draggable={Boolean(next)}
                    onDragStart={(event) => event.dataTransfer.setData('text/plain', shipment._id)}
                    className="space-y-2 rounded border border-stone-300 bg-white p-3 text-sm shadow-sm"
                  >
                    <div className="font-mono text-xs text-stone-500">Pedido #{String(shipment.orderId).slice(-8)}</div>
                    <div className="font-medium">{shipment.customerName} · {shipment.city}</div>
                    <ul className="text-xs text-stone-600">
                      {shipment.items.map((item) => (
                        <li key={item.title}>
                          {item.title} × {item.quantity}
                        </li>
                      ))}
                    </ul>
                    {shipment.trackingNumber && <div className="text-xs">Guía: {shipment.trackingNumber}</div>}
                    {next === 'ENVIADO' && (
                      <input
                        placeholder="Número de guía"
                        value={tracking[shipment._id] ?? ''}
                        onChange={(event) => setTracking({ ...tracking, [shipment._id]: event.target.value })}
                        className="w-full rounded border border-stone-300 px-2 py-1 text-xs"
                      />
                    )}
                    {next && (
                      <button type="button" onClick={() => advance(shipment, next)} className="w-full rounded bg-stone-900 px-2 py-1 text-xs text-white">
                        Mover a {SHIPMENT_STATUS_LABEL[next]}
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
        ))}
      </div>
    </section>
  );
}
