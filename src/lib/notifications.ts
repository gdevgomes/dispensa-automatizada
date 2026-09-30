import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { Palette } from '@/constants/theme';
import { formatDate } from '@/lib/expiry';
import { setItemExists, type ListItem } from '@/lib/shopping-list-storage';

const CHANNEL_ID = 'consumption';
const CATEGORY_ID = 'consumption-check';
const ACTION_CONSUMED = 'consumed';
const ACTION_STILL_HAVE = 'still-have';

const REMINDER_DAYS_BEFORE_EXPIRY = 7;
const REMINDER_HOUR = 9;
const MIN_DELAY_MS = 60 * 60 * 1000;

/**
 * Modo de teste (env `EXPO_PUBLIC_TEST_REMINDERS=true`): 1 segundo por mês até a validade (ex.: 3 meses = 3s)
 * e inatividade em 15s. Sem a variável, vale o agendamento real. O valor é embutido no build.
 */
const TEST_REMINDERS = process.env.EXPO_PUBLIC_TEST_REMINDERS === 'true';

const BACKGROUND_TASK = 'consumption-reminder-response';
const HANDLED_RESPONSE_KEY = 'last-handled-reminder-response';

const INACTIVITY_ID = 'inactivity-reminder';
const INACTIVITY_DAYS = 15;
const DAY_MS = 24 * 60 * 60 * 1000;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** Cria canal (Android) e categoria com os botões de resposta. Idempotente. */
export async function setupNotifications() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Lembretes de consumo',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: Palette.primary,
    });
  }
  await Notifications.setNotificationCategoryAsync(CATEGORY_ID, [
    { identifier: ACTION_CONSUMED, buttonTitle: 'Sim, já consumi', options: { opensAppToForeground: false } },
    { identifier: ACTION_STILL_HAVE, buttonTitle: 'Ainda tenho', options: { opensAppToForeground: false } },
  ]);
}

async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: false },
  });
  return requested.granted;
}

/** Quando perguntar: 7 dias antes da validade às 9h; se já passou, daqui a 1h. Itens vencidos não geram lembrete. */
function reminderDate(expirationDate: string): Date | null {
  const expiry = new Date(expirationDate);
  const now = Date.now();
  if (expiry.getTime() <= now) return null;

  if (TEST_REMINDERS) {
    const today = new Date(now);
    const months = (expiry.getFullYear() - today.getFullYear()) * 12 + (expiry.getMonth() - today.getMonth());
    return new Date(now + Math.max(months, 1) * 1000);
  }

  const ideal = new Date(expiry);
  ideal.setDate(ideal.getDate() - REMINDER_DAYS_BEFORE_EXPIRY);
  ideal.setHours(REMINDER_HOUR, 0, 0, 0);

  const earliest = now + MIN_DELAY_MS;
  return ideal.getTime() > earliest ? ideal : new Date(earliest);
}

/** Agenda uma notificação local por item perguntando se já foi consumido. */
export async function scheduleConsumptionReminders(items: ListItem[]) {
  if (!(await ensurePermission())) return;
  await setupNotifications();

  for (const item of items) {
    const date = reminderDate(item.expirationDate);
    if (!date) continue;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Você já consumiu este produto?',
        body: `${item.name} vence em ${formatDate(item.expirationDate)}. Toque para abrir a lista.`,
        categoryIdentifier: CATEGORY_ID,
        data: { itemId: item.id },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL_ID },
    });
  }
}

/** Remove os lembretes pendentes de um item (ex.: quando ele já foi marcado como consumido). */
export async function cancelReminderForItem(itemId: string) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.content.data?.itemId === itemId)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

type Listener = () => void;
const changeListeners = new Set<Listener>();

/** Avisa quando uma resposta de notificação alterou a dispensa (para telas abertas recarregarem). */
export function onPantryChangedByReminder(listener: Listener) {
  changeListeners.add(listener);
  return () => {
    changeListeners.delete(listener);
  };
}

/**
 * Trata a resposta do usuário a um lembrete.
 * Retorna true quando o app deve abrir a lista (toque na notificação em si).
 * A última resposta tratada fica salva, então a mesma resposta nunca é aplicada duas vezes
 * (nem entre a tarefa em segundo plano e o hook, nem entre aberturas do app).
 */
export async function handleReminderResponse(response: Notifications.NotificationResponse): Promise<boolean> {
  const itemId = response.notification.request.content.data?.itemId;
  if (typeof itemId !== 'string') return false;

  const key = `${response.notification.request.identifier}:${response.actionIdentifier}`;
  if ((await AsyncStorage.getItem(HANDLED_RESPONSE_KEY)) === key) return false;
  await AsyncStorage.setItem(HANDLED_RESPONSE_KEY, key);

  if (response.actionIdentifier === ACTION_CONSUMED) {
    await setItemExists(itemId, false);
    changeListeners.forEach((listener) => listener());
    return false;
  }
  if (response.actionIdentifier === ACTION_STILL_HAVE) return false;
  return response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER;
}

// Android: executa os botões (opensAppToForeground: false) mesmo com o app em segundo plano ou fechado.
// Precisa ficar no escopo do módulo, que é carregado cedo pelo _layout.
TaskManager.defineTask<Notifications.NotificationTaskPayload>(BACKGROUND_TASK, async ({ data }) => {
  if (data && 'actionIdentifier' in data) {
    await handleReminderResponse(data).catch(() => {});
  }
  return Notifications.BackgroundNotificationTaskResult.NoData;
});

Notifications.registerTaskAsync(BACKGROUND_TASK).catch(() => {});

/** Cancela o lembrete de inatividade (chamar quando o app está aberto/em uso). */
export async function cancelInactivityReminder() {
  await Notifications.cancelScheduledNotificationAsync(INACTIVITY_ID).catch(() => {});
}

/**
 * Agenda o lembrete de inatividade: 15 dias a partir de agora (15s no modo de teste).
 * Chamar quando o app é fechado/vai para segundo plano; usar o mesmo identificador substitui o lembrete anterior.
 */
export async function scheduleInactivityReminder() {
  if (!(await ensurePermission())) return;
  await setupNotifications();
  await Notifications.cancelScheduledNotificationAsync(INACTIVITY_ID).catch(() => {});
  const delayMs = TEST_REMINDERS ? INACTIVITY_DAYS * 1000 : INACTIVITY_DAYS * DAY_MS;
  await Notifications.scheduleNotificationAsync({
    identifier: INACTIVITY_ID,
    content: {
      title: 'Hora de atualizar sua dispensa',
      body: 'Faz tempo que você não abre o app. Confira o que você tem em casa e adicione novos produtos.',
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(Date.now() + delayMs), channelId: CHANNEL_ID },
  });
}
