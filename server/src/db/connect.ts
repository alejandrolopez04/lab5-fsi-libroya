import mongoose from 'mongoose';

export function safeDbError(err: unknown): string {
  const raw = err instanceof Error ? err.message : 'Error de base de datos';
  return raw
    .replace(/mongodb(\+srv)?:\/\/[^\s]+/gi, 'mongodb://***')
    .replace(/\/\/[^@\s/]+@/g, '//***@');
}

export async function connectDB(uri: string): Promise<void> {
  await mongoose.connect(uri);
  console.log('Conectado a MongoDB');
}
