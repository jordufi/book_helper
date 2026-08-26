import { useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import {
  Button,
  Card,
  EmptyNote,
  ErrorBanner,
  Field,
  Input,
  Placeholder,
  Screen,
  Sheet,
  Spinner,
  Subtle,
  Title,
} from '../ui/components';
import { SPACING, useTheme } from '../ui/theme';
import { useChapters, useCreateChapter, useReorderChapters } from '../data/hooks';
import { useActiveBook } from '../state/useActiveBook';
import { useT } from '../state/useSettings';
import type { ChaptersListProps } from '../navigation';
import type { ChapterSummary } from '../types';

export function ChaptersScreen({ navigation }: ChaptersListProps) {
  const t = useTheme();
  const i18n = useT();
  const { bookId } = useActiveBook();
  const { data: chapters, isLoading, error } = useChapters(bookId);
  const create = useCreateChapter(bookId);
  const reorder = useReorderChapters(bookId);

  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [order, setOrder] = useState<ChapterSummary[] | null>(null);

  // La pantalla no se desmonta al cambiar de libro (las pestañas se quedan
  // montadas), así que un reordenamiento a medias sobreviviría al cambio: la
  // lista mostrada sería la del libro anterior y "Guardar orden" mandaría ids
  // que no son los del libro activo. Se descarta el borrador.
  useEffect(() => {
    setOrder(null);
  }, [bookId]);

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

  const list = chapters ?? [];
  const shown = order ?? list;

  const move = (i: number, delta: number) =>
    setOrder((current) => {
      const d = [...(current ?? list)];
      const j = i + delta;
      if (j < 0 || j >= d.length) return d;
      [d[i], d[j]] = [d[j], d[i]];
      return d;
    });

  const submit = async () => {
    const chapter = await create.mutateAsync({
      title: title.trim(),
      synopsis: synopsis.trim() || null,
    });
    setCreating(false);
    setTitle('');
    setSynopsis('');
    navigation.navigate('ChapterDetail', { chapterId: chapter.id });
  };

  return (
    <Screen>
      <FlatList
        data={shown}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: SPACING + 4, gap: SPACING, paddingBottom: 40 }}
        ListHeaderComponent={
          <View style={{ gap: SPACING }}>
            <ErrorBanner error={error ?? create.error ?? reorder.error} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Subtle>{i18n.chapters.count(list.length)}</Subtle>
              <View style={{ flex: 1 }} />
              {list.length > 1 && !order && (
                <Button label={i18n.chapters.reorder} onPress={() => setOrder(list)} />
              )}
              {!order && (
                <Button
                  label={i18n.chapters.newChapter}
                  variant="primary"
                  onPress={() => setCreating(true)}
                />
              )}
            </View>
            {order && (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button label={i18n.common.cancel} onPress={() => setOrder(null)} style={{ flex: 1 }} />
                <Button
                  label={reorder.isPending ? i18n.common.saving : i18n.chapters.saveOrder}
                  variant="primary"
                  disabled={reorder.isPending}
                  onPress={async () => {
                    await reorder.mutateAsync(order.map((c) => c.id));
                    setOrder(null);
                  }}
                  style={{ flex: 1 }}
                />
              </View>
            )}
          </View>
        }
        ListEmptyComponent={<EmptyNote>{i18n.chapters.empty}</EmptyNote>}
        renderItem={({ item, index }) => (
          <Card
            onPress={
              order ? undefined : () => navigation.navigate('ChapterDetail', { chapterId: item.id })
            }
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING }}>
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: t.accentSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Subtle>{index + 1}</Subtle>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Title>{item.title}</Title>
                {item.synopsis && <Subtle>{item.synopsis}</Subtle>}
                <Subtle>{i18n.chapters.castCount(item._count.cast)}</Subtle>
              </View>
              {order && (
                <View style={{ gap: 4 }}>
                  <Button
                    label="↑"
                    variant="ghost"
                    onPress={() => move(index, -1)}
                    disabled={index === 0}
                  />
                  <Button
                    label="↓"
                    variant="ghost"
                    onPress={() => move(index, 1)}
                    disabled={index === shown.length - 1}
                  />
                </View>
              )}
            </View>
          </Card>
        )}
      />

      <Sheet
        visible={creating}
        title={i18n.chapters.newSheetTitle}
        onClose={() => setCreating(false)}
        footer={
          <>
            <Button label={i18n.common.cancel} onPress={() => setCreating(false)} style={{ flex: 1 }} />
            <Button
              label={create.isPending ? i18n.common.creating : i18n.common.create}
              variant="primary"
              disabled={!title.trim() || create.isPending}
              onPress={submit}
              style={{ flex: 1 }}
            />
          </>
        }
      >
        <Field label={i18n.chapters.fieldTitle}>
          <Input
            value={title}
            onChangeText={setTitle}
            placeholder={i18n.chapters.titlePlaceholder}
            autoFocus
          />
        </Field>
        {/* La sinopsis es el DISEÑO del capítulo, distinto del texto escrito. */}
        <Field label={i18n.chapters.fieldSynopsis} hint={i18n.chapters.synopsisHint}>
          <Input value={synopsis} onChangeText={setSynopsis} multiline />
        </Field>
      </Sheet>
    </Screen>
  );
}
