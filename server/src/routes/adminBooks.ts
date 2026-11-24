import { Router } from 'express';
import mongoose, { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireAuth, requireRole } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { parseBody } from '../middleware/validate';
import { Book, BOOK_FORMATS } from '../models/Book';
import { StockMovement } from '../models/StockMovement';

export const adminBooksRouter = Router();

adminBooksRouter.use(requireAuth, requireRole('admin'));

const bookFields = {
  title: z.string().trim().min(1, 'El título es obligatorio').max(150),
  author: z.string().trim().min(1, 'El autor es obligatorio').max(120),
  category: z.string().trim().min(1, 'La categoría es obligatoria').max(60),
  description: z.string().trim().min(1, 'La descripción es obligatoria').max(2000),
  priceCents: z.number().int('El precio debe ser entero (centavos)').positive('El precio debe ser positivo'),
  coverUrl: z.string().trim().url('URL de portada inválida').or(z.literal('')),
  active: z.boolean(),
};

const createSchema = z.object({
  ...bookFields,
  format: z.enum(BOOK_FORMATS),
  coverUrl: bookFields.coverUrl.optional().default(''),
  active: bookFields.active.optional().default(true),
  stock: z.number().int().min(0, 'El stock no puede ser negativo').optional().default(0),
});

const updateSchema = z.object(bookFields).partial().strict();

const stockSchema = z.object({
  delta: z
    .number()
    .int('El ajuste debe ser entero')
    .refine((value) => value !== 0, 'El ajuste no puede ser 0'),
});

function checkId(id: string): void {
  if (!isValidObjectId(id)) throw new AppError(404, 'Libro no encontrado');
}

adminBooksRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const books = await Book.find().select('-seedKey').sort({ title: 1 });
    res.json(books);
  }),
);

adminBooksRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = parseBody(createSchema, req.body);
    const stock = body.format === 'EBOOK' ? 0 : (body.stock ?? 0);
    const book = await Book.create({ ...body, stock });
    if (stock > 0) {
      await StockMovement.create({ bookId: book._id, delta: stock, reason: 'admin_adjust', stockAfter: stock });
    }
    res.status(201).json(book);
  }),
);

adminBooksRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    checkId(req.params.id);
    const body = parseBody(updateSchema, req.body);
    const book = await Book.findByIdAndUpdate(req.params.id, { $set: body }, { new: true, runValidators: true });
    if (!book) throw new AppError(404, 'Libro no encontrado');
    res.json(book);
  }),
);

adminBooksRouter.patch(
  '/:id/stock',
  asyncHandler(async (req, res) => {
    checkId(req.params.id);
    const { delta } = parseBody(stockSchema, req.body);
    const existing = await Book.findById(req.params.id);
    if (!existing) throw new AppError(404, 'Libro no encontrado');
    if (existing.format !== 'FISICO') throw new AppError(409, 'Solo los libros físicos manejan stock');

    const session = await mongoose.startSession();
    try {
      let updated = null;
      await session.withTransaction(async () => {
        const filter = delta < 0 ? { _id: existing._id, stock: { $gte: -delta } } : { _id: existing._id };
        updated = await Book.findOneAndUpdate(filter, { $inc: { stock: delta } }, { new: true, session });
        if (!updated) throw new AppError(409, 'El stock no puede quedar negativo');
        await StockMovement.create(
          [{ bookId: existing._id, delta, reason: 'admin_adjust', stockAfter: (updated as { stock: number }).stock }],
          { session },
        );
      });
      res.json(updated);
    } finally {
      await session.endSession();
    }
  }),
);
