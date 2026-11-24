export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function authHeaders(options: RequestInit = {}): Headers {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('libroya_token');
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  return headers;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers: authHeaders(options) });
  } catch {
    throw new Error('No se pudo conectar con el servidor');
  }

  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(data.error || 'Error de solicitud');
  }
  return data as T;
}

// Descarga un archivo protegido (el token va en el header, no en la URL).
export async function downloadFile(path: string, filename: string): Promise<void> {
  const response = await fetch(`${API_URL}${path}`, { headers: authHeaders() });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || 'No se pudo descargar');
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
