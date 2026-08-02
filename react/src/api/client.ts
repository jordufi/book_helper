const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/** Convierte una photoUrl relativa de la API en absoluta para el <img>. */
export const fileUrl = (path: string | null | undefined) => (path ? `${BASE}${path}` : null);

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: { campo: string; problema: string }[],
  ) {
    super(message);
  }
}

async function parseError(res: Response): Promise<never> {
  let message = `Error ${res.status}`;
  let details: { campo: string; problema: string }[] | undefined;

  try {
    const body = await res.json();
    if (body?.error) message = body.error;
    if (Array.isArray(body?.details)) details = body.details;
  } catch {
    // Respuesta sin JSON (p.ej. un 502 de un proxy): nos quedamos con el genérico.
  }

  throw new ApiError(res.status, message, details);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, init);
  } catch {
    // fetch sólo rechaza por fallo de red, no por códigos HTTP. Aquí la API
    // no está levantada o el móvil apunta a la IP equivocada: merece un
    // mensaje concreto en vez de "Failed to fetch".
    throw new ApiError(0, `No se pudo conectar con la API en ${BASE}. ¿Está arrancada?`);
  }

  if (!res.ok) await parseError(res);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, json('POST', body)),
  patch: <T>(path: string, body: unknown) => request<T>(path, json('PATCH', body)),
  put: <T>(path: string, body: unknown) => request<T>(path, json('PUT', body)),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, file: File) => {
    const form = new FormData();
    form.append('photo', file);
    // Sin Content-Type a mano: el navegador debe generar el boundary del multipart.
    return request<T>(path, { method: 'POST', body: form });
  },
};
