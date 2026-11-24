import { Types } from 'mongoose';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { Book } from '../models/Book';
import { Order } from '../models/Order';

export const createOrderSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            bookId: z.string().refine((id) => Types.ObjectId.isValid(id), 'Libro inválido'),
            quantity: z
              .number({ invalid_type_error: 'La cantidad debe ser numérica' })
              .int('La cantidad debe ser un número entero')
              .min(1, 'La cantidad mínima es 1')
              .max(50, 'La cantidad máxima es 50'),
          })
          .strip(), // cualquier precio enviado por el cliente se descarta
      )
      .min(1, 'El carrito está vacío')
      .max(30),
    address: z
      .object({
        fullName: z.string().trim().min(1, 'El nombre es obligatorio').max(80),
        line1: z.string().trim().min(1, 'La dirección es obligatoria').max(150),
        city: z.string().trim().min(1, 'La ciudad es obligatoria').max(60),
        region: z.string().trim().min(1, 'El departamento es obligatorio').max(60),
        postalCode: z.string().trim().min(1, 'El código postal es obligatorio').max(15),
        phone: z.string().trim().min(7, 'Teléfono inválido').max(20),
      })
      .optional(),
  })
  .strip();

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export async function createOrder(userId: string, input: CreateOrderInput) {
  // Agrupar cantidades por libro para no saltarse la validación de stock con líneas repetidas.
  const quantities = new Map<string, number>();
  for (const item of input.items) {
    quantities.set(item.bookId, (quantities.get(item.bookId) ?? 0) + item.quantity);
  }

  const books = await Book.find({ _id: { $in: [...quantities.keys()] }, active: true });
  if (books.length !== quantities.size) throw new AppError(404, 'Uno de los libros no existe o no está disponible');

  const items = books.map((book) => {
    const quantity = quantities.get(String(book._id))!;
    if (book.format === 'EBOOK' && quantity > 1) {
      throw new AppError(400, `Del ebook "${book.title}" solo se puede comprar 1 unidad`);
    }
    if (book.format === 'FISICO' && quantity > book.stock) {
      throw new AppError(409, `Stock insuficiente para "${book.title}" (disponibles: ${book.stock})`);
    }
    return {
      bookId: book._id,
      title: book.title,
      author: book.author,
      format: book.format,
      unitPriceCents: book.priceCents,
      quantity,
      lineTotalCents: book.priceCents * quantity,
    };
  });

  const hasPhysical = items.some((item) => item.format === 'FISICO');
  if (hasPhysical && !input.address) throw new AppError(400, 'La dirección de envío es obligatoria para libros físicos');

  const totalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);

  return Order.create({
    userId,
    items,
    address: hasPhysical ? input.address : undefined,
    totalCents,
    currency: 'USD',
    status: 'PENDING_PAYMENT',
  });
}

export async function findOwnOrder(orderId: string, userId: string) {
  if (!Types.ObjectId.isValid(orderId)) throw new AppError(404, 'Pedido no encontrado');
  const order = await Order.findById(orderId);
  if (!order) throw new AppError(404, 'Pedido no encontrado');
  if (String(order.userId) !== userId) throw new AppError(403, 'No autorizado');
  return order;
}
