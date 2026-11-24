import request from 'supertest';
import { createApp } from '../app';
import { Book } from '../models/Book';
import { Order } from '../models/Order';
import { Payment } from '../models/Payment';
import { Shipment } from '../models/Shipment';
import { StockMovement } from '../models/StockMovement';
import * as paypal from '../services/paypal';
import { ADDRESS, demoBooks, useTestDb, userWithToken } from './helpers';

jest.mock('../services/paypal', () => {
  const actual = jest.requireActual('../services/paypal');
  return { ...actual, createPaypalOrder: jest.fn(), capturePaypalOrder: jest.fn(), getPaypalOrder: jest.fn() };
});

const mocked = paypal as jest.Mocked<typeof paypal>;
const app = createApp();
useTestDb();

function completedCapture(orderId: string, value: string) {
  return {
    id: 'PP-1',
    status: 'COMPLETED',
    purchase_units: [
      {
        payments: {
          captures: [{ id: 'CAP-1', status: 'COMPLETED', custom_id: orderId, amount: { currency_code: 'USD', value } }],
        },
      },
    ],
  };
}

async function pendingOrder() {
  const { physical } = await demoBooks();
  const owner = await userWithToken('cliente', 'duena@libroya.test');
  const order = await request(app)
    .post('/api/orders')
    .set('Authorization', owner.auth)
    .send({ items: [{ bookId: String(physical._id), quantity: 2 }], address: ADDRESS });
  mocked.createPaypalOrder.mockResolvedValue({ id: 'PP-1', approveUrl: 'https://sandbox.paypal.com/approve' });
  const start = await request(app)
    .post('/api/payments/paypal/order')
    .set('Authorization', owner.auth)
    .send({ orderId: order.body._id });
  return { physical, owner, orderId: order.body._id as string, start };
}

describe('pagos con PayPal (mock)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('crea la orden PayPal con el total de la BD', async () => {
    const { start } = await pendingOrder();
    expect(start.status).toBe(201);
    expect(mocked.createPaypalOrder).toHaveBeenCalledWith(expect.objectContaining({ totalCents: 4000 }));
    expect(await Payment.countDocuments({ status: 'CREATED' })).toBe(1);
  });

  it('otro usuario no puede crear ni capturar el pago de un pedido ajeno', async () => {
    const { orderId } = await pendingOrder();
    const other = await userWithToken('cliente', 'otra@libroya.test');
    const res = await request(app)
      .post('/api/payments/paypal/capture')
      .set('Authorization', other.auth)
      .send({ orderId, paypalOrderId: 'PP-1' });
    expect(res.status).toBe(403);
  });

  it('captura verificada: descuenta stock y crea un envío una sola vez', async () => {
    const { physical, owner, orderId } = await pendingOrder();
    mocked.capturePaypalOrder.mockResolvedValue(completedCapture(orderId, '40.00'));

    const first = await request(app)
      .post('/api/payments/paypal/capture')
      .set('Authorization', owner.auth)
      .send({ orderId, paypalOrderId: 'PP-1' });
    expect(first.status).toBe(200);
    expect(first.body.status).toBe('PAID');
    expect(first.body.shipmentStatus).toBe('PENDIENTE');

    const second = await request(app)
      .post('/api/payments/paypal/capture')
      .set('Authorization', owner.auth)
      .send({ orderId, paypalOrderId: 'PP-1' });
    expect(second.status).toBe(200);
    expect(second.body.alreadyCaptured).toBe(true);

    expect((await Book.findById(physical._id))?.stock).toBe(1);
    expect(await Shipment.countDocuments()).toBe(1);
    expect(await StockMovement.countDocuments({ reason: 'sale' })).toBe(1);
    expect(mocked.capturePaypalOrder).toHaveBeenCalledTimes(1);
  });

  it('rechaza una captura con monto distinto y no marca el pedido como pagado', async () => {
    const { owner, orderId } = await pendingOrder();
    mocked.capturePaypalOrder.mockResolvedValue(completedCapture(orderId, '0.01'));
    const res = await request(app)
      .post('/api/payments/paypal/capture')
      .set('Authorization', owner.auth)
      .send({ orderId, paypalOrderId: 'PP-1' });
    expect(res.status).toBe(409);
    const mine = await request(app).get('/api/orders/me').set('Authorization', owner.auth);
    expect(mine.body[0].status).toBe('PENDING_PAYMENT');
    expect(mine.body[0].paymentStatus).toBe('FAILED');
  });

  it('cancelar deja el pedido pendiente y permite reintentar', async () => {
    const { owner, orderId } = await pendingOrder();
    const cancel = await request(app)
      .post('/api/payments/paypal/cancel')
      .set('Authorization', owner.auth)
      .send({ orderId, paypalOrderId: 'PP-1' });
    expect(cancel.body.status).toBe('PENDING_PAYMENT');
    mocked.createPaypalOrder.mockResolvedValue({ id: 'PP-2', approveUrl: 'https://sandbox.paypal.com/approve' });
    const retry = await request(app)
      .post('/api/payments/paypal/order')
      .set('Authorization', owner.auth)
      .send({ orderId });
    expect(retry.status).toBe(201);
  });

  it('no captura una segunda orden PayPal mientras otra del mismo pedido está en proceso', async () => {
    const { owner, orderId } = await pendingOrder();
    // Simula una captura de PP-1 en curso.
    await Order.updateOne({ _id: orderId }, { $set: { paymentLock: { providerOrderId: 'PP-1', at: new Date() } } });
    // No se puede abrir otra orden mientras tanto.
    const blocked = await request(app)
      .post('/api/payments/paypal/order')
      .set('Authorization', owner.auth)
      .send({ orderId });
    expect(blocked.status).toBe(409);

    // Un segundo pago (PP-2) creado antes del bloqueo tampoco se captura.
    await Payment.create({ orderId, providerOrderId: 'PP-2', amountCents: 4000, currency: 'USD', status: 'CREATED' });
    const second = await request(app)
      .post('/api/payments/paypal/capture')
      .set('Authorization', owner.auth)
      .send({ orderId, paypalOrderId: 'PP-2' });
    expect(second.status).toBe(409);
    expect(mocked.capturePaypalOrder).not.toHaveBeenCalled();
  });

  it('al abrir una nueva orden PayPal la anterior queda cancelada y no se puede capturar', async () => {
    const { owner, orderId } = await pendingOrder();
    mocked.createPaypalOrder.mockResolvedValue({ id: 'PP-2', approveUrl: 'https://sandbox.paypal.com/approve' });
    await request(app).post('/api/payments/paypal/order').set('Authorization', owner.auth).send({ orderId });
    expect((await Payment.findOne({ providerOrderId: 'PP-1' }))?.status).toBe('CANCELLED');
    const old = await request(app)
      .post('/api/payments/paypal/capture')
      .set('Authorization', owner.auth)
      .send({ orderId, paypalOrderId: 'PP-1' });
    expect(old.status).toBe(409);
    expect(mocked.capturePaypalOrder).not.toHaveBeenCalled();
  });

  it('el envío solo avanza un paso y Enviado exige número de guía', async () => {
    const { owner, orderId } = await pendingOrder();
    mocked.capturePaypalOrder.mockResolvedValue(completedCapture(orderId, '40.00'));
    await request(app)
      .post('/api/payments/paypal/capture')
      .set('Authorization', owner.auth)
      .send({ orderId, paypalOrderId: 'PP-1' });
    const admin = await userWithToken('admin');
    const shipment = await Shipment.findOne();
    const url = `/api/admin/shipments/${shipment!._id}/status`;
    const patch = (body: object) => request(app).patch(url).set('Authorization', admin.auth).send(body);

    expect((await patch({ status: 'ENTREGADO' })).status).toBe(409);
    expect((await patch({ status: 'EN_PREPARACION' })).status).toBe(200);
    expect((await patch({ status: 'ENVIADO' })).status).toBe(400);
    expect((await patch({ status: 'ENVIADO', trackingNumber: 'GUIA-123' })).status).toBe(200);
    expect((await patch({ status: 'ENTREGADO' })).status).toBe(200);
    const mine = await request(app).get('/api/orders/me').set('Authorization', owner.auth);
    expect(mine.body[0].status).toBe('COMPLETED');
    expect(mine.body[0].trackingNumber).toBe('GUIA-123');
  });
});
