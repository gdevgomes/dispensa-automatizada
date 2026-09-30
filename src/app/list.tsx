import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useToast } from '@/components/toast';
import { BottomTabInset, Colors, Palette } from '@/constants/theme';
import { expiryDateLine, expiryInfo, formatMonthYear } from '@/lib/expiry';
import { cancelReminderForItem, scheduleConsumptionReminders } from '@/lib/notifications';
import { getListItems, setItemExists, type ListItem } from '@/lib/shopping-list-storage';

type Filter = 'exists' | 'missing';

const MISSING_STYLE = { color: Colors.light.textSecondary, background: '#eeeeee', glyph: '–' };

export default function ListScreen() {
  const [items, setItems] = useState<ListItem[]>([]);
  const [filter, setFilter] = useState<Filter>('exists');
  const [showToast, toast] = useToast(BottomTabInset + 14);

  const load = useCallback(async () => {
    setItems(await getListItems());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const existsCount = items.filter((item) => item.exists).length;
  const missingCount = items.length - existsCount;

  const visible = useMemo(
    () =>
      items
        .filter((item) => item.exists === (filter === 'exists'))
        .sort((a, b) => a.expirationDate.localeCompare(b.expirationDate)),
    [items, filter],
  );

  async function toggle(item: ListItem) {
    if (item.exists) {
      await setItemExists(item.id, false);
      await cancelReminderForItem(item.id).catch(() => {});
      showToast('Marcado como acabou · lembrete cancelado');
    } else {
      await setItemExists(item.id, true);
      await scheduleConsumptionReminders([item]).catch(() => {});
      showToast('Voltou para a dispensa');
    }
    await load();
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Minha dispensa</Text>
          <Text style={styles.subtitle}>Ordenada por validade</Text>
        </View>
        <View style={styles.segmented}>
          <Segment label={`Tenho · ${existsCount}`} selected={filter === 'exists'} onPress={() => setFilter('exists')} />
          <Segment label={`Acabou · ${missingCount}`} selected={filter === 'missing'} onPress={() => setFilter('missing')} />
        </View>
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {filter === 'exists'
              ? 'Nenhum produto na dispensa. Escaneie um código de barras para começar.'
              : 'Nenhum produto marcado como acabou.'}
          </Text>
        }
        renderItem={({ item }) => {
          const info = expiryInfo(item.expirationDate);
          const status = item.exists
            ? { ...info, label: info.label, dateLine: expiryDateLine(item.expirationDate, info) }
            : {
                ...MISSING_STYLE,
                label: 'Acabou',
                dateLine: `Validade ${formatMonthYear(item.expirationDate)}`,
              };
          const color = item.exists ? info.color : MISSING_STYLE.color;
          const background = item.exists ? info.background : MISSING_STYLE.background;
          return (
            <View style={styles.card}>
              <View style={[styles.icon, { backgroundColor: background }]}>
                <Text style={[styles.iconText, { color }]}>{status.glyph}</Text>
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemMeta}>{status.dateLine}</Text>
                <View style={styles.pillRow}>
                  <View style={[styles.pill, { backgroundColor: background }]}>
                    <Text style={[styles.pillText, { color }]}>{status.label}</Text>
                  </View>
                </View>
              </View>
              <Pressable style={styles.action} onPress={() => toggle(item)}>
                <Text style={styles.actionText}>{item.exists ? 'Acabou' : 'Tenho'}</Text>
              </Pressable>
            </View>
          );
        }}
      />
      {toast}
    </SafeAreaView>
  );
}

function Segment({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.segment, selected && styles.segmentSelected]} onPress={onPress}>
      <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fafafa' },
  header: {
    backgroundColor: Colors.light.background,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  titleBlock: { gap: 2 },
  title: { fontSize: 24, fontWeight: '600', color: Colors.light.text },
  subtitle: { fontSize: 14, color: Colors.light.textSecondary },
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: Palette.primary,
    borderRadius: 22,
    padding: 3,
    gap: 3,
  },
  segment: { flex: 1, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  segmentSelected: { backgroundColor: Palette.primary },
  segmentText: { fontSize: 14, fontWeight: '600', color: Palette.primary },
  segmentTextSelected: { color: Palette.onPrimary },
  listContent: { paddingHorizontal: 16, paddingTop: 14, gap: 10, paddingBottom: BottomTabInset + 20 },
  empty: {
    textAlign: 'center',
    color: Colors.light.textSecondary,
    fontSize: 14,
    paddingVertical: 48,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 20, fontWeight: '700' },
  cardInfo: { flex: 1, gap: 5 },
  itemName: { fontSize: 15, fontWeight: '600', lineHeight: 19, color: Colors.light.text },
  itemMeta: { fontSize: 13, color: Colors.light.textSecondary },
  pillRow: { flexDirection: 'row' },
  pill: { height: 22, paddingHorizontal: 9, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  pillText: { fontSize: 12, fontWeight: '600' },
  action: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(25,118,210,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { fontSize: 13, fontWeight: '600', color: Palette.primary },
});
