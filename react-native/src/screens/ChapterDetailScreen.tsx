import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import {
  Avatar,
  Badge,
  Button,
  Choice,
  EmptyNote,
  ErrorBanner,
  Field,
  Input,
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
import { SPACING } from '../ui/theme';
import {
  useChapter,
  useCharacters,
  useDeleteChapter,
  useSaveCast,
  useUpdateChapter,
} from '../data/hooks';
import { useActiveBook } from '../state/useActiveBook';
import { UnsavedChangesGuard, useReportUnsaved } from '../lib/unsavedChanges';
import type { ChapterDetailProps } from '../navigation';
import type { Chapter, ChapterPatch, CharacterSummary } from '../types';

const wordCount = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);

interface Draft {
  textALabel: string;
  textA: string;
  textBLabel: string;
  textB: string;
}

const fromChapter = (c: Chapter): Draft => ({
  textALabel: c.textALabel,
  textA: c.textA ?? '',
  textBLabel: c.textBLabel,
  textB: c.textB ?? '',
});

/**
 * Los dos paneles de texto. En el móvil no caben lado a lado, así que se
 * alterna con un selector; los dos borradores viven en el estado, no en el
 * DOM, así que cambiar de panel no pierde nada sin guardar.
 *
 * Guardado explícito: el update lleva SÓLO los campos que cambiaron. Mandar el
 * capítulo entero pisaría el otro panel con una copia obsoleta.
 */
function ChapterTextPanels({ chapter, bookId }: { chapter: Chapter; bookId: string | null }) {
  const update = useUpdateChapter(bookId);
  const [draft, setDraft] = useState<Draft>(() => fromChapter(chapter));
  const [shown, setShown] = useState<'A' | 'B'>('A');

  // Depende de chapter.id, NUNCA del objeto entero: éste cambia de identidad
  // en cada recarga de caché y borraría lo que se está escribiendo.
  useEffect(() => {
    setDraft(fromChapter(chapter));
  }, [chapter.id]);

  // Contra los datos guardados, no contra una foto tomada al montar: así, tras
  // guardar, `dirty` pasa a false solo.
  const dirty =
    draft.textA !== (chapter.textA ?? '') ||
    draft.textB !== (chapter.textB ?? '') ||
    draft.textALabel !== chapter.textALabel ||
    draft.textBLabel !== chapter.textBLabel;

  useReportUnsaved(dirty);

  const save = async () => {
    const patch: ChapterPatch = {};
    if (draft.textALabel !== chapter.textALabel) patch.textALabel = draft.textALabel;
    if (draft.textBLabel !== chapter.textBLabel) patch.textBLabel = draft.textBLabel;
    if (draft.textA !== (chapter.textA ?? '')) patch.textA = draft.textA;
    if (draft.textB !== (chapter.textB ?? '')) patch.textB = draft.textB;
    if (Object.keys(patch).length === 0) return;
    await update.mutateAsync({ id: chapter.id, ...patch });
  };

  const isA = shown === 'A';
  const label = isA ? draft.textALabel : draft.textBLabel;
  const value = isA ? draft.textA : draft.textB;

  return (
    <>
      <ErrorBanner error={update.error} />

      <Choice
        value={shown}
        options={[
          { value: 'A', label: draft.textALabel || 'A' },
          { value: 'B', label: draft.textBLabel || 'B' },
        ]}
        onChange={(v) => setShown(v as 'A' | 'B')}
      />

      <Field label="Rótulo del panel">
        <Input
          value={label}
          onChangeText={(v) => setDraft((d) => ({ ...d, [isA ? 'textALabel' : 'textBLabel']: v }))}
        />
      </Field>

      <Input
        value={value}
        onChangeText={(v) => setDraft((d) => ({ ...d, [isA ? 'textA' : 'textB']: v }))}
        multiline
        placeholder="Escribe aquí el capítulo…"
        style={{ minHeight: 260 }}
      />
      <Subtle>{wordCount(value)} palabras</Subtle>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {dirty && <Badge label="Cambios sin guardar" tone="accent" />}
        <View style={{ flex: 1 }} />
        <Button
          label={update.isPending ? 'Guardando…' : 'Guardar texto'}
          variant="primary"
          onPress={save}
          disabled={!dirty || update.isPending}
        />
      </View>
    </>
  );
}

/** Quién sale en el capítulo y qué hace. Se reemplaza la lista entera. */
function ChapterCastEditor({
  chapter,
  candidates,
  bookId,
}: {
  chapter: Chapter;
  candidates: CharacterSummary[];
  bookId: string | null;
}) {
  const save = useSaveCast(bookId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<{ characterId: string; action: string }[]>([]);

  useEffect(() => {
    setEditing(false);
  }, [chapter.id]);

  const byId = new Map(candidates.map((c) => [c.id, c]));
  const available = candidates.filter((c) => !draft.some((e) => e.characterId === c.id));

  const start = () => {
    setDraft(chapter.cast.map((e) => ({ characterId: e.characterId, action: e.action ?? '' })));
    setEditing(true);
  };

  const submit = async () => {
    await save.mutateAsync({
      id: chapter.id,
      cast: draft.map((e) => ({ characterId: e.characterId, action: e.action.trim() || null })),
    });
    setEditing(false);
  };

  // Contra los datos guardados, no contra "estoy en modo edición": entrar a
  // editar sin tocar nada no debe bloquear la salida.
  const original = chapter.cast.map((e) => ({
    characterId: e.characterId,
    action: e.action ?? '',
  }));
  useReportUnsaved(editing && JSON.stringify(draft) !== JSON.stringify(original));

  if (!editing) {
    return (
      <>
        {chapter.cast.length === 0 ? (
          <EmptyNote>Nadie asignado. Añade quién sale y qué hace.</EmptyNote>
        ) : (
          chapter.cast.map((entry) => (
            <View
              key={entry.id}
              style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}
            >
              <Avatar name={entry.character.name} size={34} />
              <View style={{ flex: 1 }}>
                <Title>{entry.character.name}</Title>
                <Prose text={entry.action} />
              </View>
            </View>
          ))
        )}
        <Button label={chapter.cast.length ? 'Editar reparto' : 'Añadir reparto'} onPress={start} />
      </>
    );
  }

  return (
    <>
      <ErrorBanner error={save.error} />
      {draft.map((entry, i) => (
        <View key={entry.characterId} style={{ gap: 6, paddingBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Avatar name={byId.get(entry.characterId)?.name ?? '?'} size={28} />
            <Title>{byId.get(entry.characterId)?.name ?? 'Personaje'}</Title>
            <View style={{ flex: 1 }} />
            <Button
              label="Quitar"
              variant="danger"
              onPress={() => setDraft((d) => d.filter((_, j) => j !== i))}
            />
          </View>
          <Input
            value={entry.action}
            onChangeText={(v) =>
              setDraft((d) => d.map((e, j) => (i === j ? { ...e, action: v } : e)))
            }
            placeholder="Qué hace en este capítulo"
            multiline
          />
        </View>
      ))}

      {/* El selector excluye a quien ya está: así no se llega siquiera al error
          de "un personaje no puede aparecer dos veces". */}
      {available.length > 0 && (
        <Field label="Añadir personaje">
          <Select
            value=""
            options={available.map((c) => ({ value: c.id, label: c.name }))}
            onChange={(id) => setDraft((d) => [...d, { characterId: id, action: '' }])}
            placeholder="+ Añadir personaje…"
          />
        </Field>
      )}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button
          label="Cancelar"
          onPress={() => setEditing(false)}
          disabled={save.isPending}
          style={{ flex: 1 }}
        />
        <Button
          label={save.isPending ? 'Guardando…' : 'Guardar reparto'}
          variant="primary"
          onPress={submit}
          disabled={save.isPending}
          style={{ flex: 1 }}
        />
      </View>
    </>
  );
}

export function ChapterDetailScreen({ route, navigation }: ChapterDetailProps) {
  const { chapterId } = route.params;
  const { bookId } = useActiveBook();
  const { data: chapter, isLoading, error } = useChapter(chapterId);
  const { data: characters } = useCharacters(bookId);
  const update = useUpdateChapter(bookId);
  const remove = useDeleteChapter(bookId);
  const [editing, setEditing] = useState(false);

  // Si el capítulo desaparece bajo los pies —normalmente porque se borró el
  // libro entero desde otra pestaña y la cascada se lo llevó— esta pantalla se
  // quedaría en un callejón sin salida. `null` es "consultado y no existe";
  // `undefined` es "todavía cargando", que no debe disparar nada.
  useEffect(() => {
    if (chapter === null && navigation.canGoBack()) navigation.goBack();
  }, [chapter, navigation]);

  if (isLoading)
    return (
      <Screen>
        <Spinner />
      </Screen>
    );
  if (error)
    return (
      <Screen>
        <ErrorBanner error={error} />
      </Screen>
    );
  if (!chapter)
    return (
      <Screen>
        <EmptyNote>Capítulo no encontrado.</EmptyNote>
      </Screen>
    );

  const confirmDelete = () =>
    Alert.alert(
      'Borrar capítulo',
      `¿Borrar "${chapter.title}"? Se perderán su texto y su reparto.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: async () => {
            await remove.mutateAsync(chapter.id);
            navigation.goBack();
          },
        },
      ],
    );

  return (
    <UnsavedChangesGuard message="Hay cambios sin guardar en este capítulo. Si sales ahora se perderán.">
      <Screen>
        <ScreenScroll contentContainerStyle={{ padding: SPACING + 4, paddingBottom: 48 }}>
          <Subtle>Capítulo {chapter.position + 1}</Subtle>
          <Title>{chapter.title}</Title>

          <View style={{ flexDirection: 'row', gap: 8, marginVertical: SPACING }}>
            <Button label="Editar" onPress={() => setEditing(true)} style={{ flex: 1 }} />
            <Button label="Borrar" variant="danger" onPress={confirmDelete} style={{ flex: 1 }} />
          </View>

          <Section title="Sinopsis" filled={!!chapter.synopsis}>
            <Prose text={chapter.synopsis} />
          </Section>
          <Section title="Reparto" filled={chapter.cast.length > 0}>
            <ChapterCastEditor chapter={chapter} candidates={characters ?? []} bookId={bookId} />
          </Section>
          <Section title="Texto" filled={!!chapter.textA || !!chapter.textB}>
            <ChapterTextPanels chapter={chapter} bookId={bookId} />
          </Section>
          <Section title="Notas" filled={!!chapter.notes} defaultOpen={false}>
            <Prose text={chapter.notes} />
          </Section>
        </ScreenScroll>

        {editing && (
          <ChapterForm
            chapter={chapter}
            pending={update.isPending}
            onClose={() => setEditing(false)}
            onSubmit={async (values) => {
              await update.mutateAsync({ id: chapter.id, ...values });
              setEditing(false);
            }}
          />
        )}
      </Screen>
    </UnsavedChangesGuard>
  );
}

function ChapterForm({
  chapter,
  pending,
  onClose,
  onSubmit,
}: {
  chapter: Chapter;
  pending: boolean;
  onClose: () => void;
  onSubmit: (values: ChapterPatch) => void;
}) {
  const [title, setTitle] = useState(chapter.title);
  const [synopsis, setSynopsis] = useState(chapter.synopsis ?? '');
  const [notes, setNotes] = useState(chapter.notes ?? '');

  return (
    <Sheet
      visible
      title="Editar capítulo"
      onClose={onClose}
      footer={
        <>
          <Button label="Cancelar" onPress={onClose} style={{ flex: 1 }} />
          <Button
            label={pending ? 'Guardando…' : 'Guardar'}
            variant="primary"
            disabled={!title.trim() || pending}
            onPress={() =>
              onSubmit({
                title: title.trim(),
                synopsis: synopsis.trim() || null,
                notes: notes.trim() || null,
              })
            }
            style={{ flex: 1 }}
          />
        </>
      }
    >
      <Field label="Título">
        <Input value={title} onChangeText={setTitle} />
      </Field>
      <Field label="Sinopsis" hint="Qué ocurre en el capítulo">
        <Input value={synopsis} onChangeText={setSynopsis} multiline />
      </Field>
      <Field label="Notas">
        <Input value={notes} onChangeText={setNotes} multiline />
      </Field>
    </Sheet>
  );
}
