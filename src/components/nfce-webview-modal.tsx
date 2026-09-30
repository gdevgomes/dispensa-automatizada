import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { NFCE_SCRAPE_SCRIPT, parseScrapeMessage, type ScrapedNfceResult } from '@/lib/nfce-scrape';

const ACCENT = '#208AEF';

type NfceWebviewModalProps = {
  visible: boolean;
  url: string | null;
  onCancel: () => void;
  onConfirm: (result: ScrapedNfceResult) => void;
};

export function NfceWebviewModal({ visible, url, onCancel, onConfirm }: NfceWebviewModalProps) {
  const theme = useTheme();
  const webviewRef = useRef<WebView>(null);
  const [scraped, setScraped] = useState<ScrapedNfceResult | null>(null);
  const [loading, setLoading] = useState(true);

  function handleMessage(event: WebViewMessageEvent) {
    setScraped(parseScrapeMessage(event.nativeEvent.data));
  }

  function handleLoadEnd() {
    setLoading(false);
    webviewRef.current?.injectJavaScript(NFCE_SCRAPE_SCRIPT);
  }

  if (!url) return null;

  const statusLabel = scraped
    ? scraped.items.length > 0
      ? `${scraped.items.length} item(ns) identificado(s) automaticamente`
      : 'Nenhum item identificado automaticamente nessa nota'
    : 'Carregando página da nota...';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <ThemedText type="smallBold">Conferir nota fiscal</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {statusLabel}
            </ThemedText>
          </View>

          <View style={styles.webviewWrapper}>
            <WebView
              ref={webviewRef}
              source={{ uri: url }}
              onLoadEnd={handleLoadEnd}
              onMessage={handleMessage}
              injectedJavaScript={NFCE_SCRAPE_SCRIPT}
            />
            {loading && (
              <View style={[styles.loadingOverlay, { backgroundColor: theme.background }]}>
                <ActivityIndicator color={ACCENT} />
              </View>
            )}
          </View>

          <View style={[styles.actions, { borderTopColor: theme.backgroundSelected }]}>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.cancelButton,
                { borderColor: theme.backgroundSelected },
                pressed && styles.pressed,
              ]}
              onPress={onCancel}>
              <ThemedText type="smallBold">Cancelar</ThemedText>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: ACCENT },
                pressed && styles.pressed,
              ]}
              onPress={() => onConfirm(scraped ?? { items: [] })}>
              <ThemedText type="smallBold" style={styles.confirmButtonText}>
                Confirmar lista
              </ThemedText>
            </Pressable>
          </View>
        </SafeAreaView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    gap: Spacing.half,
  },
  webviewWrapper: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderTopWidth: 1,
  },
  button: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.85,
  },
  confirmButtonText: {
    color: '#ffffff',
  },
});
