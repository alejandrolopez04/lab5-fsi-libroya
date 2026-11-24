import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { parseBody } from '../middleware/validate';
import { Order } from '../models/Order';
import { Shipment } from '../models/Shipment';
import { createOrder, createOrderSchema, findOwnOrder } from '../services/orders';

export const ordersRouter = Router();

ordersRouter.use(requireAuth);

ordersRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = parseBody(createOrderSchema, req.body);
    const order = await createOrder(req.user!.id, body);
    res.status(201).json(order);
  }),
);

ordersRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    const orders = await Order.find({ userId: req.user!.id }).sort({ createdAt: -1 }).lean();
    const shipments = await Shipment.find({ orderId: { $in: orders.map((order) => order._id) } }).lean();
    const byOrder = new Map(shipments.map((shipment) => [String(shipment.orderId), shipment]));
    res.json(
      orders.map((order) => {
        const shipment = byOrder.get(String(order._id));
        return {
          ...order,
          shipmentStatus: shipment?.status ?? null,
          trackingNumber: shipment?.trackingNumber ?? null,
        };
      }),
    );
  }),
);

ordersRouter.get(
  '/:id/download/:bookId',
  asyncHandler(async (req, res) => {
    const order = await findOwnOrder(req.params.id, req.user!.id);
    if (order.status !== 'PAID' && order.status !== 'COMPLETED') {
      throw new AppError(403, 'El pedido todavía no está pagado');
    }
    const item = order.items.find((line) => String(line.bookId) === req.params.bookId && line.format === 'EBOOK');
    if (!item) throw new AppError(404, 'Ebook no encontrado en este pedido');

    const content = [
      'LibroYa - Ebook de demostración',
      '',
      `Título: ${item.title}`,
      `Autor: ${item.author}`,
      `Pedido: ${String(order._id)}`,
      `Fecha de compra: ${order.updatedAt.toISOString()}`,
      '',
      'Archivo generado para el laboratorio. En producción aquí iría el archivo real del libro.',
    ].join('\n');
    const safeName = item.title.normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName || 'ebook'}.txt"`);
    res.send(content);
  }),
);
