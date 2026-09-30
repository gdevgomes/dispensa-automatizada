import * as Notifications from 'expo-notifications';
import { DefaultTheme, ThemeProvider, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import {
  cancelInactivityReminder,
  handleReminderResponse,
  scheduleInactivityReminder,
  setupNotifications,
} from '@/lib/notifications';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const router = useRouter();
  const response = Notifications.useLastNotificationResponse();
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    setupNotifications().catch(() => {});
    // enquanto o app está aberto não há lembrete; a contagem dos 15 dias começa ao fechar
    cancelInactivityReminder().catch(() => {});
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') cancelInactivityReminder().catch(() => {});
      else if (state === 'background') scheduleInactivityReminder().catch(() => {});
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!response) return;
    const key = `${response.notification.request.identifier}:${response.actionIdentifier}`;
    if (handledRef.current === key) return;
    handledRef.current = key;
    handleReminderResponse(response).then((openList) => {
      if (openList) router.navigate('/list');
    });
  }, [response, router]);

  return (
    <ThemeProvider value={DefaultTheme}>
      <AnimatedSplashOverlay />
      <AppTabs />
    </ThemeProvider>
  );
}
