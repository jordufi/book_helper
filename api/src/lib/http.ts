import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';

/** Error con código HTTP explícito, para distinguirlo de un fallo inesperado. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new HttpError(404, `${what} no encontrado`);

/**
 * Express 4 no captura rechazos de handlers async: si uno lanza, la petición
 * se queda colgada hasta el timeout en vez de responder. Este wrapper reenvía
 * el error a la cadena de middleware.
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Datos inválidos',
      details: err.issues.map((i) => ({ campo: i.path.join('.'), problema: i.message })),
    });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  // body-parser rechaza un cuerpo mayor que el límite de express.json.
  if (typeof err === 'object' && err !== null && 'type' in err && (err as { type: string }).type === 'entity.too.large') {
    res.status(413).json({ error: 'El contenido enviado es demasiado grande' });
    return;
  }

  // Violación de clave foránea: normalmente un id de libro/personaje inexistente.
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = (err as { code: string }).code;
    if (code === 'P2003') {
      res.status(400).json({ error: 'Referencia a un registro que no existe' });
      return;
    }
    if (code === 'P2002') {
      res.status(409).json({ error: 'Ese registro ya existe' });
      return;
    }
    if (code === 'P2025') {
      res.status(404).json({ error: 'No encontrado' });
      return;
    }
  }

  console.error('[error no controlado]', err);
  res.status(500).json({ error: 'Error interno del servidor' });
}
