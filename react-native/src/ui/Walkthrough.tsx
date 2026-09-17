import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from './components';
import { SPACING, useTheme } from './theme';
import { useT } from '../state/useSettings';
import { useWalkthrough } from '../state/useWalkthrough';

/**
 * Tutorial de bienvenida: un paso por pantalla, con los cuatro conceptos de la
 * app (libro, trama, personajes, capítulos) y el "todo se queda en tu
 * dispositivo".
 *
 * Se pinta una sola vez, en `App`, por encima de la navegación: así también
 * sale la primera vez que se abre la app, cuando aún no hay ningún libro y
 * ninguna pestaña tiene nada que enseñar.
 *
 * Los textos viven en `i18n`, como el resto de la UI; el número de pasos sale
 * del propio diccionario, así que añadir o quitar uno es tocar `es/en/fr` y
 * nada más.
 */
export function Walkthrough() {
  const t = useTheme();
  const i18n = useT();
  const { visible, close, dismissForever } = useWalkthrough();
  const [step, setStep] = useState(0);

  const steps = i18n.walkthrough.steps;
  const last = step === steps.length - 1;

  // Reabrirlo desde Ajustes debe empezar por el principio, no donde se dejó.
  useEffect(() => {
    if (visible) setStep(0);
  }, [visible]);

  if (!visible) return null;

  const current = steps[step];

  return (
    <Modal visible animationType="fade" transparent onRequestClose={close}>
      <View style={styles.backdrop}>
        <View
          style={{
            backgroundColor: t.bg,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: t.border,
            maxHeight: '88%',
            width: '100%',
            maxWidth: 520,
            overflow: 'hidden',
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
            <Text style={{ flex: 1, fontSize: 17, fontWeight: '700', color: t.text }}>
              {i18n.walkthrough.title}
            </Text>
            <Pressable
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel={i18n.common.close}
              hitSlop={12}
            >
              <Text style={{ fontSize: 20, color: t.textDim }}>✕</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: SPACING + 8, gap: SPACING }}>
            <Text style={{ fontSize: 44, textAlign: 'center' }}>{current.icon}</Text>
            <Text
              style={{ fontSize: 20, fontWeight: '700', color: t.text, textAlign: 'center' }}
              accessibilityRole="header"
            >
              {current.title}
            </Text>
            <Text style={{ fontSize: 15, lineHeight: 22, color: t.textDim, textAlign: 'center' }}>
              {current.body}
            </Text>
          </ScrollView>

          {/* Puntos de progreso. Decorativos: el estado real lo dice el
              `accessibilityLabel` de abajo, para no leer cinco círculos. */}
          <View
            style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, paddingBottom: 4 }}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {steps.map((item, index) => (
              <View
                key={item.title}
                style={{
                  width: index === step ? 18 : 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: index === step ? t.accent : t.border,
                }}
              />
            ))}
          </View>

          <Text
            style={{ textAlign: 'center', color: t.textDim, fontSize: 13, paddingBottom: SPACING }}
            accessibilityLabel={i18n.walkthrough.stepOf(step + 1, steps.length)}
          >
            {i18n.walkthrough.stepOf(step + 1, steps.length)}
          </Text>

          <View
            style={{
              gap: 8,
              padding: SPACING + 4,
              borderTopWidth: 1,
              borderTopColor: t.border,
            }}
          >
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                label={i18n.walkthrough.back}
                onPress={() => setStep((value) => value - 1)}
                disabled={step === 0}
                style={{ flex: 1 }}
              />
              <Button
                label={last ? i18n.walkthrough.done : i18n.walkthrough.next}
                variant="primary"
                onPress={() => (last ? close() : setStep((value) => value + 1))}
                style={{ flex: 1 }}
              />
            </View>
            <Button
              label={i18n.walkthrough.dontShowAgain}
              variant="ghost"
              onPress={dismissForever}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
});
