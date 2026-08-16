import { useState } from 'react';
import { useCreatePromise, useDeletePromise, useUpdatePromise } from '../../api/hooks';
import { ConfirmDialog, ErrorBanner } from '../../components/ui';
import type { Plot, PlotPromise } from '../../types';
import { PromiseForm } from './PromiseForm';

function PromiseRow({
  promise,
  events,
  onMarkPaidIn,
  onEdit,
  onDelete,
}: {
  promise: PlotPromise;
  events: Plot['events'];
  onMarkPaidIn: (eventId: string | null) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  // Un pago con posición anterior a la siembra es un flashback/revelación:
  // no se prohíbe, sólo se señala.
  const outOfOrder =
    promise.payoffEvent !== null && promise.payoffEvent.position < promise.setupEvent.position;

  return (
    <div className="promise">
      <div className="promise-title">{promise.title}</div>
      <div className="promise-link">
        Se siembra en #{promise.setupEvent.position + 1} · {promise.setupEvent.title}
      </div>
      {promise.description && <div className="prose">{promise.description}</div>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
        {promise.payoffEventId ? (
          <span className="badge badge-paid">
            paga en #{(promise.payoffEvent?.position ?? 0) + 1} · {promise.payoffEvent?.title}
          </span>
        ) : (
          <span className="badge badge-pending">pendiente</span>
        )}
        {outOfOrder && <span className="badge">se paga antes de sembrarse</span>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        <select
          className="select"
          style={{ width: 'auto' }}
          value={promise.payoffEventId ?? ''}
          onChange={(e) => onMarkPaidIn(e.target.value || null)}
        >
          <option value="">— Pendiente —</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              Pagar en #{e.position + 1} · {e.title}
            </option>
          ))}
        </select>
        <button className="btn btn-ghost btn-sm" onClick={onEdit}>
          Editar
        </button>
        <button className="btn btn-ghost btn-sm btn-danger" onClick={onDelete}>
          Borrar
        </button>
      </div>
    </div>
  );
}

export function PromisesPanel({ plot, bookId }: { plot: Plot; bookId: string | null }) {
  const create = useCreatePromise(bookId);
  const update = useUpdatePromise(bookId);
  const remove = useDeletePromise(bookId);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PlotPromise | null>(null);
  const [confirming, setConfirming] = useState<PlotPromise | null>(null);

  const pending = plot.promises.filter((p) => p.payoffEventId === null);
  const paid = plot.promises.filter((p) => p.payoffEventId !== null);
  const noEvents = plot.events.length === 0;

  return (
    <>
      <div className="plot-side-head">
        <strong>
          Promesas — {pending.length} de {plot.promises.length} sin pagar
        </strong>
        <button
          className="btn btn-sm btn-primary"
          onClick={() => setCreating(true)}
          disabled={noEvents}
          title={noEvents ? 'Necesitas al menos un suceso para crear una promesa' : undefined}
        >
          + Promesa
        </button>
      </div>

      <ErrorBanner error={create.error ?? update.error ?? remove.error} />

      {plot.promises.length === 0 ? (
        <p className="empty-note">Sin promesas todavía.</p>
      ) : (
        <>
          {pending.length > 0 && (
            <>
              <div className="grid-count" style={{ marginBottom: 4 }}>
                Pendientes
              </div>
              {pending.map((p) => (
                <PromiseRow
                  key={p.id}
                  promise={p}
                  events={plot.events}
                  onMarkPaidIn={(eventId) => update.mutate({ id: p.id, payoffEventId: eventId })}
                  onEdit={() => setEditing(p)}
                  onDelete={() => setConfirming(p)}
                />
              ))}
            </>
          )}
          {paid.length > 0 && (
            <>
              <div className="grid-count" style={{ margin: '10px 0 4px' }}>
                Cumplidas
              </div>
              {paid.map((p) => (
                <PromiseRow
                  key={p.id}
                  promise={p}
                  events={plot.events}
                  onMarkPaidIn={(eventId) => update.mutate({ id: p.id, payoffEventId: eventId })}
                  onEdit={() => setEditing(p)}
                  onDelete={() => setConfirming(p)}
                />
              ))}
            </>
          )}
        </>
      )}

      {creating && (
        <PromiseForm
          events={plot.events}
          defaultSetupEventId={plot.events[0]?.id ?? ''}
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
        <PromiseForm
          promise={editing}
          events={plot.events}
          pending={update.isPending}
          error={update.error}
          onClose={() => setEditing(null)}
          onSubmit={async (values) => {
            await update.mutateAsync({ id: editing.id, ...values });
            setEditing(null);
          }}
        />
      )}

      {confirming && (
        <ConfirmDialog
          title="Borrar promesa"
          message={`¿Borrar la promesa "${confirming.title}"?`}
          pending={remove.isPending}
          onCancel={() => setConfirming(null)}
          onConfirm={async () => {
            await remove.mutateAsync(confirming.id);
            setConfirming(null);
          }}
        />
      )}
    </>
  );
}
