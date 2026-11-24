import type { Metadata } from 'next';
import { Header } from '../components/Header';
import { AuthProvider } from '../lib/auth';
import { CartProvider } from '../lib/cart';
import { ToastProvider } from '../lib/toast';
import './globals.css';

export const metadata: Metadata = {
  title: 'LibroYa',
  description: 'Tienda de libros electrónicos y físicos',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>
          <CartProvider>
            <ToastProvider>
              <Header />
              <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
            </ToastProvider>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
