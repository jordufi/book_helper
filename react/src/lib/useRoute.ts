import { useCallback, useEffect, useState } from 'react';

export const TABS = ['trama', 'personajes', 'capitulos'] as const;
export type TabId = (typeof TABS)[number];

export const TAB_LABELS: Record<TabId, string> = {
  trama: 'Trama',
  personajes: 'Personajes',
  capitulos: 'Capítulos',
};

export interface Route {
  tab: TabId;
  /** Personaje seleccionado, sólo con tab === 'personajes'. */
  characterId: string | null;
}

const isTab = (v: string): v is TabId => (TABS as readonly string[]).includes(v);

function parse(hash: string): Route {
  const [tab, characterId] = hash.replace(/^#\/?/, '').split('/');
  return {
    tab: tab && isTab(tab) ? tab : 'personajes',
    characterId: characterId || null,
  };
}

const build = ({ tab, characterId }: Route) =>
  `#/${tab}${characterId ? `/${characterId}` : ''}`;

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

  const navigate = useCallback((next: Partial<Route>) => {
    setRoute((current) => {
      const merged = { ...current, ...next };
      // Cambiar de tab descarta el personaje seleccionado, si no la URL
      // guardaría un id que la nueva tab no sabe interpretar.
      if (next.tab && next.tab !== current.tab && next.characterId === undefined) {
        merged.characterId = null;
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
