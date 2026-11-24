import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { parseBody } from '../middleware/validate';
import { cancelPaypalCheckout, capturePaypalCheckout, startPaypalCheckout } from '../services/payments';

export const paymentsRouter = Router();

paymentsRouter.use(requireAuth);

const orderSchema = z.object({ orderId: z.string().min(1, 'Pedido obligatorio') });
const captureSchema = z.object({
  orderId: z.string().min(1, 'Pedido obligatorio'),
  paypalOrderId: z.string().min(1, 'Orden de PayPal obligatoria').max(64),
});

paymentsRouter.post(
  '/paypal/order',
  asyncHandler(async (req, res) => {
    const { orderId } = parseBody(orderSchema, req.body);
    res.status(201).json(await startPaypalCheckout(orderId, req.user!.id));
  }),
);

paymentsRouter.post(
  '/paypal/capture',
  asyncHandler(async (req, res) => {
    const { orderId, paypalOrderId } = parseBody(captureSchema, req.body);
    res.json(await capturePaypalCheckout(orderId, req.user!.id, paypalOrderId));
  }),
);

paymentsRouter.post(
  '/paypal/cancel',
  asyncHandler(async (req, res) => {
    const { orderId, paypalOrderId } = parseBody(captureSchema, req.body);
    res.json(await cancelPaypalCheckout(orderId, req.user!.id, paypalOrderId));
  }),
);
