import { useMemo, useState } from 'react';
import {
  useCreatePlotEvent,
  useDeletePlotEvent,
  useReorderPlotEvents,
  useUpdatePlotEvent,
} from '../../api/hooks';
import { ConfirmDialog, ErrorBanner } from '../../components/ui';
import { useOrderDraft } from '../../lib/useOrderDraft';
import { useUnsavedChanges } from '../../lib/useUnsavedChanges';
import type { Plot, PlotEvent } from '../../types';
import { PlotEventForm } from './PlotEventForm';

export function PlotTimeline({ plot, bookId }: { plot: Plot; bookId: string | null }) {
  const create = useCreatePlotEvent(bookId);
  const update = useUpdatePlotEvent(bookId);
  const remove = useDeletePlotEvent(bookId);
  const reorder = useReorderPlotEvents(bookId);
  const order = useOrderDraft(plot.events);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PlotEvent | null>(null);
  const [confirming, setConfirming] = useState<PlotEvent | null>(null);

  // Por suceso: qué promesas se siembran ahí y cuáles se pagan ahí.
  const promisesByEvent = useMemo(() => {
    const map = new Map<string, { seeds: string[]; payoffs: string[] }>();
    const entry = (id: string) => {
      if (!map.has(id)) map.set(id, { seeds: [], payoffs: [] });
      return map.get(id)!;
    };
    for (const p of plot.promises) {
      entry(p.setupEventId).seeds.push(p.title);
      if (p.payoffEventId) entry(p.payoffEventId).payoffs.push(p.title);
    }
    return map;
  }, [plot.promises]);

  const affectedByDelete = (eventId: string) => {
    const seeded = plot.promises.filter((p) => p.setupEventId === eventId).length;
    const paid = plot.promises.filter((p) => p.payoffEventId === eventId).length;
    return { seeded, paid };
  };

  const saveOrder = async () => {
    await reorder.mutateAsync(order.ids);
    order.cancel();
  };
  useUnsavedChanges({ dirty: order.dirty, saving: reorder.isPending, onSave: saveOrder });

  return (
    <div>
      <div className="grid-head">
        <span className="grid-count">
          {plot.events.length} {plot.events.length === 1 ? 'suceso' : 'sucesos'}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {plot.events.length > 1 && !order.reordering && (
            <button className="btn btn-sm" onClick={order.start}>
              Reordenar
            </button>
          )}
          <button className="btn btn-sm btn-primary" onClick={() => setCreating(true)}>
            + Suceso
          </button>
        </div>
      </div>

      <ErrorBanner error={create.error ?? update.error ?? remove.error ?? reorder.error} />

      {plot.events.length === 0 ? (
        <p className="empty-note">Todavía no hay sucesos en la trama.</p>
      ) : order.reordering ? (
        <>
          {order.draft.map((e, i) => (
            <div className="stage" key={e.id}>
              <div className="stage-num">{i + 1}</div>
              <div className="stage-body" style={{ fontWeight: 600 }}>{e.title}</div>
              <div className="stage-ctrl">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => order.move(i, -1)}
                  disabled={i === 0}
                  aria-label="Subir"
                >
                  ↑
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => order.move(i, 1)}
                  disabled={i === order.draft.length - 1}
                  aria-label="Bajar"
                >
                  ↓
                </button>
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button className="btn btn-sm" onClick={order.cancel} disabled={reorder.isPending}>
              Cancelar
            </button>
            <button className="btn btn-sm btn-primary" onClick={saveOrder} disabled={reorder.isPending}>
              {reorder.isPending ? 'Guardando…' : 'Guardar orden'}
            </button>
          </div>
        </>
      ) : (
        <div className="timeline">
          {plot.events.map((e, i) => {
            const badges = promisesByEvent.get(e.id);
            return (
              <div className="timeline-item" key={e.id}>
                <div className="timeline-rail">
                  <div className="timeline-dot" />
                  {i < plot.events.length - 1 && <div className="timeline-line" />}
                </div>
                <div className="timeline-body">
                  <div className="timeline-title">{e.title}</div>
                  {e.description && <div className="prose">{e.description}</div>}
                  {badges && (badges.seeds.length > 0 || badges.payoffs.length > 0) && (
                    <div className="event-promises">
                      {badges.seeds.map((title) => (
                        <span key={`seed-${title}`} className="badge badge-pending">
                          siembra: {title}
                        </span>
                      ))}
                      {badges.payoffs.map((title) => (
                        <span key={`payoff-${title}`} className="badge badge-paid">
                          paga: {title}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="timeline-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing(e)}>
                      Editar
                    </button>
                    <button className="btn btn-ghost btn-sm btn-danger" onClick={() => setConfirming(e)}>
                      Borrar
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {creating && (
        <PlotEventForm
          pending={create.isPending}
          error={create.error}
          onClose={() => setCreating(false)}
          onSubmit={async (values) => {
            await create.mutateAsync(values);
            setCreating(false);
          }}
        />
      )}

      {editing && (
        <PlotEventForm
          event={editing}
          pending={update.isPending}
          error={update.error}
          onClose={() => setEditing(null)}
          onSubmit={async (values) => {
            await update.mutateAsync({ id: editing.id, ...values });
            setEditing(null);
          }}
        />
      )}

      {confirming &&
        (() => {
          const { seeded, paid } = affectedByDelete(confirming.id);
          const parts: string[] = [];
          if (seeded > 0) parts.push(`se perderán ${seeded} ${seeded === 1 ? 'promesa sembrada aquí' : 'promesas sembradas aquí'}`);
          if (paid > 0) parts.push(`${paid} ${paid === 1 ? 'promesa pagada aquí volverá' : 'promesas pagadas aquí volverán'} a pendiente`);
          const warning = parts.length ? ` ${parts.join(' y ')}.` : '';
          return (
            <ConfirmDialog
              title="Borrar suceso"
              message={`¿Borrar "${confirming.title}"?${warning}`}
              pending={remove.isPending}
              onCancel={() => setConfirming(null)}
              onConfirm={async () => {
                await remove.mutateAsync(confirming.id);
                setConfirming(null);
              }}
            />
          );
        })()}
    </div>
  );
}
