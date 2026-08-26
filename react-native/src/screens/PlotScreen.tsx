import { useEffect, useMemo, useState } from 'react';
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
import { useT } from '../state/useSettings';
import type { Plot, PlotEvent, PlotPromise } from '../types';

/** Promesa reducida a lo que necesita un badge; el id es la key, no el título
 *  (dos promesas pueden llamarse igual). */
interface PromiseBadge {
  id: string;
  title: string;
}

export function PlotScreen() {
  const t = useTheme();
  const i18n = useT();
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

  // La pantalla no se desmonta al cambiar de libro (las pestañas se quedan
  // montadas), así que un reordenamiento a medias —o un formulario abierto
  // sobre un suceso del libro anterior— sobreviviría al cambio y guardaría
  // contra el libro equivocado. Se descarta todo lo que apunte al libro viejo.
  useEffect(() => {
    setOrder(null);
    setEventForm(null);
    setPromiseForm(null);
  }, [bookId]);

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
        <Placeholder title={i18n.common.noBookTitle} message={i18n.common.noBookMessage} />
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
    if (seeded > 0) parts.push(i18n.plot.seededWillBeLost(seeded));
    if (paidHere > 0) parts.push(i18n.plot.paidWillReturn(paidHere));

    Alert.alert(i18n.plot.confirmDeleteEventTitle, i18n.plot.confirmDeleteEventBody(event.title, parts), [
      { text: i18n.common.cancel, style: 'cancel' },
      { text: i18n.common.delete, style: 'destructive', onPress: () => deleteEvent.mutate(event.id) },
    ]);
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

        <Section title={i18n.plot.eventsSectionTitle(events.length)}>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {events.length > 1 && !order && (
              <Button label={i18n.plot.reorder} onPress={() => setOrder(events)} />
            )}
            {!order && (
              <Button label={i18n.plot.newEvent} variant="primary" onPress={() => setEventForm({})} />
            )}
          </View>

          {order && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button label={i18n.common.cancel} onPress={() => setOrder(null)} style={{ flex: 1 }} />
              <Button
                label={reorderEvents.isPending ? i18n.common.saving : i18n.plot.saveOrder}
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

          {shown.length === 0 && <EmptyNote>{i18n.plot.eventsEmpty}</EmptyNote>}

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
                      <Badge key={`seed-${p.id}`} label={i18n.plot.seedBadge(p.title)} tone="accent" />
                    ))}
                    {badges.payoffs.map((p) => (
                      <Badge key={`payoff-${p.id}`} label={i18n.plot.payoffBadge(p.title)} tone="ok" />
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
                      label={i18n.common.edit}
                      variant="ghost"
                      onPress={() => setEventForm({ event: e })}
                    />
                    <Button label={i18n.common.delete} variant="danger" onPress={() => confirmDeleteEvent(e)} />
                  </View>
                )}
              </Card>
            );
          })}
        </Section>

        <Section title={i18n.plot.promisesSectionTitle(pending.length, promises.length)}>
          <Button
            label={i18n.plot.newPromise}
            variant="primary"
            onPress={() => setPromiseForm({})}
            disabled={events.length === 0}
          />
          {events.length === 0 && <Subtle>{i18n.plot.needsAnEvent}</Subtle>}

          {promises.length === 0 && <EmptyNote>{i18n.plot.promisesEmpty}</EmptyNote>}

          {[
            { id: 'pending', label: i18n.plot.pendingGroup, items: pending },
            { id: 'fulfilled', label: i18n.plot.fulfilledGroup, items: paid },
          ].map(
            (group) =>
              group.items.length > 0 && (
                <View key={group.id} style={{ gap: 8, marginTop: 8 }}>
                  <Subtle>{group.label}</Subtle>
                  {group.items.map((p) => {
                    // Pagar antes de sembrar es un flashback: se señala, no se prohíbe.
                    const outOfOrder =
                      p.payoffEvent !== null && p.payoffEvent.position < p.setupEvent.position;
                    return (
                      <Card key={p.id}>
                        <Title>{p.title}</Title>
                        <Subtle>{i18n.plot.seededAt(p.setupEvent.position + 1, p.setupEvent.title)}</Subtle>
                        {p.description && <Prose text={p.description} />}
                        <View
                          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 }}
                        >
                          {p.payoffEvent ? (
                            <Badge
                              label={i18n.plot.paidAt(p.payoffEvent.position + 1, p.payoffEvent.title)}
                              tone="ok"
                            />
                          ) : (
                            <Badge label={i18n.plot.pendingBadge} tone="accent" />
                          )}
                          {outOfOrder && <Badge label={i18n.plot.outOfOrderBadge} />}
                        </View>
                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                          <Button
                            label={i18n.common.edit}
                            variant="ghost"
                            onPress={() => setPromiseForm({ promise: p })}
                          />
                          <Button
                            label={i18n.common.delete}
                            variant="danger"
                            onPress={() =>
                              Alert.alert(
                                i18n.plot.confirmDeletePromiseTitle,
                                i18n.plot.confirmDeletePromiseBody(p.title),
                                [
                                  { text: i18n.common.cancel, style: 'cancel' },
                                  {
                                    text: i18n.common.delete,
                                    style: 'destructive',
                                    onPress: () => deletePromise.mutate(p.id),
                                  },
                                ],
                              )
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
  const i18n = useT();
  const [title, setTitle] = useState(event?.title ?? '');
  const [description, setDescription] = useState(event?.description ?? '');

  return (
    <Sheet
      visible
      title={event ? i18n.plot.editEventTitle : i18n.plot.newEventTitle}
      onClose={onClose}
      footer={
        <>
          <Button label={i18n.common.cancel} onPress={onClose} style={{ flex: 1 }} />
          <Button
            label={pending ? i18n.common.saving : i18n.common.save}
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
      <Field label={i18n.plot.fieldEventTitle}>
        <Input value={title} onChangeText={setTitle} placeholder={i18n.plot.eventTitlePlaceholder} autoFocus />
      </Field>
      <Field label={i18n.plot.fieldDescription}>
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
  const i18n = useT();
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
      title={promise ? i18n.plot.editPromiseTitle : i18n.plot.newPromiseTitle}
      onClose={onClose}
      footer={
        <>
          <Button label={i18n.common.cancel} onPress={onClose} style={{ flex: 1 }} />
          <Button
            label={pending ? i18n.common.saving : i18n.common.save}
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
      <Field label={i18n.plot.fieldPromiseTitle}>
        <Input
          value={title}
          onChangeText={setTitle}
          placeholder={i18n.plot.promiseTitlePlaceholder}
          autoFocus
        />
      </Field>
      <Field label={i18n.plot.fieldDescription}>
        <Input value={description} onChangeText={setDescription} multiline />
      </Field>
      <Field label={i18n.plot.fieldSetupEvent}>
        <Select
          value={setupEventId}
          options={eventOptions}
          onChange={setSetupEventId}
          placeholder={i18n.plot.setupEventPlaceholder}
        />
      </Field>
      <Field label={i18n.plot.fieldPayoffEvent} hint={i18n.plot.payoffEventHint}>
        <Select
          value={payoffEventId}
          options={[{ value: '', label: i18n.plot.payoffPendingOption }, ...eventOptions]}
          onChange={setPayoffEventId}
          placeholder={i18n.plot.payoffPendingOption}
        />
      </Field>
    </Sheet>
  );
}
