import { type ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { RADIUS, SPACING, roleColors, useTheme, type Theme } from './theme';
import { useT } from '../state/useSettings';
import type { CharacterRole } from '../types';

// --- Texto -------------------------------------------------------------------

export function Title({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={{ fontSize: 22, fontWeight: '700', color: t.text }}>{children}</Text>;
}

export function Subtle({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={{ fontSize: 13, color: t.textDim }}>{children}</Text>;
}

/** Texto largo de una ficha, con el aviso habitual cuando está vacío. */
export function Prose({ text }: { text: string | null }) {
  const t = useTheme();
  const i18n = useT();
  if (!text) return <Text style={{ color: t.textDim, fontStyle: 'italic' }}>{i18n.common.notFilled}</Text>;
  return <Text style={{ color: t.text, lineHeight: 21 }}>{text}</Text>;
}

export function EmptyNote({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <Text style={{ color: t.textDim, fontStyle: 'italic', paddingVertical: SPACING }}>
      {children}
    </Text>
  );
}

// --- Botones -----------------------------------------------------------------

export function Button({
  label,
  onPress,
  variant = 'default',
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'default' | 'primary' | 'danger' | 'ghost';
  disabled?: boolean;
  style?: object;
}) {
  const t = useTheme();
  const bg = variant === 'primary' ? t.accent : variant === 'ghost' ? 'transparent' : t.surface;
  const fg = variant === 'primary' ? '#fff' : variant === 'danger' ? t.danger : t.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderColor: variant === 'ghost' ? 'transparent' : t.border,
          borderWidth: 1,
          borderRadius: RADIUS,
          paddingVertical: 9,
          paddingHorizontal: 14,
          opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      <Text style={{ color: fg, fontWeight: '600', textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );
}

// --- Contenedores ------------------------------------------------------------

export function Card({ children, onPress }: { children: ReactNode; onPress?: () => void }) {
  const t = useTheme();
  const inner = (
    <View
      style={{
        backgroundColor: t.surface,
        borderColor: t.border,
        borderWidth: 1,
        borderRadius: RADIUS,
        padding: SPACING,
      }}
    >
      {children}
    </View>
  );
  if (!onPress) return inner;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      {inner}
    </Pressable>
  );
}

/**
 * Sección plegable de una ficha, equivalente a `Section` en la web.
 *
 * Al plegar se OCULTA con `display: 'none'`, nunca se desmonta. La diferencia
 * es crítica: dentro viven editores con borrador local (el texto del capítulo,
 * el arco, el reparto) y desmontarlos borra su `useState`. Plegar "Texto" con
 * texto sin guardar lo destruiría —y encima en silencio, porque al
 * desmontarse el editor `useReportUnsaved` hace su limpieza y desarma el aviso
 * de cambios sin guardar justo antes de perderlos—.
 *
 * En la web esto no pasa porque plegar es CSS sobre un `<div>` sin estado.
 *
 * `mounted` retrasa el primer montaje hasta que la sección se abre: así una
 * sección con `defaultOpen={false}` no paga el coste de renderizar nada hasta
 * que hace falta. Una vez abierta, ya no se vuelve a desmontar.
 */
export function Section({
  title,
  children,
  filled,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  filled?: boolean;
  defaultOpen?: boolean;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(defaultOpen);
  const [mounted, setMounted] = useState(defaultOpen);

  const toggle = () => {
    if (!open) setMounted(true);
    setOpen(!open);
  };

  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: t.border }}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14 }}
      >
        <Text style={{ color: t.textDim, width: 14 }}>{open ? '▾' : '▸'}</Text>
        <Text style={{ fontWeight: '600', color: t.text, flex: 1 }}>{title}</Text>
        {/* Punto: la sección tiene contenido. Permite ver de un vistazo qué
            queda por rellenar con las secciones plegadas. */}
        {filled && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: t.ok }} />}
      </Pressable>
      {mounted && (
        <View
          style={{ paddingBottom: SPACING + 4, gap: 8, display: open ? 'flex' : 'none' }}
          // Oculto pero montado: hay que sacarlo también del árbol de
          // accesibilidad, o el lector de pantalla leería campos invisibles.
          accessibilityElementsHidden={!open}
          importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
        >
          {children}
        </View>
      )}
    </View>
  );
}

export function Badge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'accent' | 'ok';
}) {
  const t = useTheme();
  const bg = tone === 'accent' ? t.accentSoft : tone === 'ok' ? t.accentSoft : t.surface2;
  const fg = tone === 'accent' ? t.accent : tone === 'ok' ? t.ok : t.textDim;
  return (
    <View
      style={{ backgroundColor: bg, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 }}
    >
      <Text style={{ color: fg, fontSize: 11, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export function RoleBadge({ role }: { role: CharacterRole }) {
  const t = useTheme();
  const i18n = useT();
  const c = roleColors(t, role);
  return (
    <View
      style={{ backgroundColor: c.bg, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 }}
    >
      <Text style={{ color: c.fg, fontSize: 11, fontWeight: '700' }}>{i18n.roles[role]}</Text>
    </View>
  );
}

/** Sin foto: inicial del nombre, para no dejar un hueco vacío en la lista. */
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const t = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: t.surface2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: t.textDim, fontWeight: '700', fontSize: size * 0.4 }}>
        {name.trim().charAt(0).toUpperCase() || '?'}
      </Text>
    </View>
  );
}

// --- Formulario --------------------------------------------------------------

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  const t = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: t.text }}>{label}</Text>
      {hint && <Text style={{ fontSize: 12, color: t.textDim }}>{hint}</Text>}
      {children}
    </View>
  );
}

export function Input({ multiline, style, ...props }: TextInputProps) {
  const t = useTheme();
  return (
    <TextInput
      placeholderTextColor={t.textDim}
      multiline={multiline}
      textAlignVertical={multiline ? 'top' : 'center'}
      style={[
        {
          backgroundColor: t.surface,
          borderColor: t.border,
          borderWidth: 1,
          borderRadius: RADIUS,
          paddingHorizontal: 12,
          paddingVertical: 10,
          color: t.text,
          minHeight: multiline ? 90 : undefined,
        },
        style,
      ]}
      {...props}
    />
  );
}

/** Selector simple por pulsación: RN no trae un <select> nativo estilable. */
export function Choice<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={{
              backgroundColor: active ? t.accentSoft : t.surface,
              borderColor: active ? t.accent : t.border,
              borderWidth: 1,
              borderRadius: RADIUS,
              paddingVertical: 7,
              paddingHorizontal: 12,
            }}
          >
            <Text style={{ color: active ? t.accent : t.text, fontWeight: active ? '700' : '500' }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Selector para listas que pueden ser largas (personajes de un libro, sucesos
 * de la trama). `Choice` pinta un botón por opción, que está bien para 2-4
 * pero es un muro con 40.
 *
 * Se despliega EN LÍNEA y no en un modal a propósito: varios de estos viven
 * dentro de un `Sheet`, que ya es un `Modal`, y anidar modales da problemas en
 * ambas plataformas. Por lo mismo la lista es un `ScrollView` acotado y no un
 * `FlatList`: dentro de otro scroll, la virtualización avisa y se comporta
 * peor que un recorrido normal ya filtrado por el buscador.
 */
export function Select<T extends string>({
  value,
  options,
  onChange,
  placeholder,
  searchThreshold = 8,
}: {
  value: T | '';
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  placeholder?: string;
  searchThreshold?: number;
}) {
  const t = useTheme();
  const i18n = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const resolvedPlaceholder = placeholder ?? i18n.common.choosePlaceholder;

  const selected = options.find((o) => o.value === value);
  const needle = query.trim().toLowerCase();
  const filtered = needle
    ? options.filter((o) => o.label.toLowerCase().includes(needle))
    : options;

  return (
    <View style={{ gap: 6 }}>
      <Pressable
        onPress={() => setOpen(!open)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={{
          backgroundColor: t.surface,
          borderColor: open ? t.accent : t.border,
          borderWidth: 1,
          borderRadius: RADIUS,
          paddingVertical: 11,
          paddingHorizontal: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Text style={{ flex: 1, color: selected ? t.text : t.textDim }} numberOfLines={1}>
          {selected?.label ?? resolvedPlaceholder}
        </Text>
        <Text style={{ color: t.textDim }}>{open ? '▴' : '▾'}</Text>
      </Pressable>

      {open && (
        <View
          style={{
            borderColor: t.border,
            borderWidth: 1,
            borderRadius: RADIUS,
            backgroundColor: t.surface,
            overflow: 'hidden',
          }}
        >
          {options.length > searchThreshold && (
            <View style={{ padding: 8, borderBottomWidth: 1, borderBottomColor: t.border }}>
              <Input
                value={query}
                onChangeText={setQuery}
                placeholder={i18n.common.searchPlaceholder}
                autoFocus
              />
            </View>
          )}

          <ScrollView style={{ maxHeight: 240 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {filtered.length === 0 && (
              <Text style={{ padding: 12, color: t.textDim, fontStyle: 'italic' }}>
                {i18n.common.noMatch(query)}
              </Text>
            )}
            {filtered.map((o) => {
              const active = o.value === value;
              return (
                <Pressable
                  key={o.value}
                  onPress={() => {
                    onChange(o.value);
                    setQuery('');
                    setOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => ({
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    backgroundColor: active ? t.accentSoft : pressed ? t.surface2 : 'transparent',
                  })}
                >
                  <Text style={{ color: active ? t.accent : t.text, fontWeight: active ? '700' : '400' }}>
                    {o.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// --- Overlays ----------------------------------------------------------------

export function Sheet({
  visible,
  title,
  onClose,
  children,
  footer,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const t = useTheme();
  const i18n = useT();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {/* Aquí sí va KeyboardAvoidingView y no automaticallyAdjustKeyboardInsets:
          dentro de un Modal no hay cabecera de navegación, así que el offset
          es 0 y el cálculo es fiable. Y hace falta también en Android: un
          Modal transparent se dibuja en su propio Dialog/window, que NO
          hereda el `adjustResize` de la Activity, así que sin `behavior` el
          teclado tapa el Sheet en vez de encogerlo. */}
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View
          style={{
            backgroundColor: t.bg,
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            maxHeight: '92%',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: SPACING + 4,
              borderBottomWidth: 1,
              borderBottomColor: t.border,
            }}
          >
            <Text style={{ flex: 1, fontSize: 17, fontWeight: '700', color: t.text }}>{title}</Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={i18n.common.close}
              hitSlop={12}
            >
              <Text style={{ fontSize: 20, color: t.textDim }}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={{ padding: SPACING + 4, gap: SPACING }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            {children}
          </ScrollView>

          {footer && (
            <View
              style={{
                flexDirection: 'row',
                gap: 8,
                padding: SPACING + 4,
                borderTopWidth: 1,
                borderTopColor: t.border,
              }}
            >
              {footer}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Spinner({ label }: { label?: string }) {
  const t = useTheme();
  const i18n = useT();
  return (
    <View style={{ padding: 32, alignItems: 'center', gap: 8 }}>
      <ActivityIndicator color={t.accent} />
      <Subtle>{label ?? i18n.common.loading}</Subtle>
    </View>
  );
}

export function ErrorBanner({ error }: { error: unknown }) {
  const t = useTheme();
  const i18n = useT();
  if (!error) return null;
  const message = error instanceof Error ? error.message : i18n.common.errorGeneric;
  return (
    <View
      style={{
        backgroundColor: t.accentSoft,
        borderColor: t.danger,
        borderWidth: 1,
        borderRadius: RADIUS,
        padding: SPACING,
      }}
    >
      <Text style={{ color: t.danger, fontWeight: '600' }}>{message}</Text>
    </View>
  );
}

/** Pantalla vacía con explicación, equivalente a `.placeholder` en la web. */
export function Placeholder({ title, message }: { title: string; message: string }) {
  return (
    <View style={{ padding: 28, alignItems: 'center', gap: 8 }}>
      <Title>{title}</Title>
      <Subtle>{message}</Subtle>
    </View>
  );
}

export function Screen({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <View style={{ flex: 1, backgroundColor: t.bg }}>{children}</View>;
}

/**
 * ScrollView para pantallas con campos de texto. Reúne los tres ajustes que
 * hacen falta para que el teclado no tape lo que se está escribiendo:
 *
 * - `automaticallyAdjustKeyboardInsets` (iOS) desplaza el contenido solo,
 *   midiendo desde la propia vista. Se usa en vez de KeyboardAvoidingView
 *   porque éste necesitaría saber la altura de la cabecera de navegación, y
 *   `useHeaderHeight` vive en `@react-navigation/elements`, que aquí sólo es
 *   dependencia transitiva. En Android lo resuelve `adjustResize`.
 * - `keyboardShouldPersistTaps="handled"`: sin esto, con el teclado abierto el
 *   primer toque en "Guardar" sólo lo cierra y hay que tocar dos veces.
 * - `keyboardDismissMode="interactive"`: cerrar el teclado arrastrando, que es
 *   lo esperable al escribir texto largo.
 */
export function ScreenScroll({
  children,
  contentContainerStyle,
}: {
  children: ReactNode;
  contentContainerStyle?: object;
}) {
  return (
    <ScrollView
      contentContainerStyle={contentContainerStyle}
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
    >
      {children}
    </ScrollView>
  );
}

export function useThemedStyles(): Theme {
  return useTheme();
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
});
