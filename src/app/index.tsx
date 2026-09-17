import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ScanMode = 'barcode' | 'qrcode';

const ACCENT = '#208AEF';
const VIEWFINDER_HEIGHT = 220;

const MOCK_BARCODE_RESULT = {
  code: '7891000100103',
  product: 'Leite Integral 1L',
  brand: 'Itambé',
  category: 'Laticínios',
};

const MOCK_QRCODE_RESULT = {
  chave: 'NFC-e 35260912345678000199650010000012345678901234',
  items: [
    { name: 'Arroz 5kg', qty: 1, price: 'R$ 24,90' },
    { name: 'Feijão Carioca 1kg', qty: 2, price: 'R$ 8,50' },
    { name: 'Óleo de Soja 900ml', qty: 1, price: 'R$ 7,30' },
  ],
  total: 'R$ 49,20',
};

export default function HomeScreen() {
  const theme = useTheme();
  const [mode, setMode] = useState<ScanMode>('barcode');
  const [scanned, setScanned] = useState(false);
  const scanLine = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLine, {
          toValue: 1,
          duration: 1600,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(scanLine, {
          toValue: 0,
          duration: 1600,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scanLine]);

  const scanLineTranslateY = scanLine.interpolate({
    inputRange: [0, 1],
    outputRange: [0, VIEWFINDER_HEIGHT - 2],
  });

  function handleModeChange(next: ScanMode) {
    setMode(next);
    setScanned(false);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          Scanner
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
          Mock de teste — leitura de código de barras (EAN-13) ou QR Code da nota fiscal (NFC-e)
        </ThemedText>

        <ThemedView type="backgroundElement" style={styles.modeSwitch}>
          <Pressable
            style={[styles.modeButton, mode === 'barcode' && { backgroundColor: theme.backgroundSelected }]}
            onPress={() => handleModeChange('barcode')}>
            <ThemedText type="smallBold">Código de Barras</ThemedText>
          </Pressable>
          <Pressable
            style={[styles.modeButton, mode === 'qrcode' && { backgroundColor: theme.backgroundSelected }]}
            onPress={() => handleModeChange('qrcode')}>
            <ThemedText type="smallBold">QR Code (NFC-e)</ThemedText>
          </Pressable>
        </ThemedView>

        <View style={[styles.viewfinder, { borderColor: theme.backgroundSelected }]}>
          <View style={[styles.corner, styles.cornerTopLeft, { borderColor: ACCENT }]} />
          <View style={[styles.corner, styles.cornerTopRight, { borderColor: ACCENT }]} />
          <View style={[styles.corner, styles.cornerBottomLeft, { borderColor: ACCENT }]} />
          <View style={[styles.corner, styles.cornerBottomRight, { borderColor: ACCENT }]} />

          <Animated.View
            style={[
              styles.scanLine,
              { backgroundColor: ACCENT, transform: [{ translateY: scanLineTranslateY }] },
            ]}
          />

          <ThemedText type="small" themeColor="textSecondary" style={styles.viewfinderHint}>
            {mode === 'barcode' ? 'Aponte para o código de barras' : 'Aponte para o QR Code da nota'}
          </ThemedText>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.scanButton,
            { backgroundColor: ACCENT },
            pressed && styles.scanButtonPressed,
          ]}
          onPress={() => setScanned(true)}>
          <ThemedText type="smallBold" style={styles.scanButtonText}>
            Simular leitura
          </ThemedText>
        </Pressable>

        {scanned &&
          (mode === 'barcode' ? (
            <ThemedView type="backgroundElement" style={styles.resultCard}>
              <ThemedText type="code">{MOCK_BARCODE_RESULT.code}</ThemedText>
              <ThemedText type="default">{MOCK_BARCODE_RESULT.product}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {MOCK_BARCODE_RESULT.brand} · {MOCK_BARCODE_RESULT.category}
              </ThemedText>
            </ThemedView>
          ) : (
            <ThemedView type="backgroundElement" style={styles.resultCard}>
              <ThemedText type="small" themeColor="textSecondary">
                {MOCK_QRCODE_RESULT.chave}
              </ThemedText>
              {MOCK_QRCODE_RESULT.items.map((item) => (
                <View key={item.name} style={styles.resultRow}>
                  <ThemedText type="small">
                    {item.qty}x {item.name}
                  </ThemedText>
                  <ThemedText type="small">{item.price}</ThemedText>
                </View>
              ))}
              <View style={[styles.resultRow, styles.resultTotalRow]}>
                <ThemedText type="smallBold">Total</ThemedText>
                <ThemedText type="smallBold">{MOCK_QRCODE_RESULT.total}</ThemedText>
              </View>
            </ThemedView>
          ))}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    marginTop: Spacing.four,
  },
  subtitle: {
    marginBottom: Spacing.two,
  },
  modeSwitch: {
    flexDirection: 'row',
    borderRadius: Spacing.four,
    padding: Spacing.half,
    gap: Spacing.half,
  },
  modeButton: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  viewfinder: {
    height: VIEWFINDER_HEIGHT,
    borderRadius: Spacing.four,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderWidth: 3,
  },
  cornerTopLeft: {
    top: Spacing.three,
    left: Spacing.three,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  cornerTopRight: {
    top: Spacing.three,
    right: Spacing.three,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  cornerBottomLeft: {
    bottom: Spacing.three,
    left: Spacing.three,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  cornerBottomRight: {
    bottom: Spacing.three,
    right: Spacing.three,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  scanLine: {
    position: 'absolute',
    top: 0,
    left: Spacing.three,
    right: Spacing.three,
    height: 2,
    opacity: 0.85,
  },
  viewfinderHint: {
    marginBottom: Spacing.three,
  },
  scanButton: {
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  scanButtonPressed: {
    opacity: 0.85,
  },
  scanButtonText: {
    color: '#ffffff',
  },
  resultCard: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  resultTotalRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.3)',
    paddingTop: Spacing.two,
    marginTop: Spacing.half,
  },
});
