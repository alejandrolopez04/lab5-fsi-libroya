import mongoose from 'mongoose';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import { Book } from '../models/Book';
import { Order } from '../models/Order';
import { Payment } from '../models/Payment';
import { Shipment } from '../models/Shipment';
import { StockMovement } from '../models/StockMovement';
import { emitToAdmin, emitToUser } from '../sockets';
import { findOwnOrder } from './orders';
import { capturePaypalOrder, centsToValue, createPaypalOrder, getPaypalOrder, type PaypalOrder } from './paypal';

const LOCK_TTL_MS = 5 * 60 * 1000;

function lockIsActive(lock: { providerOrderId?: string | null; at?: Date | null } | null | undefined): boolean {
  return Boolean(lock?.providerOrderId && lock.at && Date.now() - lock.at.getTime() < LOCK_TTL_MS);
}

async function releaseLock(orderId: unknown, paypalOrderId: string): Promise<void> {
  await Order.updateOne(
    { _id: orderId, 'paymentLock.providerOrderId': paypalOrderId },
    { $unset: { paymentLock: 1 } },
  );
}

async function assertStockAvailable(items: Array<{ bookId: unknown; format: string; quantity: number; title: string }>) {
  for (const item of items) {
    if (item.format !== 'FISICO') continue;
    const book = await Book.findById(item.bookId);
    if (!book || book.stock < item.quantity) {
      throw new AppError(409, `Stock insuficiente para "${item.title}"`);
    }
  }
}

export async function startPaypalCheckout(orderId: string, userId: string) {
  const order = await findOwnOrder(orderId, userId);
  if (order.status !== 'PENDING_PAYMENT') throw new AppError(409, 'El pedido ya fue pagado o no admite pago');
  if (lockIsActive(order.paymentLock)) throw new AppError(409, 'Hay un pago en proceso para este pedido. Espera unos segundos.');
  await assertStockAvailable(order.items);

  const id = String(order._id);
  const paypal = await createPaypalOrder({
    orderId: id,
    totalCents: order.totalCents, // monto calculado en la BD, nunca enviado por el navegador
    returnUrl: `${env.CLIENT_ORIGIN}/pago/exito?orderId=${id}`,
    cancelUrl: `${env.CLIENT_ORIGIN}/pago/cancelado?orderId=${id}`,
  });

  // Solo la última orden PayPal queda vigente.
  await Payment.updateMany({ orderId: order._id, status: 'CREATED' }, { $set: { status: 'CANCELLED' } });
  await Payment.create({
    orderId: order._id,
    provider: 'paypal',
    providerOrderId: paypal.id,
    amountCents: order.totalCents,
    currency: 'USD',
    status: 'CREATED',
  });
  order.paymentStatus = 'CREATED';
  await order.save();

  return { paypalOrderId: paypal.id, approveUrl: paypal.approveUrl };
}

type CaptureCheck = { captureId: string } | { reason: string };

function verifyCapture(paypal: PaypalOrder, orderId: string, totalCents: number, fallbackCustomId?: string): CaptureCheck {
  const unit = paypal.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  if (!capture) return { reason: `sin captura (estado de la orden: ${paypal.status})` };
  if (capture.status !== 'COMPLETED') return { reason: `captura en estado ${capture.status}` };
  if (capture.amount.currency_code !== 'USD') return { reason: `moneda ${capture.amount.currency_code}` };
  if (Math.round(Number(capture.amount.value) * 100) !== totalCents) {
    return { reason: `monto ${capture.amount.value} distinto de ${centsToValue(totalCents)}` };
  }
  // En la respuesta de captura PayPal pone custom_id dentro de la captura; en GET de la orden, en la unidad.
  const customId = capture.custom_id ?? unit?.custom_id ?? fallbackCustomId;
  if (customId !== orderId) return { reason: 'referencia (custom_id) distinta' };
  return { captureId: capture.id };
}

async function getPaymentForOrder(orderId: string, userId: string, paypalOrderId: string) {
  const order = await findOwnOrder(orderId, userId);
  const payment = await Payment.findOne({ providerOrderId: paypalOrderId });
  if (!payment || String(payment.orderId) !== String(order._id)) throw new AppError(404, 'Pago no encontrado');
  return { order, payment };
}

async function orderSummary(orderId: unknown) {
  const order = await Order.findById(orderId).lean();
  const shipment = await Shipment.findOne({ orderId }).lean();
  return {
    orderId: String(orderId),
    status: order?.status,
    paymentStatus: order?.paymentStatus,
    shipmentStatus: shipment?.status ?? null,
    trackingNumber: shipment?.trackingNumber ?? null,
  };
}

export async function capturePaypalCheckout(orderId: string, userId: string, paypalOrderId: string) {
  const { order, payment } = await getPaymentForOrder(orderId, userId, paypalOrderId);

  // Idempotencia: una captura ya confirmada devuelve el resultado conocido.
  if (payment.status === 'CAPTURED') return { alreadyCaptured: true, ...(await orderSummary(order._id)) };
  if (order.status !== 'PENDING_PAYMENT') throw new AppError(409, 'El pedido ya fue pagado con otra orden');
  if (payment.status === 'CANCELLED') throw new AppError(409, 'Esta orden de PayPal fue reemplazada por una más reciente');

  // Bloqueo atómico del pedido: solo una orden PayPal puede capturarse a la vez (evita doble cobro).
  const staleBefore = new Date(Date.now() - LOCK_TTL_MS);
  const locked = await Order.findOneAndUpdate(
    {
      _id: order._id,
      status: 'PENDING_PAYMENT',
      $or: [
        { paymentLock: { $exists: false } },
        { 'paymentLock.providerOrderId': paypalOrderId },
        { 'paymentLock.at': { $lt: staleBefore } },
      ],
    },
    { $set: { paymentLock: { providerOrderId: paypalOrderId, at: new Date() } } },
    { new: true },
  );
  if (!locked) throw new AppError(409, 'Hay otro pago en proceso para este pedido');

  try {
    return await captureLocked(order, payment, paypalOrderId);
  } finally {
    await releaseLock(order._id, paypalOrderId);
  }
}

async function captureLocked(
  order: Awaited<ReturnType<typeof findOwnOrder>>,
  payment: { _id: unknown },
  paypalOrderId: string,
) {
  const paypal = await capturePaypalOrder(paypalOrderId);
  let check = verifyCapture(paypal, String(order._id), order.totalCents);
  if ('reason' in check && check.reason.startsWith('referencia')) {
    // Si la captura no trae custom_id, se consulta la orden completa en PayPal.
    const full = await getPaypalOrder(paypalOrderId);
    check = verifyCapture(paypal, String(order._id), order.totalCents, full.purchase_units?.[0]?.custom_id);
  }
  if ('reason' in check) {
    console.warn(`Captura rechazada para el pedido ${String(order._id)}: ${check.reason}`);
    await Payment.updateOne({ _id: payment._id, status: { $ne: 'CAPTURED' } }, { $set: { status: 'FAILED' } });
    await Order.updateOne({ _id: order._id, status: 'PENDING_PAYMENT' }, { $set: { paymentStatus: 'FAILED' } });
    throw new AppError(409, `El pago no coincide con el pedido: ${check.reason}`);
  }
  const { captureId } = check;

  let shipmentId: string | null = null;
  let applied = false;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      shipmentId = null;
      applied = false;
      // Solo una captura puede pasar de no capturado a CAPTURED.
      const claimed = await Payment.findOneAndUpdate(
        { _id: payment._id, status: { $ne: 'CAPTURED' } },
        { $set: { status: 'CAPTURED', captureId } },
        { new: true, session },
      );
      if (!claimed) return;

      for (const item of order.items) {
        if (item.format !== 'FISICO') continue;
        const book = await Book.findOneAndUpdate(
          { _id: item.bookId, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } },
          { new: true, session },
        );
        if (!book) throw new AppError(409, `Stock insuficiente para "${item.title}". Contacta a soporte.`);
        await StockMovement.create(
          [{ bookId: item.bookId, delta: -item.quantity, reason: 'sale', orderId: order._id, stockAfter: book.stock }],
          { session },
        );
      }

      const hasPhysical = order.items.some((item) => item.format === 'FISICO');
      await Order.updateOne(
        { _id: order._id },
        { $set: { status: hasPhysical ? 'PAID' : 'COMPLETED', paymentStatus: 'CAPTURED' }, $unset: { paymentLock: 1 } },
        { session },
      );
      if (hasPhysical) {
        const [shipment] = await Shipment.create(
          [
            {
              orderId: order._id,
              userId: order.userId,
              status: 'PENDIENTE',
              history: [{ status: 'PENDIENTE', at: new Date() }],
            },
          ],
          { session },
        );
        shipmentId = String(shipment._id);
      }
      applied = true;
    });
  } finally {
    await session.endSession();
  }

  const summary = await orderSummary(order._id);
  if (applied) {
    if (shipmentId) {
      emitToAdmin('shipment:created', { shipmentId, orderId: summary.orderId, status: 'PENDIENTE' });
    }
    emitToUser(String(order.userId), 'order:updated', summary);
  }
  return { alreadyCaptured: !applied, ...summary };
}

export async function cancelPaypalCheckout(orderId: string, userId: string, paypalOrderId: string) {
  const { order, payment } = await getPaymentForOrder(orderId, userId, paypalOrderId);
  if (payment.status === 'CREATED' || payment.status === 'APPROVED') {
    payment.status = 'CANCELLED';
    await payment.save();
    await Order.updateOne({ _id: order._id, status: 'PENDING_PAYMENT' }, { $set: { paymentStatus: 'CANCELLED' } });
  }
  return orderSummary(order._id);
}
