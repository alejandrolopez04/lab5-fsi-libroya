import { Schema, model, Types } from 'mongoose';

export const PAYMENT_STATUSES = ['CREATED', 'APPROVED', 'CAPTURED', 'FAILED', 'CANCELLED'] as const;

const paymentSchema = new Schema(
  {
    orderId: { type: Types.ObjectId, ref: 'Order', required: true, index: true },
    provider: { type: String, required: true, enum: ['paypal'], default: 'paypal' },
    providerOrderId: { type: String, required: true, unique: true },
    captureId: { type: String, unique: true, sparse: true },
    amountCents: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, enum: ['USD'] },
    status: { type: String, enum: PAYMENT_STATUSES, required: true },
  },
  { timestamps: true },
);

export const Payment = model('Payment', paymentSchema);
