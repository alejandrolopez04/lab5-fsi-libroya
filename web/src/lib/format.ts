export function money(cents: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: 'Pendiente de pago',
  PAID: 'Pagado',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
};

export const SHIPMENT_STATUS_LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  EN_PREPARACION: 'En preparación',
  ENVIADO: 'Enviado',
  ENTREGADO: 'Entregado',
};

export type Book = {
  _id: string;
  title: string;
  author: string;
  category: string;
  format: 'EBOOK' | 'FISICO';
  description: string;
  priceCents: number;
  coverUrl: string;
  active: boolean;
  stock: number;
};
