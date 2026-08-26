import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import {
  Avatar,
  Button,
  Choice,
  EmptyNote,
  ErrorBanner,
  Field,
  Input,
  Prose,
  RoleBadge,
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
  useAddRelationship,
  useCharacter,
  useCharacters,
  useDeleteCharacter,
  useDeleteRelationship,
  useSaveArc,
  useUpdateCharacter,
} from '../data/hooks';
import { UnsavedChangesGuard, useReportUnsaved } from '../lib/unsavedChanges';
import { useT } from '../state/useSettings';
import type { CharacterDetailProps } from '../navigation';
import { CHARACTER_ROLES, type Character, type CharacterRole } from '../types';

interface Stage {
  title: string;
  description: string;
}

/**
 * Edita el arco como lista ordenada y lo guarda entero de una vez. La
 * `position` sale del orden del array, así que reordenar es mover elementos y
 * guardar.
 */
function ArcEditor({ character, bookId }: { character: Character; bookId: string | null }) {
  const t = useTheme();
  const i18n = useT();
  const save = useSaveArc(bookId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Stage[]>([]);

  // Al cambiar de personaje hay que descartar el borrador del anterior.
  useEffect(() => {
    setEditing(false);
  }, [character.id]);

  const start = () => {
    setDraft(
      character.arcStages.map((s) => ({ title: s.title, description: s.description ?? '' })),
    );
    setEditing(true);
  };

  const update = (i: number, patch: Partial<Stage>) =>
    setDraft((d) => d.map((s, j) => (i === j ? { ...s, ...patch } : s)));

  const move = (i: number, delta: number) =>
    setDraft((d) => {
      const j = i + delta;
      if (j < 0 || j >= d.length) return d;
      const next = [...d];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const submit = async () => {
    await save.mutateAsync({
      id: character.id,
      stages: draft
        .filter((s) => s.title.trim())
        .map((s) => ({ title: s.title.trim(), description: s.description.trim() || null })),
    });
    setEditing(false);
  };

  // Contra los datos guardados, no contra "estoy en modo edición": entrar a
  // editar sin tocar nada no debe bloquear la salida.
  const original: Stage[] = character.arcStages.map((s) => ({
    title: s.title,
    description: s.description ?? '',
  }));
  useReportUnsaved(editing && JSON.stringify(draft) !== JSON.stringify(original));

  if (!editing) {
    return (
      <>
        {character.arcStages.length === 0 ? (
          <EmptyNote>{i18n.characterDetail.arcEmpty}</EmptyNote>
        ) : (
          character.arcStages.map((s, i) => (
            <View key={s.id} style={{ flexDirection: 'row', gap: 10 }}>
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: t.accentSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Subtle>{i + 1}</Subtle>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Title>{s.title}</Title>
                {s.description && <Prose text={s.description} />}
              </View>
            </View>
          ))
        )}
        <Button
          label={character.arcStages.length ? i18n.characterDetail.editArc : i18n.characterDetail.addStages}
          onPress={start}
        />
      </>
    );
  }

  return (
    <>
      <ErrorBanner error={save.error} />
      {draft.map((s, i) => (
        <View key={i} style={{ gap: 6, paddingBottom: 8 }}>
          <Input
            value={s.title}
            onChangeText={(v) => update(i, { title: v })}
            placeholder={i18n.characterDetail.stageTitlePlaceholder}
          />
          <Input
            value={s.description}
            onChangeText={(v) => update(i, { description: v })}
            placeholder={i18n.characterDetail.stageDescriptionPlaceholder}
            multiline
          />
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Button label="↑" variant="ghost" onPress={() => move(i, -1)} disabled={i === 0} />
            <Button
              label="↓"
              variant="ghost"
              onPress={() => move(i, 1)}
              disabled={i === draft.length - 1}
            />
            <View style={{ flex: 1 }} />
            <Button
              label={i18n.characterDetail.removeStage}
              variant="danger"
              onPress={() => setDraft((d) => d.filter((_, j) => j !== i))}
            />
          </View>
        </View>
      ))}

      <Button
        label={i18n.characterDetail.addStage}
        onPress={() => setDraft((d) => [...d, { title: '', description: '' }])}
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button
          label={i18n.common.cancel}
          onPress={() => setEditing(false)}
          disabled={save.isPending}
          style={{ flex: 1 }}
        />
        <Button
          label={save.isPending ? i18n.common.saving : i18n.characterDetail.saveArc}
          variant="primary"
          onPress={submit}
          disabled={save.isPending}
          style={{ flex: 1 }}
        />
      </View>
    </>
  );
}

/**
 * Las relaciones son dirigidas: A puede ver a B como "mentor" mientras B ve a
 * A como "estorbo". La inversa sólo se crea si se marca la casilla, y con su
 * propio texto ("hermano" desde un lado, "hermana" desde el otro).
 */
function RelationshipEditor({
  character,
  bookId,
  onOpenCharacter,
}: {
  character: Character;
  bookId: string | null;
  onOpenCharacter: (id: string) => void;
}) {
  const i18n = useT();
  const { data: candidates } = useCharacters(bookId);
  const add = useAddRelationship(bookId);
  const remove = useDeleteRelationship(bookId, character.id);

  const [adding, setAdding] = useState(false);
  const [relatedId, setRelatedId] = useState('');
  const [type, setType] = useState('');
  const [reciprocalType, setReciprocalType] = useState('');

  const options = (candidates ?? []).filter((c) => c.id !== character.id);
  const relatedName = options.find((c) => c.id === relatedId)?.name;

  const submit = async () => {
    await add.mutateAsync({
      id: character.id,
      relatedCharacterId: relatedId,
      type: type.trim(),
      reciprocalType: reciprocalType.trim() || null,
    });
    setAdding(false);
    setRelatedId('');
    setType('');
    setReciprocalType('');
  };

  return (
    <>
      {character.relationships.length === 0 && <EmptyNote>{i18n.characterDetail.relationshipsEmpty}</EmptyNote>}

      {character.relationships.map((r) => (
        <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Avatar name={r.relatedCharacter.name} size={34} />
          <View style={{ flex: 1 }}>
            <Subtle>{r.type}</Subtle>
            <Button
              label={r.relatedCharacter.name}
              variant="ghost"
              onPress={() => onOpenCharacter(r.relatedCharacter.id)}
              style={{ alignSelf: 'flex-start', paddingHorizontal: 0, paddingVertical: 2 }}
            />
            {r.description && <Prose text={r.description} />}
          </View>
          <Button label="✕" variant="danger" onPress={() => remove.mutate(r.id)} />
        </View>
      ))}

      <ErrorBanner error={add.error ?? remove.error} />

      <Button
        label={i18n.characterDetail.addRelationship}
        onPress={() => setAdding(true)}
        disabled={options.length === 0}
      />
      {options.length === 0 && <Subtle>{i18n.characterDetail.needsAnotherCharacter}</Subtle>}

      <Sheet
        visible={adding}
        title={i18n.characterDetail.newRelationshipTitle}
        onClose={() => setAdding(false)}
        footer={
          <>
            <Button label={i18n.common.cancel} onPress={() => setAdding(false)} style={{ flex: 1 }} />
            <Button
              label={add.isPending ? i18n.characterDetail.adding : i18n.characterDetail.add}
              variant="primary"
              disabled={!relatedId || !type.trim() || add.isPending}
              onPress={submit}
              style={{ flex: 1 }}
            />
          </>
        }
      >
        <Field label={i18n.characterDetail.fieldRelatedCharacter}>
          <Select
            value={relatedId}
            options={options.map((c) => ({ value: c.id, label: c.name }))}
            onChange={setRelatedId}
            placeholder={i18n.characterDetail.relatedCharacterPlaceholder}
          />
        </Field>
        <Field label={i18n.characterDetail.fieldRelationType}>
          <Input value={type} onChangeText={setType} placeholder={i18n.characterDetail.relationTypePlaceholder} />
        </Field>
        <Field
          label={i18n.characterDetail.reciprocalLabel(relatedName)}
          hint={i18n.characterDetail.reciprocalHint}
        >
          <Input
            value={reciprocalType}
            onChangeText={setReciprocalType}
            placeholder={i18n.characterDetail.reciprocalPlaceholder}
          />
        </Field>
      </Sheet>
    </>
  );
}

export function CharacterDetailScreen({ route, navigation }: CharacterDetailProps) {
  const i18n = useT();
  const { characterId } = route.params;
  const { data: character, isLoading, error } = useCharacter(characterId);
  // El libro sale del PROPIO personaje, no del libro activo. La ficha no se
  // desmonta al cambiar de libro desde la pestaña Libros: con el libro activo,
  // el selector de relaciones pasaría a ofrecer los personajes del libro nuevo
  // y guardar fallaría con "Los dos personajes deben pertenecer al mismo
  // libro". `null` mientras carga; los hooks ya lo contemplan.
  const bookId = character?.bookId ?? null;
  const update = useUpdateCharacter(bookId);
  const remove = useDeleteCharacter(bookId);
  const [editing, setEditing] = useState(false);

  // Si el personaje desaparece bajo los pies —normalmente porque se borró el
  // libro entero desde otra pestaña y la cascada se lo llevó— esta pantalla se
  // quedaría en un callejón sin salida ("no encontrado" y a volver a mano).
  // `null` es "consultado y no existe"; `undefined` es "todavía cargando", que
  // no debe disparar nada.
  useEffect(() => {
    if (character === null && navigation.canGoBack()) navigation.goBack();
  }, [character, navigation]);

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
  if (!character)
    return (
      <Screen>
        <EmptyNote>{i18n.characterDetail.notFound}</EmptyNote>
      </Screen>
    );

  const confirmDelete = () =>
    Alert.alert(i18n.characterDetail.confirmDeleteTitle, i18n.characterDetail.confirmDeleteBody(character.name), [
      { text: i18n.common.cancel, style: 'cancel' },
      {
        text: i18n.common.delete,
        style: 'destructive',
        onPress: async () => {
          await remove.mutateAsync(character.id);
          navigation.goBack();
        },
      },
    ]);

  return (
    <UnsavedChangesGuard message={i18n.characterDetail.unsavedMessage}>
      <Screen>
        <ScreenScroll contentContainerStyle={{ padding: SPACING + 4, paddingBottom: 48 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: SPACING,
              marginBottom: SPACING,
            }}
          >
            <Avatar name={character.name} size={64} />
            <View style={{ flex: 1, gap: 6 }}>
              <Title>{character.name}</Title>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <RoleBadge role={character.role} />
                {character.age && <Subtle>{character.age}</Subtle>}
              </View>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 8, marginBottom: SPACING }}>
            <Button label={i18n.common.edit} onPress={() => setEditing(true)} style={{ flex: 1 }} />
            <Button label={i18n.common.delete} variant="danger" onPress={confirmDelete} style={{ flex: 1 }} />
          </View>

          <Section title={i18n.characterDetail.sectionPhysical} filled={!!character.physicalDescription}>
            <Prose text={character.physicalDescription} />
          </Section>
          <Section title={i18n.characterDetail.sectionPersonality} filled={!!character.personality}>
            <Prose text={character.personality} />
          </Section>
          <Section title={i18n.characterDetail.sectionBackstory} filled={!!character.backstory}>
            <Prose text={character.backstory} />
          </Section>
          {/* La trama personal es lo que le OCURRE; el arco es cómo CAMBIA por
            dentro. Son campos distintos a propósito. */}
          <Section title={i18n.characterDetail.sectionPersonalPlot} filled={!!character.personalPlot}>
            <Prose text={character.personalPlot} />
          </Section>
          <Section title={i18n.characterDetail.sectionArc} filled={!!character.arcSummary || character.arcStages.length > 0}>
            {character.arcSummary && <Prose text={character.arcSummary} />}
            <ArcEditor character={character} bookId={bookId} />
          </Section>
          <Section title={i18n.characterDetail.sectionRelationships} filled={character.relationships.length > 0}>
            <RelationshipEditor
              character={character}
              bookId={bookId}
              onOpenCharacter={(id) => navigation.push('CharacterDetail', { characterId: id })}
            />
          </Section>
          <Section title={i18n.characterDetail.sectionNotes} filled={!!character.notes} defaultOpen={false}>
            <Prose text={character.notes} />
          </Section>
        </ScreenScroll>

        {editing && (
          <CharacterForm
            character={character}
            pending={update.isPending}
            onClose={() => setEditing(false)}
            onSubmit={async (values) => {
              await update.mutateAsync({ id: character.id, ...values });
              setEditing(false);
            }}
          />
        )}
      </Screen>
    </UnsavedChangesGuard>
  );
}

function CharacterForm({
  character,
  pending,
  onClose,
  onSubmit,
}: {
  character: Character;
  pending: boolean;
  onClose: () => void;
  onSubmit: (values: Record<string, string | null>) => void;
}) {
  const i18n = useT();
  const roleOptions = CHARACTER_ROLES.map((r) => ({ value: r, label: i18n.roles[r] }));
  const [values, setValues] = useState({
    name: character.name,
    role: character.role,
    age: character.age ?? '',
    physicalDescription: character.physicalDescription ?? '',
    personality: character.personality ?? '',
    backstory: character.backstory ?? '',
    personalPlot: character.personalPlot ?? '',
    arcSummary: character.arcSummary ?? '',
    notes: character.notes ?? '',
  });

  const set = (key: keyof typeof values, v: string) => setValues((s) => ({ ...s, [key]: v }));

  return (
    <Sheet
      visible
      title={i18n.characterDetail.editTitle}
      onClose={onClose}
      footer={
        <>
          <Button label={i18n.common.cancel} onPress={onClose} style={{ flex: 1 }} />
          <Button
            label={pending ? i18n.common.saving : i18n.common.save}
            variant="primary"
            disabled={!values.name.trim() || pending}
            onPress={() =>
              onSubmit({
                name: values.name.trim(),
                role: values.role,
                age: values.age.trim() || null,
                physicalDescription: values.physicalDescription.trim() || null,
                personality: values.personality.trim() || null,
                backstory: values.backstory.trim() || null,
                personalPlot: values.personalPlot.trim() || null,
                arcSummary: values.arcSummary.trim() || null,
                notes: values.notes.trim() || null,
              })
            }
            style={{ flex: 1 }}
          />
        </>
      }
    >
      <Field label={i18n.characters.fieldName}>
        <Input value={values.name} onChangeText={(v) => set('name', v)} />
      </Field>
      <Field label={i18n.characters.fieldRole}>
        <Choice
          value={values.role}
          options={roleOptions}
          onChange={(v: CharacterRole) => set('role', v)}
        />
      </Field>
      {/* Texto libre a propósito: admite "unos cuarenta" o "inmortal". */}
      <Field label={i18n.characterDetail.fieldAge}>
        <Input value={values.age} onChangeText={(v) => set('age', v)} placeholder={i18n.characterDetail.agePlaceholder} />
      </Field>
      <Field label={i18n.characterDetail.fieldPhysical}>
        <Input
          value={values.physicalDescription}
          onChangeText={(v) => set('physicalDescription', v)}
          multiline
        />
      </Field>
      <Field label={i18n.characterDetail.fieldPersonality}>
        <Input value={values.personality} onChangeText={(v) => set('personality', v)} multiline />
      </Field>
      <Field label={i18n.characterDetail.fieldBackstory} hint={i18n.characterDetail.backstoryHint}>
        <Input value={values.backstory} onChangeText={(v) => set('backstory', v)} multiline />
      </Field>
      <Field label={i18n.characterDetail.fieldPersonalPlot} hint={i18n.characterDetail.personalPlotHint}>
        <Input value={values.personalPlot} onChangeText={(v) => set('personalPlot', v)} multiline />
      </Field>
      <Field label={i18n.characterDetail.fieldArcSummary} hint={i18n.characterDetail.arcSummaryHint}>
        <Input value={values.arcSummary} onChangeText={(v) => set('arcSummary', v)} multiline />
      </Field>
      <Field label={i18n.characterDetail.fieldNotes}>
        <Input value={values.notes} onChangeText={(v) => set('notes', v)} multiline />
      </Field>
    </Sheet>
  );
}
