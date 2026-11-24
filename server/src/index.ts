import { createServer } from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { connectDB, safeDbError } from './db/connect';
import { initSocket } from './sockets';

async function main(): Promise<void> {
  try {
    await connectDB(env.MONGODB_URI);
  } catch (err) {
    console.error(`No se pudo conectar a MongoDB: ${safeDbError(err)}`);
    process.exit(1);
  }

  const app = createApp();
  const server = createServer(app);
  initSocket(server);
  server.listen(env.PORT, '0.0.0.0', () => {
    console.log(`API escuchando en 0.0.0.0:${env.PORT}`);
  });
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : 'Error al arrancar';
  console.error(message);
  process.exit(1);
});
