import bcrypt from 'bcrypt';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { loginRateLimit } from '../middleware/rateLimit';
import { parseBody } from '../middleware/validate';
import { User } from '../models/User';

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(80),
  email: z.string().trim().email('Email inválido').max(120),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(72),
});

const loginSchema = z.object({
  email: z.string().trim().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

function publicUser(user: { _id: unknown; name: string; email: string; role: string }) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

function signToken(user: { id: string; role: string }): string {
  return jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, { expiresIn: '7d' });
}

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const body = parseBody(registerSchema, req.body);
    const email = body.email.toLowerCase();
    const existing = await User.findOne({ email });
    if (existing) {
      throw new AppError(409, 'El email ya está registrado');
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await User.create({
      name: body.name,
      email,
      passwordHash,
      role: 'cliente',
    });

    const publicData = publicUser(user);
    res.status(201).json({ token: signToken(publicData), user: publicData });
  }),
);

authRouter.post(
  '/login',
  loginRateLimit,
  asyncHandler(async (req, res) => {
    const body = parseBody(loginSchema, req.body);
    const user = await User.findOne({ email: body.email.toLowerCase() });
    const matches = user ? await bcrypt.compare(body.password, user.passwordHash) : false;
    if (!user || !matches) {
      throw new AppError(401, 'Credenciales inválidas');
    }

    const publicData = publicUser(user);
    res.json({ token: signToken(publicData), user: publicData });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user!.id);
    if (!user) {
      throw new AppError(401, 'No autenticado');
    }
    res.json(publicUser(user));
  }),
);
