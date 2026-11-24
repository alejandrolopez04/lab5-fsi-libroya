import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';

// Cliente mínimo de PayPal Orders API v2. Solo se usa desde el backend.

type PaypalLink = { href: string; rel: string };

export type PaypalOrder = {
  id: string;
  status: string;
  links?: PaypalLink[];
  purchase_units?: Array<{
    custom_id?: string;
    amount?: { currency_code: string; value: string };
    payments?: {
      captures?: Array<{
        id: string;
        status: string;
        custom_id?: string;
        amount: { currency_code: string; value: string };
      }>;
    };
  }>;
};

async function getAccessToken(): Promise<string> {
  const credentials = Buffer.from(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const response = await fetch(`${env.PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  }).catch(() => null);
  if (!response?.ok) throw new AppError(502, 'PayPal no está disponible en este momento');
  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

async function paypalRequest(path: string, method: 'GET' | 'POST', body?: unknown, requestId?: string) {
  const token = await getAccessToken();
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  if (requestId) headers['PayPal-Request-Id'] = requestId; // idempotencia del lado de PayPal
  const response = await fetch(`${env.PAYPAL_API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  }).catch(() => null);
  if (!response) throw new AppError(502, 'PayPal no está disponible en este momento');
  const data = (await response.json().catch(() => ({}))) as PaypalOrder & { details?: Array<{ issue?: string }> };
  return { ok: response.ok, status: response.status, data };
}

export function centsToValue(cents: number): string {
  return (cents / 100).toFixed(2);
}

export async function createPaypalOrder(input: {
  orderId: string;
  totalCents: number;
  returnUrl: string;
  cancelUrl: string;
}): Promise<{ id: string; approveUrl: string }> {
  const result = await paypalRequest(
    '/v2/checkout/orders',
    'POST',
    {
      intent: 'CAPTURE',
      purchase_units: [
        {
          custom_id: input.orderId,
          description: `Pedido LibroYa ${input.orderId}`,
          amount: { currency_code: 'USD', value: centsToValue(input.totalCents) },
        },
      ],
      application_context: {
        brand_name: 'LibroYa',
        user_action: 'PAY_NOW',
        shipping_preference: 'NO_SHIPPING',
        return_url: input.returnUrl,
        cancel_url: input.cancelUrl,
      },
    },
  );
  const approveUrl = result.data.links?.find((link) => link.rel === 'approve' || link.rel === 'payer-action')?.href;
  if (!result.ok || !result.data.id || !approveUrl) throw new AppError(502, 'No se pudo crear la orden en PayPal');
  return { id: result.data.id, approveUrl };
}

export async function getPaypalOrder(paypalOrderId: string): Promise<PaypalOrder> {
  const result = await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`, 'GET');
  if (!result.ok) throw new AppError(502, 'No se pudo consultar la orden en PayPal');
  return result.data;
}

export async function capturePaypalOrder(paypalOrderId: string): Promise<PaypalOrder> {
  const result = await paypalRequest(
    `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`,
    'POST',
    {},
    `capture-${paypalOrderId}`,
  );
  if (result.ok) return result.data;
  // Si ya estaba capturada (reintento), se consulta el estado real.
  if (result.data.details?.some((detail) => detail.issue === 'ORDER_ALREADY_CAPTURED')) {
    return getPaypalOrder(paypalOrderId);
  }
  if (result.status === 422) throw new AppError(409, 'PayPal rechazó el pago. Puedes intentarlo de nuevo.');
  throw new AppError(502, 'No se pudo capturar el pago en PayPal');
}
