import type { NextFunction, Request, Response } from 'express';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  const parseFailed =
    typeof err === 'object' && err !== null && 'type' in err && (err as { type?: string }).type === 'entity.parse.failed';
  if (parseFailed) {
    res.status(400).json({ error: 'JSON inválido' });
    return;
  }

  console.error('Error interno');
  res.status(500).json({ error: 'Error interno' });
}
