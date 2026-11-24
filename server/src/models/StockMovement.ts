import { Schema, model, Types } from 'mongoose';

const stockMovementSchema = new Schema(
  {
    bookId: { type: Types.ObjectId, ref: 'Book', required: true, index: true },
    delta: { type: Number, required: true },
    reason: { type: String, enum: ['admin_adjust', 'sale'], required: true },
    orderId: { type: Types.ObjectId, ref: 'Order' },
    stockAfter: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

export const StockMovement = model('StockMovement', stockMovementSchema);
