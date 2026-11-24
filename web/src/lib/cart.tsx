'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { Book } from './format';

// El carrito guarda datos para mostrar; el servidor solo recibe bookId y quantity.
export type CartItem = {
  bookId: string;
  title: string;
  format: Book['format'];
  priceCents: number;
  quantity: number;
};

type CartState = {
  items: CartItem[];
  count: number;
  subtotalCents: number;
  add: (book: Book) => void;
  setQuantity: (bookId: string, quantity: number) => void;
  remove: (bookId: string) => void;
  clear: () => void;
};

const KEY = 'libroya_cart';
const CartContext = createContext<CartState | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw) as CartItem[]);
    } catch {
      localStorage.removeItem(KEY);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(KEY, JSON.stringify(items));
  }, [items, loaded]);

  function add(book: Book) {
    setItems((current) => {
      const found = current.find((item) => item.bookId === book._id);
      if (found) {
        if (book.format === 'EBOOK') return current;
        return current.map((item) => (item.bookId === book._id ? { ...item, quantity: item.quantity + 1 } : item));
      }
      return [
        ...current,
        { bookId: book._id, title: book.title, format: book.format, priceCents: book.priceCents, quantity: 1 },
      ];
    });
  }

  function setQuantity(bookId: string, quantity: number) {
    setItems((current) =>
      current.map((item) => {
        if (item.bookId !== bookId) return item;
        const max = item.format === 'EBOOK' ? 1 : 50;
        return { ...item, quantity: Math.min(max, Math.max(1, Math.trunc(quantity) || 1)) };
      }),
    );
  }

  function remove(bookId: string) {
    setItems((current) => current.filter((item) => item.bookId !== bookId));
  }

  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotalCents = items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);

  return (
    <CartContext.Provider value={{ items, count, subtotalCents, add, setQuantity, remove, clear: () => setItems([]) }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCart debe usarse dentro de CartProvider');
  return value;
}
