import { useState } from 'react';
import { FlatList, View } from 'react-native';
import {
  Avatar,
  Button,
  Card,
  EmptyNote,
  ErrorBanner,
  Field,
  Input,
  Placeholder,
  RoleBadge,
  Screen,
  Sheet,
  Spinner,
  Subtle,
  Title,
  Choice,
} from '../ui/components';
import { SPACING } from '../ui/theme';
import { useCharacters, useCreateCharacter } from '../data/hooks';
import { useActiveBook } from '../state/useActiveBook';
import type { CharactersListProps } from '../navigation';
import { CHARACTER_ROLES, ROLE_LABELS, type CharacterRole } from '../types';

const ROLE_OPTIONS = CHARACTER_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }));

export function CharactersScreen({ navigation }: CharactersListProps) {
  const { bookId } = useActiveBook();
  const { data: characters, isLoading, error } = useCharacters(bookId);
  const create = useCreateCharacter(bookId);

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState<CharacterRole>('SECONDARY');

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

  const list = characters ?? [];

  const submit = async () => {
    const character = await create.mutateAsync({ name: name.trim(), role });
    setCreating(false);
    setName('');
    setRole('SECONDARY');
    navigation.navigate('CharacterDetail', { characterId: character.id });
  };

  return (
    <Screen>
      <FlatList
        data={list}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: SPACING + 4, gap: SPACING, paddingBottom: 40 }}
        ListHeaderComponent={
          <View style={{ gap: SPACING }}>
            <ErrorBanner error={error ?? create.error} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Subtle>{list.length === 1 ? '1 personaje' : `${list.length} personajes`}</Subtle>
              <View style={{ flex: 1 }} />
              <Button label="+ Personaje" variant="primary" onPress={() => setCreating(true)} />
            </View>
          </View>
        }
        ListEmptyComponent={<EmptyNote>Todavía no hay personajes en este libro.</EmptyNote>}
        renderItem={({ item }) => (
          <Card onPress={() => navigation.navigate('CharacterDetail', { characterId: item.id })}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING }}>
              <Avatar name={item.name} />
              <View style={{ flex: 1, gap: 4 }}>
                <Title>{item.name}</Title>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <RoleBadge role={item.role} />
                  {item.age && <Subtle>{item.age}</Subtle>}
                </View>
                {item.arcSummary && <Subtle>{item.arcSummary}</Subtle>}
              </View>
            </View>
          </Card>
        )}
      />

      <Sheet
        visible={creating}
        title="Nuevo personaje"
        onClose={() => setCreating(false)}
        footer={
          <>
            <Button label="Cancelar" onPress={() => setCreating(false)} style={{ flex: 1 }} />
            <Button
              label={create.isPending ? 'Creando…' : 'Crear'}
              variant="primary"
              disabled={!name.trim() || create.isPending}
              onPress={submit}
              style={{ flex: 1 }}
            />
          </>
        }
      >
        {/* Sólo el nombre es obligatorio: hay que poder esbozar un personaje y
            rellenar su ficha más tarde. */}
        <Field label="Nombre">
          <Input value={name} onChangeText={setName} placeholder="Cómo se llama" autoFocus />
        </Field>
        <Field label="Rol">
          <Choice value={role} options={ROLE_OPTIONS} onChange={setRole} />
        </Field>
      </Sheet>
    </Screen>
  );
}
