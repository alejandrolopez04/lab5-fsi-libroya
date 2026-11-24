import { Schema, model, Types } from 'mongoose';

export const SHIPMENT_STATUSES = ['PENDIENTE', 'EN_PREPARACION', 'ENVIADO', 'ENTREGADO'] as const;

const historySchema = new Schema(
  {
    status: { type: String, enum: SHIPMENT_STATUSES, required: true },
    at: { type: Date, required: true },
  },
  { _id: false },
);

const shipmentSchema = new Schema(
  {
    orderId: { type: Types.ObjectId, ref: 'Order', required: true, unique: true },
    userId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: SHIPMENT_STATUSES, required: true },
    trackingNumber: { type: String },
    history: { type: [historySchema], default: [] },
  },
  { timestamps: true },
);

export const Shipment = model('Shipment', shipmentSchema);
