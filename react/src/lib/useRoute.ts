import { useCallback, useEffect, useState } from 'react';
import { confirmDiscardUnsaved } from './saveStatus';

export const TABS = ['trama', 'personajes', 'capitulos', 'libros'] as const;
export type TabId = (typeof TABS)[number];

export const TAB_LABELS: Record<TabId, string> = {
  trama: 'Trama',
  personajes: 'Personajes',
  capitulos: 'Capítulos',
  libros: 'Libros',
};

export interface Route {
  tab: TabId;
  /**
   * Segundo segmento de la URL: el elemento seleccionado dentro de la tab.
   * Cada tab lo interpreta a su manera — personaje en Personajes, capítulo en
   * Capítulos. Trama no lo usa. Cambiar de tab lo descarta.
   */
  itemId: string | null;
}

const isTab = (v: string): v is TabId => (TABS as readonly string[]).includes(v);

function parse(hash: string): Route {
  const [tab, itemId] = hash.replace(/^#\/?/, '').split('/');
  return {
    tab: tab && isTab(tab) ? tab : 'personajes',
    itemId: itemId || null,
  };
}

const build = ({ tab, itemId }: Route) => `#/${tab}${itemId ? `/${itemId}` : ''}`;

/**
 * Router mínimo basado en hash. Sustituye a react-router por dos motivos: la
 * necesidad real es tres tabs y un id, y react-router-dom no funciona en React
 * Native, así que esta capa habría que reescribirla igual para la APK.
 *
 * Usa el hash y no history.pushState para que la build estática funcione sin
 * configurar un fallback a index.html en el servidor.
 */
export function useRoute(): [Route, (next: Partial<Route>) => void] {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  // confirmDiscardUnsaved cubre la navegación interna (tabs, seleccionar otro
  // elemento) y, junto al listener de beforeunload en SaveIndicator, el
  // cierre de pestaña. No cubre el botón Atrás del navegador: `hashchange`
  // llega cuando el cambio ya ha ocurrido, y revertirlo ensuciaría el
  // historial.
  const navigate = useCallback((next: Partial<Route>) => {
    if (!confirmDiscardUnsaved()) return;
    setRoute((current) => {
      const merged = { ...current, ...next };
      // Cambiar de tab descarta el elemento seleccionado, si no la URL
      // guardaría un id que la nueva tab no sabe interpretar.
      if (next.tab && next.tab !== current.tab && next.itemId === undefined) {
        merged.itemId = null;
      }
      const hash = build(merged);
      if (hash !== window.location.hash) window.location.hash = hash;
      return merged;
    });
  }, []);

  // Normaliza la URL al entrar sin hash, para que recargar mantenga el sitio.
  useEffect(() => {
    if (!window.location.hash) window.location.replace(build(route));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [route, navigate];
}
