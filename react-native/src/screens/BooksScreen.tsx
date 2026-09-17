import { useState } from 'react';
import { Alert, FlatList, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
  Badge,
  Button,
  Card,
  EmptyNote,
  ErrorBanner,
  Field,
  Input,
  Screen,
  Sheet,
  Spinner,
  Subtle,
  Title,
} from '../ui/components';
import { SPACING, useTheme } from '../ui/theme';
import { useCreateBook, useDeleteBook, useImportBook, useUpdateBook } from '../data/hooks';
import { exportBook } from '../db/transfer';
import { useActiveBook } from '../state/useActiveBook';
import { useT } from '../state/useSettings';
import { useWalkthrough } from '../state/useWalkthrough';
import { useExitConfirm } from '../lib/useExitConfirm';
import type { Book } from '../types';

/** Nombre de fichero a partir del título: sin acentos, minúsculas, con guiones. */
function slugify(value: string): string {
  const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');
  const slug = value
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'libro';
}

function BookForm({
  book,
  visible,
  pending,
  onClose,
  onSubmit,
}: {
  book?: Book | null;
  visible: boolean;
  pending: boolean;
  onClose: () => void;
  onSubmit: (values: { title: string; author: string | null; synopsis: string | null }) => void;
}) {
  const i18n = useT();
  const [title, setTitle] = useState(book?.title ?? '');
  const [author, setAuthor] = useState(book?.author ?? '');
  const [synopsis, setSynopsis] = useState(book?.synopsis ?? '');

  return (
    <Sheet
      visible={visible}
      title={book ? i18n.books.editTitle : i18n.books.newTitle}
      onClose={onClose}
      footer={
        <>
          <Button label={i18n.common.cancel} onPress={onClose} style={{ flex: 1 }} />
          <Button
            label={pending ? i18n.common.saving : i18n.common.save}
            variant="primary"
            disabled={!title.trim() || pending}
            onPress={() =>
              onSubmit({
                title: title.trim(),
                author: author.trim() || null,
                synopsis: synopsis.trim() || null,
              })
            }
            style={{ flex: 1 }}
          />
        </>
      }
    >
      <Field label={i18n.books.fieldTitle}>
        <Input
          value={title}
          onChangeText={setTitle}
          placeholder={i18n.books.titlePlaceholder}
          autoFocus
        />
      </Field>
      <Field label={i18n.books.fieldAuthor}>
        <Input value={author} onChangeText={setAuthor} placeholder={i18n.books.authorPlaceholder} />
      </Field>
      <Field label={i18n.books.fieldSynopsis} hint={i18n.books.synopsisHint}>
        <Input value={synopsis} onChangeText={setSynopsis} multiline />
      </Field>
    </Sheet>
  );
}

export function BooksScreen() {
  const t = useTheme();
  const i18n = useT();
  const { books, bookId, setBookId, isLoading, error } = useActiveBook();
  const create = useCreateBook();
  const update = useUpdateBook();
  const remove = useDeleteBook();
  const importBook = useImportBook();

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Book | null>(null);
  const [transferError, setTransferError] = useState<unknown>(null);

  // Ésta es la pantalla de inicio: el atrás de Android sale de la app desde
  // aquí, así que se confirma antes. Se desactiva mientras hay un Modal
  // encima (formulario de libro o tutorial), donde el atrás debe cerrar ese
  // modal y no preguntar por la salida.
  const walkthrough = useWalkthrough();
  useExitConfirm(!creating && editing === null && !walkthrough.visible);

  const handleExport = async (book: Book) => {
    setTransferError(null);
    try {
      const json = await exportBook(book.id);

      // Se escribe en la caché y se pasa a la hoja de compartir del sistema:
      // desde ahí el usuario decide si va a Drive, correo o al almacenamiento
      // del teléfono. Escribir directo en "Descargas" requeriría permisos que
      // no merece la pena pedir.
      const file = new File(Paths.cache, `${slugify(book.title)}.json`);
      if (file.exists) file.delete();
      file.create();
      file.write(json);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/json',
          dialogTitle: i18n.books.exportDialogTitle(book.title),
        });
      } else {
        Alert.alert(i18n.books.exportedAlertTitle, i18n.books.exportedAlertBody(file.uri));
      }
    } catch (err) {
      setTransferError(err);
    }
  };

  const handleImport = async () => {
    setTransferError(null);
    try {
      // Tres tipos, no sólo 'application/json': en Android el MIME lo pone el
      // proveedor del fichero, y un .json llegado por correo, Drive o el
      // gestor de archivos se anuncia a menudo como 'text/plain' o
      // 'application/octet-stream'. Con el filtro estricto esos ficheros salen
      // en gris y no hay forma de elegirlos. Aceptarlos no relaja nada: lo que
      // valida de verdad es el JSON.parse y el schema de zod del import.
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/plain', 'application/octet-stream'],
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets?.[0]) return;

      const content = await new File(picked.assets[0].uri).text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new Error(i18n.books.invalidJson);
      }

      const book = await importBook.mutateAsync(parsed);
      setBookId(book.id);
      Alert.alert(i18n.books.importedAlertTitle, i18n.books.importedAlertBody(book.title));
    } catch (err) {
      setTransferError(err);
    }
  };

  const confirmDelete = (book: Book) => {
    Alert.alert(i18n.books.confirmDeleteTitle, i18n.books.confirmDeleteBody(book.title), [
      { text: i18n.common.cancel, style: 'cancel' },
      { text: i18n.common.delete, style: 'destructive', onPress: () => remove.mutate(book.id) },
    ]);
  };

  if (isLoading)
    return (
      <Screen>
        <Spinner />
      </Screen>
    );

  return (
    <Screen>
      <FlatList
        data={books}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ padding: SPACING + 4, gap: SPACING, paddingBottom: 40 }}
        ListHeaderComponent={
          <View style={{ gap: SPACING }}>
            <Title>{i18n.books.title}</Title>
            <ErrorBanner
              error={
                error ??
                create.error ??
                update.error ??
                remove.error ??
                importBook.error ??
                transferError
              }
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                label={i18n.books.newBook}
                variant="primary"
                onPress={() => setCreating(true)}
                style={{ flex: 1 }}
              />
              <Button
                label={importBook.isPending ? i18n.books.importing : i18n.books.importJson}
                onPress={handleImport}
                disabled={importBook.isPending}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        }
        ListEmptyComponent={<EmptyNote>{i18n.books.empty}</EmptyNote>}
        renderItem={({ item }) => (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Title>{item.title}</Title>
              {item.id === bookId && <Badge label={i18n.books.active} tone="accent" />}
            </View>
            <Subtle>
              {[
                item.author,
                i18n.books.charactersLabel(item._count?.characters ?? 0),
                i18n.books.chaptersLabel(item._count?.chapters ?? 0),
                i18n.books.eventsLabel(item._count?.plotEvents ?? 0),
              ]
                .filter(Boolean)
                .join(' · ')}
            </Subtle>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SPACING }}>
              {item.id !== bookId && (
                <Button label={i18n.books.activate} onPress={() => setBookId(item.id)} />
              )}
              <Button label={i18n.common.edit} variant="ghost" onPress={() => setEditing(item)} />
              <Button
                label={i18n.books.export}
                variant="ghost"
                onPress={() => void handleExport(item)}
              />
              <Button label={i18n.common.delete} variant="danger" onPress={() => confirmDelete(item)} />
            </View>
          </Card>
        )}
      />

      {creating && (
        <BookForm
          visible
          pending={create.isPending}
          onClose={() => setCreating(false)}
          onSubmit={async (values) => {
            const book = await create.mutateAsync(values);
            setBookId(book.id);
            setCreating(false);
          }}
        />
      )}

      {editing && (
        <BookForm
          // key: al cambiar de libro hay que reconstruir el formulario, si no
          // conservaría en el estado los valores del anterior.
          key={editing.id}
          book={editing}
          visible
          pending={update.isPending}
          onClose={() => setEditing(null)}
          onSubmit={async (values) => {
            await update.mutateAsync({ id: editing.id, ...values });
            setEditing(null);
          }}
        />
      )}

      <View style={{ height: 1, backgroundColor: t.border }} />
    </Screen>
  );
}
