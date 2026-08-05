import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import {
  Badge,
  Button,
  Card,
  EmptyNote,
  ErrorBanner,
  Field,
  Input,
  Placeholder,
  Prose,
  Screen,
  ScreenScroll,
  Section,
  Select,
  Sheet,
  Spinner,
  Subtle,
  Title,
} from '../ui/components';
import { SPACING, useTheme } from '../ui/theme';
import {
  useCreateEvent,
  useCreatePromise,
  useDeleteEvent,
  useDeletePromise,
  usePlot,
  useReorderEvents,
  useUpdateEvent,
  useUpdatePromise,
} from '../data/hooks';
import { useActiveBook } from '../state/useActiveBook';
import type { Plot, PlotEvent, PlotPromise } from '../types';

/** Promesa reducida a lo que necesita un badge; el id es la key, no el título
 *  (dos promesas pueden llamarse igual). */
interface PromiseBadge {
  id: string;
  title: string;
}

export function PlotScreen() {
  const t = useTheme();
  const { bookId } = useActiveBook();
  const { data: plot, isLoading, error } = usePlot(bookId);

  const createEvent = useCreateEvent(bookId);
  const updateEvent = useUpdateEvent(bookId);
  const deleteEvent = useDeleteEvent(bookId);
  const reorderEvents = useReorderEvents(bookId);
  const createPromise = useCreatePromise(bookId);
  const updatePromise = useUpdatePromise(bookId);
  const deletePromise = useDeletePromise(bookId);

  const [eventForm, setEventForm] = useState<{ event?: PlotEvent } | null>(null);
  const [promiseForm, setPromiseForm] = useState<{ promise?: PlotPromise } | null>(null);
  const [order, setOrder] = useState<PlotEvent[] | null>(null);

  const promisesByEvent = useMemo(() => {
    const map = new Map<string, { seeds: PromiseBadge[]; payoffs: PromiseBadge[] }>();
    const entry = (id: string) => {
      if (!map.has(id)) map.set(id, { seeds: [], payoffs: [] });
      return map.get(id)!;
    };
    for (const p of plot?.promises ?? []) {
      entry(p.setupEventId).seeds.push({ id: p.id, title: p.title });
      if (p.payoffEventId) entry(p.payoffEventId).payoffs.push({ id: p.id, title: p.title });
    }
    return map;
  }, [plot?.promises]);

  if (!bookId) {
    return (
      <Screen>
        <Placeholder title="Sin libro" message="Crea un libro en la pestaña Libros para empezar." />
      </Screen>
    );
  }

  if (isLoading)
    return (
      <Screen>
        <Spinner />
      </Screen>
    );

  const events = plot?.events ?? [];
  const promises = plot?.promises ?? [];
  const pending = promises.filter((p) => !p.payoffEventId);
  const paid = promises.filter((p) => p.payoffEventId);
  const shown = order ?? events;

  const move = (i: number, delta: number) =>
    setOrder((current) => {
      const d = [...(current ?? events)];
      const j = i + delta;
      if (j < 0 || j >= d.length) return d;
      [d[i], d[j]] = [d[j], d[i]];
      return d;
    });

  const confirmDeleteEvent = (event: PlotEvent) => {
    const seeded = promises.filter((p) => p.setupEventId === event.id).length;
    const paidHere = promises.filter((p) => p.payoffEventId === event.id).length;
    const parts: string[] = [];
    if (seeded > 0) parts.push(`se perderán ${seeded} promesa(s) sembrada(s) aquí`);
    if (paidHere > 0) parts.push(`${paidHere} promesa(s) pagada(s) aquí volverán a pendiente`);

    Alert.alert(
      'Borrar suceso',
      `¿Borrar "${event.title}"?${parts.length ? ` ${parts.join(' y ')}.` : ''}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Borrar', style: 'destructive', onPress: () => deleteEvent.mutate(event.id) },
      ],
    );
  };

  return (
    <Screen>
      <ScreenScroll
        contentContainerStyle={{ padding: SPACING + 4, paddingBottom: 48, gap: SPACING }}
      >
        <ErrorBanner
          error={
            error ??
            createEvent.error ??
            updateEvent.error ??
            deleteEvent.error ??
            reorderEvents.error ??
            createPromise.error ??
            updatePromise.error ??
            deletePromise.error
          }
        />

        <Section title={`Sucesos — ${events.length}`}>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {events.length > 1 && !order && (
              <Button label="Reordenar" onPress={() => setOrder(events)} />
            )}
            {!order && (
              <Button label="+ Suceso" variant="primary" onPress={() => setEventForm({})} />
            )}
          </View>

          {order && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button label="Cancelar" onPress={() => setOrder(null)} style={{ flex: 1 }} />
              <Button
                label={reorderEvents.isPending ? 'Guardando…' : 'Guardar orden'}
                variant="primary"
                disabled={reorderEvents.isPending}
                onPress={async () => {
                  await reorderEvents.mutateAsync(order.map((e) => e.id));
                  setOrder(null);
                }}
                style={{ flex: 1 }}
              />
            </View>
          )}

          {shown.length === 0 && <EmptyNote>Todavía no hay sucesos en la trama.</EmptyNote>}

          {shown.map((e, i) => {
            const badges = promisesByEvent.get(e.id);
            return (
              <Card key={e.id}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      backgroundColor: t.accentSoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Subtle>{i + 1}</Subtle>
                  </View>
                  <Title>{e.title}</Title>
                </View>

                {e.description && (
                  <View style={{ marginTop: 6 }}>
                    <Prose text={e.description} />
                  </View>
                )}

                {badges && (badges.seeds.length > 0 || badges.payoffs.length > 0) && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                    {badges.seeds.map((p) => (
                      <Badge key={`seed-${p.id}`} label={`siembra: ${p.title}`} tone="accent" />
                    ))}
                    {badges.payoffs.map((p) => (
                      <Badge key={`payoff-${p.id}`} label={`paga: ${p.title}`} tone="ok" />
                    ))}
                  </View>
                )}

                {order ? (
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                    <Button
                      label="↑"
                      variant="ghost"
                      onPress={() => move(i, -1)}
                      disabled={i === 0}
                    />
                    <Button
                      label="↓"
                      variant="ghost"
                      onPress={() => move(i, 1)}
                      disabled={i === shown.length - 1}
                    />
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                    <Button
                      label="Editar"
                      variant="ghost"
                      onPress={() => setEventForm({ event: e })}
                    />
                    <Button label="Borrar" variant="danger" onPress={() => confirmDeleteEvent(e)} />
                  </View>
                )}
              </Card>
            );
          })}
        </Section>

        <Section title={`Promesas — ${pending.length} de ${promises.length} sin pagar`}>
          <Button
            label="+ Promesa"
            variant="primary"
            onPress={() => setPromiseForm({})}
            disabled={events.length === 0}
          />
          {events.length === 0 && (
            <Subtle>Necesitas al menos un suceso para crear una promesa.</Subtle>
          )}

          {promises.length === 0 && <EmptyNote>Sin promesas todavía.</EmptyNote>}

          {[
            { label: 'Pendientes', items: pending },
            { label: 'Cumplidas', items: paid },
          ].map(
            (group) =>
              group.items.length > 0 && (
                <View key={group.label} style={{ gap: 8, marginTop: 8 }}>
                  <Subtle>{group.label}</Subtle>
                  {group.items.map((p) => {
                    // Pagar antes de sembrar es un flashback: se señala, no se prohíbe.
                    const outOfOrder =
                      p.payoffEvent !== null && p.payoffEvent.position < p.setupEvent.position;
                    return (
                      <Card key={p.id}>
                        <Title>{p.title}</Title>
                        <Subtle>
                          Se siembra en #{p.setupEvent.position + 1} · {p.setupEvent.title}
                        </Subtle>
                        {p.description && <Prose text={p.description} />}
                        <View
                          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 }}
                        >
                          {p.payoffEvent ? (
                            <Badge
                              label={`paga en #${p.payoffEvent.position + 1} · ${p.payoffEvent.title}`}
                              tone="ok"
                            />
                          ) : (
                            <Badge label="pendiente" tone="accent" />
                          )}
                          {outOfOrder && <Badge label="se paga antes de sembrarse" />}
                        </View>
                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                          <Button
                            label="Editar"
                            variant="ghost"
                            onPress={() => setPromiseForm({ promise: p })}
                          />
                          <Button
                            label="Borrar"
                            variant="danger"
                            onPress={() =>
                              Alert.alert('Borrar promesa', `¿Borrar "${p.title}"?`, [
                                { text: 'Cancelar', style: 'cancel' },
                                {
                                  text: 'Borrar',
                                  style: 'destructive',
                                  onPress: () => deletePromise.mutate(p.id),
                                },
                              ])
                            }
                          />
                        </View>
                      </Card>
                    );
                  })}
                </View>
              ),
          )}
        </Section>
      </ScreenScroll>

      {eventForm && (
        <EventForm
          event={eventForm.event}
          pending={createEvent.isPending || updateEvent.isPending}
          onClose={() => setEventForm(null)}
          onSubmit={async (values) => {
            if (eventForm.event)
              await updateEvent.mutateAsync({ id: eventForm.event.id, ...values });
            else await createEvent.mutateAsync(values);
            setEventForm(null);
          }}
        />
      )}

      {promiseForm && (
        <PromiseForm
          promise={promiseForm.promise}
          events={events}
          pending={createPromise.isPending || updatePromise.isPending}
          onClose={() => setPromiseForm(null)}
          onSubmit={async (values) => {
            if (promiseForm.promise) {
              await updatePromise.mutateAsync({ id: promiseForm.promise.id, ...values });
            } else {
              await createPromise.mutateAsync(values);
            }
            setPromiseForm(null);
          }}
        />
      )}
    </Screen>
  );
}

function EventForm({
  event,
  pending,
  onClose,
  onSubmit,
}: {
  event?: PlotEvent;
  pending: boolean;
  onClose: () => void;
  onSubmit: (values: { title: string; description: string | null }) => void;
}) {
  const [title, setTitle] = useState(event?.title ?? '');
  const [description, setDescription] = useState(event?.description ?? '');

  return (
    <Sheet
      visible
      title={event ? 'Editar suceso' : 'Nuevo suceso'}
      onClose={onClose}
      footer={
        <>
          <Button label="Cancelar" onPress={onClose} style={{ flex: 1 }} />
          <Button
            label={pending ? 'Guardando…' : 'Guardar'}
            variant="primary"
            disabled={!title.trim() || pending}
            onPress={() =>
              onSubmit({ title: title.trim(), description: description.trim() || null })
            }
            style={{ flex: 1 }}
          />
        </>
      }
    >
      <Field label="Título">
        <Input value={title} onChangeText={setTitle} placeholder="Qué ocurre" autoFocus />
      </Field>
      <Field label="Descripción">
        <Input value={description} onChangeText={setDescription} multiline />
      </Field>
    </Sheet>
  );
}

function PromiseForm({
  promise,
  events,
  pending,
  onClose,
  onSubmit,
}: {
  promise?: PlotPromise;
  events: Plot['events'];
  pending: boolean;
  onClose: () => void;
  onSubmit: (values: {
    title: string;
    description: string | null;
    setupEventId: string;
    payoffEventId: string | null;
  }) => void;
}) {
  const [title, setTitle] = useState(promise?.title ?? '');
  const [description, setDescription] = useState(promise?.description ?? '');
  const [setupEventId, setSetupEventId] = useState(promise?.setupEventId ?? events[0]?.id ?? '');
  const [payoffEventId, setPayoffEventId] = useState(promise?.payoffEventId ?? '');

  const eventOptions = events.map((e) => ({
    value: e.id,
    label: `#${e.position + 1} · ${e.title}`,
  }));

  return (
    <Sheet
      visible
      title={promise ? 'Editar promesa' : 'Nueva promesa'}
      onClose={onClose}
      footer={
        <>
          <Button label="Cancelar" onPress={onClose} style={{ flex: 1 }} />
          <Button
            label={pending ? 'Guardando…' : 'Guardar'}
            variant="primary"
            disabled={!title.trim() || !setupEventId || pending}
            onPress={() =>
              onSubmit({
                title: title.trim(),
                description: description.trim() || null,
                setupEventId,
                // '' significa "pendiente": hay que convertirlo a null.
                payoffEventId: payoffEventId || null,
              })
            }
            style={{ flex: 1 }}
          />
        </>
      }
    >
      <Field label="Título">
        <Input
          value={title}
          onChangeText={setTitle}
          placeholder="Qué se promete al lector"
          autoFocus
        />
      </Field>
      <Field label="Descripción">
        <Input value={description} onChangeText={setDescription} multiline />
      </Field>
      <Field label="Se siembra en">
        <Select
          value={setupEventId}
          options={eventOptions}
          onChange={setSetupEventId}
          placeholder="Elige el suceso…"
        />
      </Field>
      <Field label="Se paga en" hint="Déjalo en «Pendiente» si todavía no se paga">
        <Select
          value={payoffEventId}
          options={[{ value: '', label: '— Pendiente —' }, ...eventOptions]}
          onChange={setPayoffEventId}
          placeholder="— Pendiente —"
        />
      </Field>
    </Sheet>
  );
}
