import { Schema, model } from 'mongoose';

export const BOOK_FORMATS = ['EBOOK', 'FISICO'] as const;
export type BookFormat = (typeof BOOK_FORMATS)[number];

const bookSchema = new Schema(
  {
    seedKey: { type: String, unique: true, sparse: true },
    title: { type: String, required: true, trim: true },
    author: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    format: { type: String, enum: BOOK_FORMATS, required: true },
    description: { type: String, required: true },
    priceCents: { type: Number, required: true, min: 0 },
    coverUrl: { type: String, default: '' },
    active: { type: Boolean, default: true },
    stock: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

export const Book = model('Book', bookSchema);
