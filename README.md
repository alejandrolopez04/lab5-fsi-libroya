# LibroYa

Tienda en línea de libros **ebook** (descarga digital) y **físicos** (stock y envío). Laboratorio 5 de Fundamentos de Sistemas de Información (UdeA).

- `web`: Next.js 15 (App Router) + Tailwind. Solo interfaz.
- `server`: Express + Socket.IO + Mongoose, todo en un proceso. API REST, pagos, stock y tiempo real.
- MongoDB Atlas · PayPal Sandbox (Orders API v2, solo desde el backend) · Railway · TestSprite.

## Arquitectura

```
Navegador ──HTTPS──> Next.js (web, Railway)
    └──REST + WSS──> Express + Socket.IO (server, Railway) ──Mongoose──> MongoDB Atlas
                                                           └──HTTPS────> PayPal Sandbox
TestSprite ──> URL pública del frontend
```

El navegador solo envía `bookId` y `quantity`. El servidor recalcula los precios, valida el stock, crea la orden en PayPal con el total de la BD, verifica la captura (estado, monto, moneda y `custom_id`) y es el único que cambia estados.

## Variables

`server/.env` (no se sube a git; la plantilla es `server/.env.example`):

| Variable | Local |
| --- | --- |
| `PORT` | `4000` |
| `MONGODB_URI` | URI de Atlas con la base `libroya` |
| `JWT_SECRET` | cadena aleatoria de 32 caracteres o más (el servidor no arranca con menos) |
| `CLIENT_ORIGIN` | `http://localhost:3000` |
| `PAYPAL_CLIENT_ID` | Client ID de Sandbox |
| `PAYPAL_CLIENT_SECRET` | Secret de Sandbox |
| `PAYPAL_API_BASE` | `https://api-m.sandbox.paypal.com` |
| `SEED_ADMIN_PASSWORD` | contraseña del admin que crea el seed (mínimo 10 caracteres; no se escribe en el código) |

`web/.env.local`: en local `NEXT_PUBLIC_API_URL` puede quedar vacío (usa `http://localhost:4000`). Nunca pongas secretos en variables `NEXT_PUBLIC_*`.

## Arranque local

```bash
npm install
npm run seed     # admin, cliente y 8 libros de demostración
npm run dev      # API en :4000, web en :3000
npm test         # Jest + Supertest con MongoMemoryReplSet y PayPal simulado
```

Cuentas del seed:

- Admin: `admin@libroya.test`, con la contraseña definida en `SEED_ADMIN_PASSWORD` (no se publica).
- Cliente de prueba (ficticio, sin privilegios; lo usa TestSprite): `cliente@libroya.test` / `Cliente123!`

## Modelos

| Colección | Campos principales | Reglas |
| --- | --- | --- |
| users | name, email, passwordHash, role | bcrypt; el registro siempre crea `cliente` |
| books | title, author, category, format, priceCents, stock, active | stock solo para FISICO |
| orders | userId, items (snapshot de precio), address, totalCents, status, paymentStatus | total recalculado en el servidor |
| payments | orderId, providerOrderId, captureId, amountCents, status | índices únicos; sin datos de tarjeta |
| shipments | orderId, userId, status, trackingNumber, history | un envío por pedido con físicos |
| stockMovements | bookId, delta, reason, orderId, stockAfter | auditoría de stock |

Estados:

- Pedido: `PENDING_PAYMENT → PAID → COMPLETED` (solo ebooks: pasa directo a `COMPLETED` al pagar).
- Pago: `CREATED → CAPTURED`, o `FAILED` / `CANCELLED`.
- Envío: `PENDIENTE → EN_PREPARACION → ENVIADO (exige guía) → ENTREGADO`. Solo el admin, un paso a la vez.

## Endpoints

| Método y ruta | Acceso |
| --- | --- |
| `GET /health` | Público |
| `POST /api/auth/register` · `POST /api/auth/login` (rate limit) · `GET /api/auth/me` | Público / autenticado |
| `GET /api/books` (filtros `category`, `format`, `q`) · `GET /api/books/:id` | Público |
| `GET/POST /api/admin/books` · `PATCH /api/admin/books/:id` · `PATCH /api/admin/books/:id/stock` | Admin |
| `POST /api/orders` · `GET /api/orders/me` · `GET /api/orders/:id/download/:bookId` | Cliente dueño |
| `POST /api/payments/paypal/order` · `/capture` (idempotente) · `/cancel` | Cliente dueño |
| `GET /api/admin/shipments` · `PATCH /api/admin/shipments/:id/status` | Admin |

Errores: 400 validación, 401 sin sesión, 403 rol o pedido ajeno, 409 stock o transición inválida.

## WebSockets (Socket.IO)

El handshake lleva el JWT (`auth.token`). El servidor une el socket a `user:<id>` y, si es admin, a `admin`. El navegador nunca elige la sala.

- `shipment:created` y `shipment:statusChanged` → sala `admin` (tablero Kanban).
- `order:updated` → `user:<id>` (historial del cliente). Al reconectar, el cliente vuelve a consultar por REST.

## Despliegue en Railway

Se crean dos servicios desde el mismo repositorio:

1. **server**: Root Directory `server`, build `npm run build`, start `npm start`, healthcheck `/health`. Variables: las 7 de `server/.env`, con `CLIENT_ORIGIN` = URL pública exacta del frontend (sin `/` al final).
2. **web**: Root Directory `web`, build `npm run build`, start `npm start`. Variable `NEXT_PUBLIC_API_URL` = URL pública del server. Como se usa en el build, si la cambias tienes que redesplegar.

Con la skill: `npx skills add railwayapp/railway-skills` y en el agente `/use-railway despliega backend (server) y frontend (web)`.

Atlas: agrega 0.0.0.0/0 en Network Access si Railway no tiene IP fija (limitación conocida para el entorno académico). El seed se ejecuta una vez desde local contra la misma base.

## Limitaciones conocidas

- El ebook es un `.txt` generado (demostración); no se suben archivos.
- No hay reembolsos: si un pago se captura y justo antes otra compra agotó el stock, el pedido no se confirma y requiere gestión manual.
- Moneda USD, porque PayPal no admite COP.
- El token de sesión se guarda en `localStorage`.
- El stock no se reserva al iniciar el pago (ver `AUDITORIA_SEGURIDAD.md`, M2).
