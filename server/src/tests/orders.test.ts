import request from 'supertest';
import { createApp } from '../app';
import { Book } from '../models/Book';
import { Order } from '../models/Order';
import { ADDRESS, demoBooks, useTestDb, userWithToken } from './helpers';

const app = createApp();
useTestDb();

describe('catálogo, stock y pedidos', () => {
  it('el catálogo público filtra por formato y oculta inactivos', async () => {
    const { physical } = await demoBooks();
    await Book.updateOne({ _id: physical._id }, { active: false });
    const res = await request(app).get('/api/books');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    const ebooks = await request(app).get('/api/books?format=EBOOK');
    expect(ebooks.body.every((book: { format: string }) => book.format === 'EBOOK')).toBe(true);
  });

  it('recalcula el total con el precio de la BD e ignora el precio enviado', async () => {
    const { physical, ebook } = await demoBooks();
    const { auth } = await userWithToken('cliente');
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', auth)
      .send({
        items: [
          { bookId: String(physical._id), quantity: 2, priceCents: 1 },
          { bookId: String(ebook._id), quantity: 1, unitPriceCents: 1 },
        ],
        totalCents: 3,
        address: ADDRESS,
      });
    expect(res.status).toBe(201);
    expect(res.body.totalCents).toBe(2000 * 2 + 1500);
    expect(res.body.status).toBe('PENDING_PAYMENT');
  });

  it('rechaza cantidades inválidas, stock insuficiente y dirección faltante', async () => {
    const { physical, ebook } = await demoBooks();
    const { auth } = await userWithToken('cliente');
    const send = (body: object) => request(app).post('/api/orders').set('Authorization', auth).send(body);

    expect((await send({ items: [{ bookId: String(physical._id), quantity: -1 }], address: ADDRESS })).status).toBe(400);
    expect((await send({ items: [{ bookId: String(physical._id), quantity: 1.5 }], address: ADDRESS })).status).toBe(400);
    expect((await send({ items: [{ bookId: String(physical._id), quantity: 4 }], address: ADDRESS })).status).toBe(409);
    expect((await send({ items: [{ bookId: String(physical._id), quantity: 1 }] })).status).toBe(400);
    expect((await send({ items: [{ bookId: String(ebook._id), quantity: 2 }] })).status).toBe(400);
    const blankAddress = { ...ADDRESS, line1: '   ', city: '   ' };
    expect((await send({ items: [{ bookId: String(physical._id), quantity: 1 }], address: blankAddress })).status).toBe(400);
    // Ninguna validación fallida dejó pedidos guardados.
    expect(await Order.countDocuments()).toBe(0);
    expect((await send({ items: [{ bookId: String(ebook._id), quantity: 1 }] })).status).toBe(201);
    expect(await Order.countDocuments()).toBe(1);
  });

  it('exige sesión para crear pedidos', async () => {
    const res = await request(app).post('/api/orders').send({ items: [] });
    expect(res.status).toBe(401);
  });

  it('el historial solo muestra pedidos propios y la descarga ajena se niega', async () => {
    const { ebook } = await demoBooks();
    const owner = await userWithToken('cliente', 'duena@libroya.test');
    const other = await userWithToken('cliente', 'otra@libroya.test');
    const created = await request(app)
      .post('/api/orders')
      .set('Authorization', owner.auth)
      .send({ items: [{ bookId: String(ebook._id), quantity: 1 }] });
    await Order.updateOne({ _id: created.body._id }, { status: 'COMPLETED' });

    const mine = await request(app).get('/api/orders/me').set('Authorization', other.auth);
    expect(mine.body).toHaveLength(0);

    const url = `/api/orders/${created.body._id}/download/${ebook._id}`;
    expect((await request(app).get(url).set('Authorization', other.auth)).status).toBe(403);
    const ok = await request(app).get(url).set('Authorization', owner.auth);
    expect(ok.status).toBe(200);
    expect(ok.text).toContain('Libro digital');
  });

  it('el admin ajusta stock sin dejarlo negativo y el cliente recibe 403', async () => {
    const { physical, ebook } = await demoBooks();
    const admin = await userWithToken('admin');
    const client = await userWithToken('cliente');
    const url = `/api/admin/books/${physical._id}/stock`;

    expect((await request(app).patch(url).set('Authorization', client.auth).send({ delta: 5 })).status).toBe(403);
    const up = await request(app).patch(url).set('Authorization', admin.auth).send({ delta: 5 });
    expect(up.body.stock).toBe(8);
    expect((await request(app).patch(url).set('Authorization', admin.auth).send({ delta: -20 })).status).toBe(409);
    const ebookUrl = `/api/admin/books/${ebook._id}/stock`;
    expect((await request(app).patch(ebookUrl).set('Authorization', admin.auth).send({ delta: 1 })).status).toBe(409);
  });
});
