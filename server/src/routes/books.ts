import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { asyncHandler } from '../middleware/asyncHandler';
import { AppError } from '../middleware/errorHandler';
import { Book, BOOK_FORMATS } from '../models/Book';

export const booksRouter = Router();

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

booksRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter: Record<string, unknown> = { active: true };
    const { category, format, q } = req.query;
    if (typeof category === 'string' && category.trim()) filter.category = category.trim();
    if (typeof format === 'string' && (BOOK_FORMATS as readonly string[]).includes(format)) filter.format = format;
    if (typeof q === 'string' && q.trim()) {
      const regex = new RegExp(escapeRegex(q.trim().slice(0, 80)), 'i');
      filter.$or = [{ title: regex }, { author: regex }];
    }
    const books = await Book.find(filter).select('-seedKey').sort({ title: 1 });
    res.json(books);
  }),
);

booksRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.id)) throw new AppError(404, 'Libro no encontrado');
    const book = await Book.findOne({ _id: req.params.id, active: true }).select('-seedKey');
    if (!book) throw new AppError(404, 'Libro no encontrado');
    res.json(book);
  }),
);
