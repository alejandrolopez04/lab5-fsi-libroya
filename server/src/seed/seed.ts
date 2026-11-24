import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { env } from '../config/env';
import { connectDB, safeDbError } from '../db/connect';
import { Book } from '../models/Book';
import { User } from '../models/User';

// La contraseña del admin nunca va en el código: se lee de SEED_ADMIN_PASSWORD (server/.env o Railway).
// El cliente de prueba es ficticio y sin privilegios; TestSprite lo usa para entrar.
function adminPassword(): string {
  const value = process.env.SEED_ADMIN_PASSWORD?.trim() ?? '';
  if (value.length < 10) {
    throw new Error('Define SEED_ADMIN_PASSWORD en server/.env (mínimo 10 caracteres) antes de correr el seed');
  }
  return value;
}

export function demoAccounts() {
  return {
    admin: { email: 'admin@libroya.test', password: adminPassword(), name: 'Admin LibroYa', role: 'admin' as const },
    cliente: { email: 'cliente@libroya.test', password: 'Cliente123!', name: 'Cliente Prueba', role: 'cliente' as const },
  };
}

const BOOKS = [
  {
    seedKey: 'cien-anos',
    title: 'Cien años de soledad',
    author: 'Gabriel García Márquez',
    category: 'Novela',
    format: 'FISICO' as const,
    description: 'La saga de la familia Buendía en Macondo.',
    priceCents: 4599,
    coverUrl: 'https://picsum.photos/seed/libroya-cien/400/600',
    stock: 12,
  },
  {
    seedKey: 'el-tunel',
    title: 'El túnel',
    author: 'Ernesto Sábato',
    category: 'Novela',
    format: 'EBOOK' as const,
    description: 'Novela corta sobre obsesión y aislamiento.',
    priceCents: 1999,
    coverUrl: 'https://picsum.photos/seed/libroya-tunel/400/600',
    stock: 0,
  },
  {
    seedKey: 'clean-code',
    title: 'Clean Code',
    author: 'Robert C. Martin',
    category: 'Técnico',
    format: 'FISICO' as const,
    description: 'Guía práctica para escribir código legible.',
    priceCents: 6299,
    coverUrl: 'https://picsum.photos/seed/libroya-clean/400/600',
    stock: 8,
  },
  {
    seedKey: 'ddia',
    title: 'Designing Data-Intensive Applications',
    author: 'Martin Kleppmann',
    category: 'Técnico',
    format: 'EBOOK' as const,
    description: 'Fundamentos de sistemas de datos a escala.',
    priceCents: 5499,
    coverUrl: 'https://picsum.photos/seed/libroya-ddia/400/600',
    stock: 0,
  },
  {
    seedKey: 'principito',
    title: 'El principito',
    author: 'Antoine de Saint-Exupéry',
    category: 'Infantil',
    format: 'FISICO' as const,
    description: 'Un relato sobre la amistad y lo esencial.',
    priceCents: 2499,
    coverUrl: 'https://picsum.photos/seed/libroya-principito/400/600',
    stock: 20,
  },
  {
    seedKey: 'coraline',
    title: 'Coraline',
    author: 'Neil Gaiman',
    category: 'Infantil',
    format: 'EBOOK' as const,
    description: 'Una niña descubre una puerta hacia otro mundo.',
    priceCents: 2299,
    coverUrl: 'https://picsum.photos/seed/libroya-coraline/400/600',
    stock: 0,
  },
  {
    seedKey: 'sapiens',
    title: 'Sapiens',
    author: 'Yuval Noah Harari',
    category: 'Ensayo',
    format: 'FISICO' as const,
    description: 'Una breve historia de la humanidad.',
    priceCents: 4999,
    coverUrl: 'https://picsum.photos/seed/libroya-sapiens/400/600',
    stock: 6,
  },
  {
    seedKey: 'habitos',
    title: 'Hábitos atómicos',
    author: 'James Clear',
    category: 'Ensayo',
    format: 'EBOOK' as const,
    description: 'Cambios pequeños que producen resultados notables.',
    priceCents: 2799,
    coverUrl: 'https://picsum.photos/seed/libroya-habitos/400/600',
    stock: 0,
  },
];

export async function runSeed(): Promise<void> {
  for (const account of Object.values(demoAccounts())) {
    const passwordHash = await bcrypt.hash(account.password, 10);
    await User.updateOne(
      { email: account.email },
      { $set: { name: account.name, passwordHash, role: account.role } },
      { upsert: true },
    );
  }

  for (const book of BOOKS) {
    await Book.updateOne({ seedKey: book.seedKey }, { $set: { ...book, active: true } }, { upsert: true });
  }
}

async function main(): Promise<void> {
  try {
    await connectDB(env.MONGODB_URI);
    await runSeed();
    const users = await User.countDocuments();
    const books = await Book.countDocuments();
    console.log(`Seed listo. Usuarios: ${users}. Libros: ${books}.`);
  } catch (err) {
    console.error(`No se pudo ejecutar el seed: ${safeDbError(err)}`);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main();
}
