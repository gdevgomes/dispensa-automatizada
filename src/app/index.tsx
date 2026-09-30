import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutAnimation, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useToast } from '@/components/toast';
import { Colors, Palette } from '@/constants/theme';
import { lookupProductByBarcode, type ProductLookupResult } from '@/lib/barcode-lookup';
import { expiryInfo, formatMonthYear, monthEndIso } from '@/lib/expiry';
import { scheduleConsumptionReminders } from '@/lib/notifications';
import { appendList, type NewListItem } from '@/lib/shopping-list-storage';

const YEARS_AHEAD = 21;
const MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const COMPACT_CAMERA_HEIGHT = 210;
const FRAME_WIDTH = 270;
const FRAME_HEIGHT = 150;

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);
  const [product, setProduct] = useState<ProductLookupResult | null>(null);
  const [expiryYear, setExpiryYear] = useState(() => new Date().getFullYear());
  const [expiryMonth, setExpiryMonth] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const processingRef = useRef(false);
  const hasRequestedRef = useRef(false);
  const [showToast, toast] = useToast();
  const [flash] = useState(() => new Animated.Value(0));
  const [badgeScale] = useState(() => new Animated.Value(0));
  const [scanLine] = useState(() => new Animated.Value(0));
  const [productAppear] = useState(() => new Animated.Value(0));

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const years = Array.from({ length: YEARS_AHEAD }, (_, i) => currentYear + i);
  const scanning = !locked && permission?.granted === true;

  useEffect(() => {
    if (!permission || hasRequestedRef.current) return;
    if (!permission.granted && permission.canAskAgain) {
      hasRequestedRef.current = true;
      requestPermission();
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    if (!scanning) return;
    scanLine.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLine, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scanLine, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scanning, scanLine]);

  useEffect(() => {
    if (product === null) return;
    Animated.timing(badgeScale, { toValue: 0.75, duration: 300, useNativeDriver: true }).start();
    if (product.status !== 'found') return;
    productAppear.setValue(0);
    Animated.timing(productAppear, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, [product, badgeScale, productAppear]);

  const currentItem: NewListItem | null =
    product?.status === 'found' && expiryMonth !== null
      ? { code: product.code, name: product.name, expiryYear, expiryMonth }
      : null;
  const pick = expiryMonth !== null ? expiryInfo(monthEndIso(expiryYear, expiryMonth)) : null;

  function resetScan() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    processingRef.current = false;
    flash.setValue(0);
    badgeScale.setValue(0);
    setLocked(false);
    setProduct(null);
    setExpiryYear(currentYear);
    setExpiryMonth(null);
  }

  function playScanAnimation() {
    flash.setValue(0.9);
    badgeScale.setValue(0);
    // animações independentes: interromper o badge não pode deixar o flash travado
    Animated.timing(flash, { toValue: 0, duration: 550, useNativeDriver: true }).start();
    Animated.spring(badgeScale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  }

  function handleScanned(result: BarcodeScanningResult) {
    if (processingRef.current) return;
    processingRef.current = true;
    setLocked(true);
    playScanAnimation();
    setProduct(null);
    lookupProductByBarcode(result.data).then((found) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setProduct(found);
    });
  }

  function selectYear(year: number) {
    setExpiryYear(year);
    if (year === currentYear && expiryMonth !== null && expiryMonth < currentMonth) setExpiryMonth(null);
  }

  async function handleAdd() {
    if (!currentItem || saving) return;
    setSaving(true);
    try {
      const created = await appendList([currentItem]);
      try {
        await scheduleConsumptionReminders(created);
      } catch {
        // lembretes são opcionais: falha ao agendar não deve impedir o cadastro
      }
      showToast('Produto adicionado à dispensa');
      resetScan();
    } finally {
      setSaving(false);
    }
  }

  const compact = product !== null;
  const canAdd = currentItem !== null && !saving;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={[styles.camera, compact ? { height: COMPACT_CAMERA_HEIGHT } : styles.flex]}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['ean13'] }}
            onBarcodeScanned={locked ? undefined : handleScanned}
          />
        ) : (
          <View style={styles.permissionBox}>
            <Text style={styles.permissionText}>
              {permission?.canAskAgain === false
                ? 'Acesso à câmera negado. Habilite nas configurações do sistema.'
                : 'Precisamos de acesso à câmera para escanear'}
            </Text>
            {permission?.canAskAgain !== false && (
              <Pressable style={styles.buttonContained} onPress={requestPermission}>
                <Text style={styles.buttonContainedText}>Permitir câmera</Text>
              </Pressable>
            )}
          </View>
        )}

        {permission?.granted && (
          <View pointerEvents="none" style={styles.frame}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            {scanning && (
              <Animated.View
                style={[
                  styles.scanLine,
                  { transform: [{ translateY: scanLine.interpolate({ inputRange: [0, 1], outputRange: [8, FRAME_HEIGHT - 10] }) }] },
                ]}
              />
            )}
          </View>
        )}

        {scanning && (
          <View pointerEvents="none" style={styles.hintWrap}>
            <Text style={styles.hint}>Aponte para o código de barras</Text>
          </View>
        )}

        <Animated.View pointerEvents="none" style={[styles.flash, { opacity: flash }]} />
        <View pointerEvents="none" style={styles.badgeWrap}>
          <Animated.View style={[styles.badge, { transform: [{ scale: badgeScale }] }]}>
            <Text style={styles.badgeText}>✓</Text>
          </Animated.View>
        </View>
      </View>

      {locked && product === null && (
        <Text style={styles.loading}>Consultando produto...</Text>
      )}

      {product?.status === 'found' && (
        <Animated.View
          style={[
            styles.flex,
            {
              opacity: productAppear,
              transform: [{ translateY: productAppear.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
            },
          ]}>
          <ScrollView contentContainerStyle={styles.details}>
            <View style={styles.foundBlock}>
              <Text style={styles.foundLabel}>✓  Produto encontrado · EAN {product.code}</Text>
              <Text style={styles.productName}>{product.name}</Text>
            </View>
            <View style={styles.divider} />

            <View style={styles.pickBlock}>
              <Text style={styles.pickTitle}>Selecionar a validade do produto</Text>
              <Text style={styles.sectionLabel}>ANO</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.yearScroll}
                contentContainerStyle={styles.yearRow}>
                {years.map((year) => {
                  const selected = expiryYear === year;
                  return (
                    <Pressable
                      key={year}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => selectYear(year)}>
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{year}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Text style={styles.sectionLabel}>MÊS</Text>
              <View style={styles.monthGrid}>
                {[0, 1, 2].map((row) => (
                  <View key={row} style={styles.monthRow}>
                    {MONTHS.slice(row * 4, row * 4 + 4).map((label, i) => {
                      const month = row * 4 + i + 1;
                      const disabled = expiryYear === currentYear && month < currentMonth;
                      const selected = expiryMonth === month;
                      return (
                        <Pressable
                          key={label}
                          disabled={disabled}
                          style={[styles.month, disabled && styles.monthDisabled, selected && styles.monthSelected]}
                          onPress={() => setExpiryMonth(month)}>
                          <Text
                            style={[
                              styles.monthText,
                              disabled && styles.monthTextDisabled,
                              selected && styles.monthTextSelected,
                            ]}>
                            {label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>

              {pick && expiryMonth !== null && (
                <View style={styles.pickRow}>
                  <Text style={styles.pickText}>Validade {formatMonthYear(monthEndIso(expiryYear, expiryMonth))}</Text>
                  <View style={[styles.pill, { backgroundColor: pick.background }]}>
                    <Text style={[styles.pillText, { color: pick.color }]}>{pick.label}</Text>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.footerButtons}>
              <Pressable style={[styles.buttonOutlined, styles.flex]} onPress={resetScan}>
                <Text style={styles.buttonOutlinedText}>↻  Escanear novamente</Text>
              </Pressable>
              <Pressable
                disabled={!canAdd}
                style={[styles.buttonContained, styles.flex, !canAdd && styles.buttonDisabled]}
                onPress={handleAdd}>
                <Text style={[styles.buttonContainedText, !canAdd && styles.buttonDisabledText]}>ADICIONAR NOVO PRODUTO</Text>
              </Pressable>
            </View>
          </ScrollView>
        </Animated.View>
      )}

      {product && product.status !== 'found' && (
        <View style={styles.notFound}>
          <Text style={styles.productName}>{product.code}</Text>
          <Text style={styles.notFoundText}>
            {product.status === 'not-found' ? 'Produto não encontrado na base pública' : product.message}
          </Text>
          <Pressable style={styles.buttonOutlined} onPress={resetScan}>
            <Text style={styles.buttonOutlinedText}>↻  Escanear novamente</Text>
          </Pressable>
        </View>
      )}

      {toast}
    </SafeAreaView>
  );
}

const CORNER = { position: 'absolute', width: 34, height: 34, borderColor: '#ffffff' } as const;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.light.background },
  flex: { flex: 1 },
  camera: { backgroundColor: '#1e2a30', overflow: 'hidden' },
  permissionBox: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  permissionText: { fontSize: 14, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },
  frame: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
    marginLeft: -FRAME_WIDTH / 2,
    marginTop: -FRAME_HEIGHT / 2,
  },
  corner: CORNER,
  cornerTL: { left: 0, top: 0, borderLeftWidth: 4, borderTopWidth: 4, borderTopLeftRadius: 14 },
  cornerTR: { right: 0, top: 0, borderRightWidth: 4, borderTopWidth: 4, borderTopRightRadius: 14 },
  cornerBL: { left: 0, bottom: 0, borderLeftWidth: 4, borderBottomWidth: 4, borderBottomLeftRadius: 14 },
  cornerBR: { right: 0, bottom: 0, borderRightWidth: 4, borderBottomWidth: 4, borderBottomRightRadius: 14 },
  scanLine: {
    position: 'absolute',
    left: 10,
    right: 10,
    height: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.95)',
    shadowColor: Palette.primary,
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 4,
  },
  hintWrap: { position: 'absolute', top: 18, left: 0, right: 0, alignItems: 'center' },
  hint: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    color: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    overflow: 'hidden',
    fontSize: 14,
    fontWeight: '500',
  },
  flash: { ...StyleSheet.absoluteFill, backgroundColor: '#ffffff' },
  badgeWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  badge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Palette.success,
    borderWidth: 3,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  badgeText: { color: Palette.onPrimary, fontSize: 40, lineHeight: 48, fontWeight: '700' },
  loading: { padding: 20, fontSize: 14, color: Colors.light.textSecondary, textAlign: 'center' },
  details: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20, gap: 18 },
  foundBlock: { gap: 6 },
  foundLabel: { fontSize: 13, fontWeight: '600', color: Palette.success },
  productName: { fontSize: 21, fontWeight: '600', lineHeight: 26, color: Colors.light.text },
  divider: { height: 1, backgroundColor: Palette.divider },
  pickBlock: { gap: 12 },
  pickTitle: { fontSize: 16, fontWeight: '600', color: Colors.light.text },
  sectionLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.6, color: Colors.light.textSecondary },
  yearScroll: { flexGrow: 0, marginHorizontal: -20 },
  yearRow: { gap: 8, paddingHorizontal: 20, paddingBottom: 4 },
  chip: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.23)',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: Palette.primary, borderColor: Palette.primary },
  chipText: { fontSize: 14, fontWeight: '500', color: Colors.light.text },
  chipTextSelected: { color: Palette.onPrimary },
  monthGrid: { gap: 8 },
  monthRow: { flexDirection: 'row', gap: 8 },
  month: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.23)',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthDisabled: { backgroundColor: '#f5f5f5', borderColor: 'transparent' },
  monthSelected: { backgroundColor: Palette.primaryLight, borderColor: Palette.primary },
  monthText: { fontSize: 14, fontWeight: '600', letterSpacing: 0.4, color: Colors.light.text },
  monthTextDisabled: { color: 'rgba(0,0,0,0.3)' },
  monthTextSelected: { color: Palette.primaryDark },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pickText: { fontSize: 14, color: Colors.light.textSecondary },
  pill: { height: 24, paddingHorizontal: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pillText: { fontSize: 12, fontWeight: '600' },
  footerButtons: { flexDirection: 'row', gap: 10, marginTop: 'auto', paddingTop: 4 },
  buttonContained: {
    minHeight: 48,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: Palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  buttonContainedText: { color: Palette.onPrimary, fontSize: 13, fontWeight: '600', letterSpacing: 0.4, textAlign: 'center' },
  buttonDisabled: { backgroundColor: 'rgba(0,0,0,0.12)', elevation: 0 },
  buttonDisabledText: { color: 'rgba(0,0,0,0.38)' },
  buttonOutlined: {
    minHeight: 48,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(25,118,210,0.5)',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonOutlinedText: { color: Palette.primary, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  notFound: { padding: 20, gap: 12, alignItems: 'center' },
  notFoundText: { fontSize: 14, color: Colors.light.textSecondary, textAlign: 'center' },
});
