import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireAuth, requireRole } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { parseBody } from '../middleware/validate';
import { Order } from '../models/Order';
import { Shipment, SHIPMENT_STATUSES } from '../models/Shipment';
import { User } from '../models/User';
import { emitToAdmin, emitToUser } from '../sockets';

export const adminShipmentsRouter = Router();

adminShipmentsRouter.use(requireAuth, requireRole('admin'));

// Única transición permitida desde cada estado (no se salta ni se retrocede).
const NEXT_STATUS: Record<string, string | undefined> = {
  PENDIENTE: 'EN_PREPARACION',
  EN_PREPARACION: 'ENVIADO',
  ENVIADO: 'ENTREGADO',
};

const statusSchema = z.object({
  status: z.enum(SHIPMENT_STATUSES),
  trackingNumber: z.string().trim().min(3, 'Número de guía inválido').max(40).optional(),
});

adminShipmentsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const shipments = await Shipment.find().sort({ createdAt: 1 }).lean();
    const orders = await Order.find({ _id: { $in: shipments.map((s) => s.orderId) } }).lean();
    const users = await User.find({ _id: { $in: shipments.map((s) => s.userId) } }).select('name').lean();
    const orderMap = new Map(orders.map((order) => [String(order._id), order]));
    const userMap = new Map(users.map((user) => [String(user._id), user.name]));
    res.json(
      shipments.map((shipment) => {
        const order = orderMap.get(String(shipment.orderId));
        return {
          ...shipment,
          customerName: userMap.get(String(shipment.userId)) ?? '',
          city: order?.address?.city ?? '',
          items: (order?.items ?? [])
            .filter((item) => item.format === 'FISICO')
            .map((item) => ({ title: item.title, quantity: item.quantity })),
        };
      }),
    );
  }),
);

adminShipmentsRouter.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.id)) throw new AppError(404, 'Envío no encontrado');
    const body = parseBody(statusSchema, req.body);
    const shipment = await Shipment.findById(req.params.id);
    if (!shipment) throw new AppError(404, 'Envío no encontrado');

    if (NEXT_STATUS[shipment.status] !== body.status) {
      throw new AppError(409, `Transición no permitida: ${shipment.status} → ${body.status}`);
    }
    if (body.status === 'ENVIADO' && !body.trackingNumber) {
      throw new AppError(400, 'Para marcar como Enviado se requiere el número de guía');
    }

    const update: Record<string, unknown> = { status: body.status };
    if (body.status === 'ENVIADO') update.trackingNumber = body.trackingNumber;
    // El filtro por estado actual evita que dos administradores avancen el mismo envío a la vez.
    const updated = await Shipment.findOneAndUpdate(
      { _id: shipment._id, status: shipment.status },
      { $set: update, $push: { history: { status: body.status, at: new Date() } } },
      { new: true },
    );
    if (!updated) throw new AppError(409, 'El envío cambió mientras se actualizaba. Recarga el tablero.');

    if (body.status === 'ENTREGADO') {
      await Order.updateOne({ _id: updated.orderId, status: 'PAID' }, { $set: { status: 'COMPLETED' } });
    }
    const order = await Order.findById(updated.orderId).lean();

    const payload = {
      shipmentId: String(updated._id),
      orderId: String(updated.orderId),
      status: updated.status,
      trackingNumber: updated.trackingNumber ?? null,
    };
    emitToAdmin('shipment:statusChanged', payload);
    emitToUser(String(updated.userId), 'order:updated', {
      orderId: payload.orderId,
      status: order?.status,
      paymentStatus: order?.paymentStatus,
      shipmentStatus: updated.status,
      trackingNumber: payload.trackingNumber,
    });
    res.json(updated);
  }),
);
