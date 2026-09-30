// Scanner antigo (código de barras + QR Code NFC-e). Mantido no projeto, mas não está em uso nas rotas.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';

import { NfceWebviewModal } from '@/components/nfce-webview-modal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { lookupProductByBarcode, type ProductLookupResult } from '@/lib/barcode-lookup';
import { parseNfceQrCode, type NfceKey } from '@/lib/nfce';
import { addPantryItem } from '@/lib/pantry-storage';
import type { ScrapedNfceResult } from '@/lib/nfce-scrape';

type ScanMode = 'barcode' | 'qrcode';

const ACCENT = '#208AEF';
const YEARS_AHEAD = 3;
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function LegacyScanner() {
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<ScanMode>('barcode');
  const [locked, setLocked] = useState(false);
  const [barcodeResult, setBarcodeResult] = useState<ProductLookupResult | null>(null);
  const [nfceResult, setNfceResult] = useState<{ raw: string; key: NfceKey | null } | null>(null);
  const [webviewUrl, setWebviewUrl] = useState<string | null>(null);
  const [confirmedItems, setConfirmedItems] = useState<ScrapedNfceResult | null>(null);
  const [viewfinderHeight, setViewfinderHeight] = useState(220);
  const [expiryYear, setExpiryYear] = useState<number | null>(null);
  const [expiryMonth, setExpiryMonth] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedName, setSavedName] = useState<string | null>(null);
  const processingRef = useRef(false);
  const hasRequestedRef = useRef(false);
  const scanLine = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!permission || hasRequestedRef.current) return;
    if (!permission.granted && permission.canAskAgain) {
      hasRequestedRef.current = true;
      requestPermission();
    }
  }, [permission, requestPermission]);

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
    outputRange: [0, Math.max(viewfinderHeight - 2, 0)],
  });

  function handleModeChange(next: ScanMode) {
    setMode(next);
    resetScan();
  }

  function resetScan() {
    processingRef.current = false;
    setLocked(false);
    setBarcodeResult(null);
    setNfceResult(null);
    setConfirmedItems(null);
    setWebviewUrl(null);
    setExpiryYear(null);
    setExpiryMonth(null);
    setSavedName(null);
  }

  async function handleContinue() {
    if (barcodeResult?.status !== 'found' || expiryYear === null || expiryMonth === null) return;
    setSaving(true);
    try {
      await addPantryItem({
        code: barcodeResult.code,
        name: barcodeResult.name,
        expiryYear,
        expiryMonth,
      });
      const name = barcodeResult.name;
      resetScan();
      setSavedName(name);
    } finally {
      setSaving(false);
    }
  }

  const handleBarcodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (processingRef.current) return;
      processingRef.current = true;
      setLocked(true);

      if (mode === 'barcode') {
        setBarcodeResult(null);
        lookupProductByBarcode(result.data).then(setBarcodeResult);
      } else {
        console.log('QR Code lido:', result.data);
        setNfceResult({ raw: result.data, key: parseNfceQrCode(result.data) });
        setConfirmedItems(null);
        if (/^https?:\/\//i.test(result.data)) {
          setWebviewUrl(result.data);
        }
      }
    },
    [mode],
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topHalf}>
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

        <View
          style={[styles.viewfinder, { borderColor: theme.backgroundSelected }]}
          onLayout={(e) => setViewfinderHeight(e.nativeEvent.layout.height)}>
          {permission?.granted ? (
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: mode === 'barcode' ? ['ean13'] : ['qr'] }}
              onBarcodeScanned={locked ? undefined : handleBarcodeScanned}
            />
          ) : (
            <ThemedView type="backgroundElement" style={StyleSheet.absoluteFill} />
          )}

          <View style={[styles.corner, styles.cornerTopLeft, { borderColor: ACCENT }]} />
          <View style={[styles.corner, styles.cornerTopRight, { borderColor: ACCENT }]} />
          <View style={[styles.corner, styles.cornerBottomLeft, { borderColor: ACCENT }]} />
          <View style={[styles.corner, styles.cornerBottomRight, { borderColor: ACCENT }]} />

          {permission?.granted && !locked && (
            <Animated.View
              style={[
                styles.scanLine,
                { backgroundColor: ACCENT, transform: [{ translateY: scanLineTranslateY }] },
              ]}
            />
          )}

          {!permission?.granted && (
            <View style={styles.permissionOverlay}>
              <ThemedText type="small" style={styles.permissionText}>
                {permission?.canAskAgain === false
                  ? 'Acesso à câmera negado. Habilite nas configurações do sistema.'
                  : 'Precisamos de acesso à câmera para escanear'}
              </ThemedText>
              {permission?.canAskAgain !== false && (
                <Pressable style={[styles.permissionButton, { backgroundColor: ACCENT }]} onPress={requestPermission}>
                  <ThemedText type="smallBold" style={styles.scanButtonText}>
                    Permitir câmera
                  </ThemedText>
                </Pressable>
              )}
            </View>
          )}

          {permission?.granted && !locked && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.viewfinderHint}>
              {mode === 'barcode' ? 'Aponte para o código de barras' : 'Aponte para o QR Code da nota'}
            </ThemedText>
          )}
        </View>
        </View>

        <ScrollView style={styles.bottomHalf} contentContainerStyle={styles.bottomContent}>
        {savedName && !locked && (
          <ThemedText type="small" themeColor="textSecondary">
            “{savedName}” adicionado à lista.
          </ThemedText>
        )}

        {locked && (
          <Pressable
            style={({ pressed }) => [
              styles.scanButton,
              { backgroundColor: ACCENT },
              pressed && styles.scanButtonPressed,
            ]}
            onPress={resetScan}>
            <ThemedText type="smallBold" style={styles.scanButtonText}>
              Escanear novamente
            </ThemedText>
          </Pressable>
        )}

        {mode === 'barcode' && barcodeResult?.status === 'found' && (
          <ThemedView type="backgroundElement" style={styles.resultCard}>
            <ThemedText type="subtitle">{barcodeResult.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {[barcodeResult.brand, barcodeResult.quantity].filter(Boolean).join(' · ') || barcodeResult.code}
            </ThemedText>

            <ThemedText type="smallBold">Ano de validade</ThemedText>
            <View style={styles.chipRow}>
              {Array.from({ length: YEARS_AHEAD }, (_, i) => new Date().getFullYear() + i).map((year) => (
                <Pressable
                  key={year}
                  style={[styles.chip, { backgroundColor: expiryYear === year ? ACCENT : theme.backgroundSelected }]}
                  onPress={() => setExpiryYear(year)}>
                  <ThemedText type="smallBold" style={expiryYear === year && styles.scanButtonText}>
                    {year}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <ThemedText type="smallBold">Mês</ThemedText>
            <View style={styles.chipRow}>
              {MONTHS.map((label, index) => (
                <Pressable
                  key={label}
                  style={[
                    styles.chip,
                    styles.monthChip,
                    { backgroundColor: expiryMonth === index + 1 ? ACCENT : theme.backgroundSelected },
                  ]}
                  onPress={() => setExpiryMonth(index + 1)}>
                  <ThemedText type="smallBold" style={expiryMonth === index + 1 && styles.scanButtonText}>
                    {label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <Pressable
              disabled={expiryYear === null || expiryMonth === null || saving}
              style={({ pressed }) => [
                styles.scanButton,
                { backgroundColor: ACCENT },
                (expiryYear === null || expiryMonth === null || saving) && styles.buttonDisabled,
                pressed && styles.scanButtonPressed,
              ]}
              onPress={handleContinue}>
              <ThemedText type="smallBold" style={styles.scanButtonText}>
                Continuar
              </ThemedText>
            </Pressable>
          </ThemedView>
        )}

        {mode === 'barcode' && barcodeResult && barcodeResult.status !== 'found' && (
          <ThemedView type="backgroundElement" style={styles.resultCard}>
            <ThemedText type="code">{barcodeResult.code}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {barcodeResult.status === 'not-found' ? 'Produto não encontrado na base pública' : barcodeResult.message}
            </ThemedText>
          </ThemedView>
        )}

        {mode === 'barcode' && locked && !barcodeResult && (
          <ThemedView type="backgroundElement" style={styles.resultCard}>
            <ThemedText type="small" themeColor="textSecondary">
              Consultando produto...
            </ThemedText>
          </ThemedView>
        )}

        {mode === 'qrcode' && nfceResult && (
          <ThemedView type="backgroundElement" style={styles.resultCard}>
            {nfceResult.key ? (
              <>
                <ThemedText type="small" themeColor="textSecondary">
                  Chave de acesso {nfceResult.key.digitoValido ? '(válida)' : '(dígito verificador inválido)'}
                </ThemedText>
                <ThemedText type="code">{nfceResult.key.raw}</ThemedText>
                <View style={styles.resultRow}>
                  <ThemedText type="small">Emitente (CNPJ)</ThemedText>
                  <ThemedText type="small">{nfceResult.key.cnpj}</ThemedText>
                </View>
                <View style={styles.resultRow}>
                  <ThemedText type="small">UF</ThemedText>
                  <ThemedText type="small">{nfceResult.key.uf}</ThemedText>
                </View>
                <View style={styles.resultRow}>
                  <ThemedText type="small">Emissão</ThemedText>
                  <ThemedText type="small">
                    {String(nfceResult.key.mes).padStart(2, '0')}/{nfceResult.key.ano}
                  </ThemedText>
                </View>
                <View style={styles.resultRow}>
                  <ThemedText type="small">Número / Série</ThemedText>
                  <ThemedText type="small">
                    {nfceResult.key.numero} / {nfceResult.key.serie}
                  </ThemedText>
                </View>
                <View style={[styles.resultRow, styles.resultTotalRow]}>
                  <ThemedText type="small">Tipo de emissão</ThemedText>
                  <ThemedText type="small">{nfceResult.key.tipoEmissao}</ThemedText>
                </View>
              </>
            ) : (
              <>
                <ThemedText type="default">QR Code lido, mas não é uma chave de NFC-e válida</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {nfceResult.raw}
                </ThemedText>
              </>
            )}
          </ThemedView>
        )}

        {mode === 'qrcode' && confirmedItems && (
          <ThemedView type="backgroundElement" style={styles.resultCard}>
            <ThemedText type="small" themeColor="textSecondary">
              Itens confirmados (extração automática — pode conter erros)
            </ThemedText>
            {confirmedItems.items.length === 0 ? (
              <ThemedText type="small">Nenhum item foi reconhecido automaticamente nessa nota.</ThemedText>
            ) : (
              confirmedItems.items.map((item, index) => (
                <View key={`${item.description}-${index}`} style={styles.resultRow}>
                  <ThemedText type="small" style={styles.resultItemName}>
                    {item.qty ? `${item.qty}x ` : ''}
                    {item.description}
                  </ThemedText>
                  {item.price && <ThemedText type="small">{item.price}</ThemedText>}
                </View>
              ))
            )}
            {confirmedItems.total && (
              <View style={[styles.resultRow, styles.resultTotalRow]}>
                <ThemedText type="smallBold">Total</ThemedText>
                <ThemedText type="smallBold">{confirmedItems.total}</ThemedText>
              </View>
            )}
          </ThemedView>
        )}
        </ScrollView>
      </SafeAreaView>

      <NfceWebviewModal
        key={webviewUrl ?? 'closed'}
        visible={webviewUrl !== null}
        url={webviewUrl}
        onCancel={() => setWebviewUrl(null)}
        onConfirm={(result) => {
          setConfirmedItems(result);
          setWebviewUrl(null);
        }}
      />
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
  topHalf: {
    flex: 1,
    gap: Spacing.three,
    marginTop: Spacing.three,
  },
  bottomHalf: {
    flex: 1,
  },
  bottomContent: {
    gap: Spacing.three,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  monthChip: {
    width: '22%',
    paddingHorizontal: 0,
  },
  buttonDisabled: {
    opacity: 0.4,
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
    flex: 1,
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
    backgroundColor: 'rgba(0,0,0,0.45)',
    color: '#ffffff',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.two,
    overflow: 'hidden',
  },
  permissionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  permissionText: {
    textAlign: 'center',
  },
  permissionButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
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
  resultItemName: {
    flex: 1,
    marginRight: Spacing.two,
  },
  resultTotalRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.3)',
    paddingTop: Spacing.two,
    marginTop: Spacing.half,
  },
});
