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
  const [title, setTitle] = useState(book?.title ?? '');
  const [author, setAuthor] = useState(book?.author ?? '');
  const [synopsis, setSynopsis] = useState(book?.synopsis ?? '');

  return (
    <Sheet
      visible={visible}
      title={book ? 'Editar libro' : 'Nuevo libro'}
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
                author: author.trim() || null,
                synopsis: synopsis.trim() || null,
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
          placeholder="El nombre de tu novela"
          autoFocus
        />
      </Field>
      <Field label="Autor">
        <Input value={author} onChangeText={setAuthor} placeholder="Quién la escribe" />
      </Field>
      <Field label="Sinopsis" hint="De qué va, en un párrafo">
        <Input value={synopsis} onChangeText={setSynopsis} multiline />
      </Field>
    </Sheet>
  );
}

export function BooksScreen() {
  const t = useTheme();
  const { books, bookId, setBookId, isLoading, error } = useActiveBook();
  const create = useCreateBook();
  const update = useUpdateBook();
  const remove = useDeleteBook();
  const importBook = useImportBook();

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Book | null>(null);
  const [transferError, setTransferError] = useState<unknown>(null);

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
          dialogTitle: `Exportar "${book.title}"`,
        });
      } else {
        Alert.alert('Exportado', `Guardado en:\n${file.uri}`);
      }
    } catch (err) {
      setTransferError(err);
    }
  };

  const handleImport = async () => {
    setTransferError(null);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets?.[0]) return;

      const content = await new File(picked.assets[0].uri).text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new Error('El fichero no es un JSON válido');
      }

      const book = await importBook.mutateAsync(parsed);
      setBookId(book.id);
      Alert.alert('Importado', `"${book.title}" ya está en el dispositivo.`);
    } catch (err) {
      setTransferError(err);
    }
  };

  const confirmDelete = (book: Book) => {
    Alert.alert(
      'Borrar libro',
      `¿Borrar "${book.title}"? Se perderán sus personajes, capítulos y toda su trama. No se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Borrar', style: 'destructive', onPress: () => remove.mutate(book.id) },
      ],
    );
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
            <Title>Libros</Title>
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
                label="+ Libro"
                variant="primary"
                onPress={() => setCreating(true)}
                style={{ flex: 1 }}
              />
              <Button
                label={importBook.isPending ? 'Importando…' : 'Importar JSON'}
                onPress={handleImport}
                disabled={importBook.isPending}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyNote>Todavía no hay libros. Crea el primero para empezar.</EmptyNote>
        }
        renderItem={({ item }) => (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Title>{item.title}</Title>
              {item.id === bookId && <Badge label="Activo" tone="accent" />}
            </View>
            <Subtle>
              {[
                item.author,
                `${item._count?.characters ?? 0} personajes`,
                `${item._count?.chapters ?? 0} capítulos`,
                `${item._count?.plotEvents ?? 0} sucesos`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Subtle>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SPACING }}>
              {item.id !== bookId && <Button label="Activar" onPress={() => setBookId(item.id)} />}
              <Button label="Editar" variant="ghost" onPress={() => setEditing(item)} />
              <Button label="Exportar" variant="ghost" onPress={() => void handleExport(item)} />
              <Button label="Borrar" variant="danger" onPress={() => confirmDelete(item)} />
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
