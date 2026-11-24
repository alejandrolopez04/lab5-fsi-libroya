import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import type { Role } from '../models/User';
import { AppError } from './errorHandler';

export type AuthUser = { id: string; role: Role };

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

type TokenPayload = { sub: string; role: Role };

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) {
    next(new AppError(401, 'No autenticado'));
    return;
  }

  try {
    const payload = jwt.verify(header.slice('Bearer '.length), env.JWT_SECRET) as TokenPayload;
    if (!payload.sub || (payload.role !== 'cliente' && payload.role !== 'admin')) {
      next(new AppError(401, 'No autenticado'));
      return;
    }
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(new AppError(401, 'No autenticado'));
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new AppError(403, 'No autorizado'));
      return;
    }
    next();
  };
}
