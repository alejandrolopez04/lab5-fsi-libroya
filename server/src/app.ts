import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { adminBooksRouter } from './routes/adminBooks';
import { adminShipmentsRouter } from './routes/adminShipments';
import { authRouter } from './routes/auth';
import { booksRouter } from './routes/books';
import { healthRouter } from './routes/health';
import { ordersRouter } from './routes/orders';
import { paymentsRouter } from './routes/payments';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: env.CLIENT_ORIGIN,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/books', booksRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/admin/books', adminBooksRouter);
  app.use('/api/admin/shipments', adminShipmentsRouter);
  app.use((_req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
  });
  app.use(errorHandler);
  return app;
}
