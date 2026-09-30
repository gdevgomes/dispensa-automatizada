import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { Colors, Palette } from '@/constants/theme';

export default function AppTabs() {
  const colors = Colors.light;

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={Palette.primaryLight}
      iconColor={{ default: colors.textSecondary, selected: Palette.primaryDark }}
      labelStyle={{
        default: { color: colors.textSecondary, fontWeight: '600' },
        selected: { color: Palette.primaryDark, fontWeight: '600' },
      }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Scanner</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="barcode.viewfinder" md="barcode_scanner" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="list">
        <NativeTabs.Trigger.Label>Lista</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="list.bullet" md="format_list_bulleted" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
