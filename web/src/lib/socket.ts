'use client';

import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { API_URL } from './api';

// Se conecta con el JWT; el servidor decide a qué salas entra el usuario.
export function useSocketEvents(handlers: Record<string, () => void>, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const token = localStorage.getItem('libroya_token');
    if (!token) return;
    const socket = io(API_URL, { auth: { token }, transports: ['websocket', 'polling'] });
    for (const [event, handler] of Object.entries(handlers)) socket.on(event, handler);
    // Al reconectar se resincroniza por REST.
    socket.on('connect', () => handlers.resync?.());
    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
