'use client';

import { createContext, useCallback, useContext, useState } from 'react';

type Toast = { id: number; kind: 'success' | 'error' | 'info'; text: string };
type ToastState = { notify: (kind: Toast['kind'], text: string) => void };

const ToastContext = createContext<ToastState | null>(null);

const STYLES: Record<Toast['kind'], string> = {
  success: 'border-green-600 bg-green-600 text-white',
  error: 'border-red-600 bg-red-600 text-white',
  info: 'border-blue-600 bg-blue-600 text-white',
};
const ICONS: Record<Toast['kind'], string> = { success: '✓', error: '!', info: 'i' };

// Avisos flotantes visibles en la esquina superior derecha; se cierran solos o con un clic.
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((toast) => toast.id !== id)), []);

  const notify = useCallback(
    (kind: Toast['kind'], text: string) => {
      const id = Date.now() + Math.random();
      setToasts((list) => [...list.slice(-3), { id, kind, text }]);
      setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 4000);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="pointer-events-none fixed right-4 top-20 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">
        {toasts.map((toast) => (
          <button
            key={toast.id}
            type="button"
            onClick={() => dismiss(toast.id)}
            role={toast.kind === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex items-start gap-3 rounded-lg border-2 px-4 py-3 text-left text-sm font-medium shadow-lg ${STYLES[toast.kind]}`}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/25 text-xs font-bold">
              {ICONS[toast.kind]}
            </span>
            <span>{toast.text}</span>
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast debe usarse dentro de ToastProvider');
  return value;
}
