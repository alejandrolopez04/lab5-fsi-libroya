import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { Book } from '../models/Book';
import { User } from '../models/User';

export function useTestDb(): void {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI as string);
  });
  afterEach(async () => {
    const collections = mongoose.connection.collections;
    await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
  });
  afterAll(async () => {
    await mongoose.disconnect();
  });
}

export async function userWithToken(role: 'cliente' | 'admin', email = `${role}-${Date.now()}@libroya.test`) {
  const user = await User.create({ name: role, email, passwordHash: 'no-se-usa', role });
  const token = jwt.sign({ sub: String(user._id), role }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
  return { user, token, auth: `Bearer ${token}` };
}

export async function demoBooks() {
  const physical = await Book.create({
    title: 'Libro físico',
    author: 'Autora',
    category: 'Novela',
    format: 'FISICO',
    description: 'Prueba',
    priceCents: 2000,
    stock: 3,
  });
  const ebook = await Book.create({
    title: 'Libro digital',
    author: 'Autor',
    category: 'Técnico',
    format: 'EBOOK',
    description: 'Prueba',
    priceCents: 1500,
  });
  return { physical, ebook };
}

export const ADDRESS = {
  fullName: 'Cliente Prueba',
  line1: 'Calle 1 # 2-3',
  city: 'Medellín',
  region: 'Antioquia',
  postalCode: '050001',
  phone: '3001234567',
};
