/**
 * Sin servidor no hay `fetch`, ni `fileUrl` (no hay fotos, ver CLAUDE.md), ni
 * `api.*`: el store (`src/store/`) hace directamente lo que antes hacía la
 * API. Lo único que sobrevive de este fichero es `ApiError`, con la MISMA
 * firma que en `react/`, porque `components/ui.tsx` (`ErrorBanner`) y varios
 * componentes de tabs siguen importándola de aquí sin cambios — es la parte
 * del seam API que el resto de la app no necesita saber que ha cambiado.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: { campo: string; problema: string }[],
  ) {
    super(message);
  }
}
