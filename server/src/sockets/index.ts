import type { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { env } from '../config/env';
import type { Role } from '../models/User';

type TokenPayload = { sub: string; role: Role };

let io: Server | null = null;

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: env.CLIENT_ORIGIN,
      methods: ['GET', 'POST'],
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== 'string' || token.length === 0) {
      next(new Error('No autenticado'));
      return;
    }
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
      if (!payload.sub || (payload.role !== 'cliente' && payload.role !== 'admin')) {
        next(new Error('No autenticado'));
        return;
      }
      socket.data.userId = payload.sub;
      socket.data.role = payload.role;
      next();
    } catch {
      next(new Error('No autenticado'));
    }
  });

  io.on('connection', (socket) => {
    const userId = String(socket.data.userId);
    socket.join(`user:${userId}`);
    if (socket.data.role === 'admin') {
      socket.join('admin');
    }
  });

  return io;
}

// En tests no hay servidor de sockets: las emisiones no hacen nada.
export function emitToAdmin(event: string, payload: unknown): void {
  io?.to('admin').emit(event, payload);
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  io?.to(`user:${userId}`).emit(event, payload);
}
