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
import { useT } from '../state/useSettings';
import type { CharactersListProps } from '../navigation';
import { CHARACTER_ROLES, type CharacterRole } from '../types';

export function CharactersScreen({ navigation }: CharactersListProps) {
  const i18n = useT();
  const { bookId } = useActiveBook();
  const { data: characters, isLoading, error } = useCharacters(bookId);
  const create = useCreateCharacter(bookId);
  const roleOptions = CHARACTER_ROLES.map((r) => ({ value: r, label: i18n.roles[r] }));

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState<CharacterRole>('SECONDARY');

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
              <Subtle>{i18n.characters.count(list.length)}</Subtle>
              <View style={{ flex: 1 }} />
              <Button
                label={i18n.characters.newCharacter}
                variant="primary"
                onPress={() => setCreating(true)}
              />
            </View>
          </View>
        }
        ListEmptyComponent={<EmptyNote>{i18n.characters.empty}</EmptyNote>}
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
        title={i18n.characters.newSheetTitle}
        onClose={() => setCreating(false)}
        footer={
          <>
            <Button label={i18n.common.cancel} onPress={() => setCreating(false)} style={{ flex: 1 }} />
            <Button
              label={create.isPending ? i18n.common.creating : i18n.common.create}
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
        <Field label={i18n.characters.fieldName}>
          <Input value={name} onChangeText={setName} placeholder={i18n.characters.namePlaceholder} autoFocus />
        </Field>
        <Field label={i18n.characters.fieldRole}>
          <Choice value={role} options={roleOptions} onChange={setRole} />
        </Field>
      </Sheet>
    </Screen>
  );
}
