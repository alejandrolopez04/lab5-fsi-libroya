import { Schema, model, Types } from 'mongoose';

export const ORDER_STATUSES = ['PENDING_PAYMENT', 'PAID', 'COMPLETED', 'CANCELLED'] as const;
export const ORDER_PAYMENT_STATUSES = ['CREATED', 'APPROVED', 'CAPTURED', 'FAILED', 'CANCELLED'] as const;

const orderItemSchema = new Schema(
  {
    bookId: { type: Types.ObjectId, ref: 'Book', required: true },
    title: { type: String, required: true },
    author: { type: String, required: true },
    format: { type: String, enum: ['EBOOK', 'FISICO'], required: true },
    unitPriceCents: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    lineTotalCents: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const addressSchema = new Schema(
  {
    fullName: { type: String, required: true },
    line1: { type: String, required: true },
    city: { type: String, required: true },
    region: { type: String, required: true },
    postalCode: { type: String, required: true },
    phone: { type: String, required: true },
  },
  { _id: false },
);

const orderSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    items: { type: [orderItemSchema], required: true },
    address: { type: addressSchema },
    totalCents: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, enum: ['USD'], default: 'USD' },
    status: { type: String, enum: ORDER_STATUSES, required: true, default: 'PENDING_PAYMENT' },
    paymentStatus: { type: String, enum: ORDER_PAYMENT_STATUSES },
    // Evita capturar dos órdenes PayPal distintas del mismo pedido al mismo tiempo.
    paymentLock: {
      type: new Schema({ providerOrderId: String, at: Date }, { _id: false }),
      default: undefined,
    },
  },
  { timestamps: true },
);

export const Order = model('Order', orderSchema);
