import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const schema = z.object({
  PORT: z
    .string()
    .trim()
    .regex(/^\d+$/, 'PORT')
    .transform((value) => Number(value)),
  MONGODB_URI: z.string().trim().min(1),
  JWT_SECRET: z.string().trim().min(32, 'JWT_SECRET (mínimo 32 caracteres)'),
  CLIENT_ORIGIN: z.string().trim().url(),
  PAYPAL_CLIENT_ID: z.string().trim().min(1),
  PAYPAL_CLIENT_SECRET: z.string().trim().min(1),
  PAYPAL_API_BASE: z.string().trim().url(),
});

export type Env = z.infer<typeof schema>;

function readEnv(): Env {
  const parsed = schema.safeParse({
    PORT: process.env.PORT,
    MONGODB_URI: process.env.MONGODB_URI,
    JWT_SECRET: process.env.JWT_SECRET,
    CLIENT_ORIGIN: process.env.CLIENT_ORIGIN,
    PAYPAL_CLIENT_ID: process.env.PAYPAL_CLIENT_ID,
    PAYPAL_CLIENT_SECRET: process.env.PAYPAL_CLIENT_SECRET,
    PAYPAL_API_BASE: process.env.PAYPAL_API_BASE,
  });

  if (!parsed.success) {
    const keys = parsed.error.issues.map((issue) => issue.path.join('.') || issue.message);
    const unique = [...new Set(keys)];
    const message = `Faltan o son inválidas variables de entorno: ${unique.join(', ')}`;
    if (process.env.NODE_ENV === 'test') {
      throw new Error(message);
    }
    console.error(message);
    process.exit(1);
  }

  return parsed.data;
}

export const env = readEnv();
