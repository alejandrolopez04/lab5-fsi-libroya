import type { ZodSchema } from 'zod';
import { AppError } from './errorHandler';

export function parseBody<T>(schema: ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const message = result.error.issues.map((issue) => issue.message).join('. ');
    throw new AppError(400, message);
  }
  return result.data;
}
