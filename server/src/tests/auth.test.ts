import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../app';
import { safeDbError } from '../db/connect';
import { User } from '../models/User';

const app = createApp();

async function createUser(input: { email: string; password: string; role: 'cliente' | 'admin'; name?: string }) {
  return User.create({
    name: input.name ?? 'Prueba',
    email: input.email,
    passwordHash: await bcrypt.hash(input.password, 10),
    role: input.role,
  });
}

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI as string);
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe('health y auth', () => {
  it('oculta credenciales en errores de conexión', () => {
    const message = safeDbError(
      new Error('querySrv ENOTFOUND mongodb+srv://lector:clave-super-secreta@cluster0.example.net/libroya'),
    );
    expect(message).not.toContain('clave-super-secreta');
    expect(message).not.toContain('lector');
    expect(message).toContain('mongodb://***');
  });

  it('responde /health', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('registra un cliente e ignora un rol admin enviado en el cuerpo', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Ana',
      email: 'ana@libroya.test',
      password: 'Cliente123!',
      role: 'admin',
    });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('cliente');
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.token).toEqual(expect.any(String));

    const stored = await User.findOne({ email: 'ana@libroya.test' });
    expect(stored?.role).toBe('cliente');
    expect(stored?.passwordHash).not.toBe('Cliente123!');
  });

  it('inicia sesión con credenciales válidas y rechaza las inválidas', async () => {
    await createUser({ email: 'cliente@libroya.test', password: 'Cliente123!', role: 'cliente' });

    const ok = await request(app).post('/api/auth/login').send({
      email: 'cliente@libroya.test',
      password: 'Cliente123!',
    });
    expect(ok.status).toBe(200);
    expect(ok.body.user.role).toBe('cliente');

    const bad = await request(app).post('/api/auth/login').send({
      email: 'cliente@libroya.test',
      password: 'incorrecta',
    });
    expect(bad.status).toBe(401);
    expect(bad.body).toEqual({ error: 'Credenciales inválidas' });
  });

  it('devuelve el perfil autenticado', async () => {
    const registered = await request(app).post('/api/auth/register').send({
      name: 'Ana',
      email: 'ana@libroya.test',
      password: 'Cliente123!',
    });

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${registered.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe('ana@libroya.test');

    const missing = await request(app).get('/api/auth/me');
    expect(missing.status).toBe(401);
  });

  it('niega el catálogo admin a un cliente y lo permite al admin', async () => {
    const client = await request(app).post('/api/auth/register').send({
      name: 'Ana',
      email: 'ana@libroya.test',
      password: 'Cliente123!',
    });
    const forbidden = await request(app)
      .get('/api/admin/books')
      .set('Authorization', `Bearer ${client.body.token}`);
    expect(forbidden.status).toBe(403);

    await createUser({ email: 'admin@libroya.test', password: 'Admin123!', role: 'admin', name: 'Admin' });
    const login = await request(app).post('/api/auth/login').send({
      email: 'admin@libroya.test',
      password: 'Admin123!',
    });
    const allowed = await request(app).get('/api/admin/books').set('Authorization', `Bearer ${login.body.token}`);
    expect(allowed.status).toBe(200);
    expect(Array.isArray(allowed.body)).toBe(true);
  });
});
