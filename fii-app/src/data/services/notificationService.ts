import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type { DividendCalendarEvent } from "../../domain/rules/dividendCalendar";

const DIVIDEND_CHANNEL_ID = "dividend-alerts";
const DIVIDEND_IDS_KEY = "notifications:dividend:ids:v1";

let configured = false;

export function configureNotificationHandler(): void {
  if (configured) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  configured = true;
}

async function ensurePermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(DIVIDEND_CHANNEL_ID, {
    name: "Agenda de dividendos",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: "default",
  });
}

async function readScheduledIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(DIVIDEND_IDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeScheduledIds(ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(DIVIDEND_IDS_KEY, JSON.stringify(ids));
  } catch {
    // ignore local storage errors
  }
}

function buildTriggerDate(paymentDateIso: string): Date | null {
  const paymentDate = new Date(paymentDateIso);
  if (Number.isNaN(paymentDate.getTime())) return null;

  const trigger = new Date(paymentDate);
  trigger.setDate(trigger.getDate() - 1);
  trigger.setHours(9, 0, 0, 0);

  if (trigger.getTime() <= Date.now()) return null;
  return trigger;
}

function toCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export async function clearDividendNotifications(): Promise<void> {
  const ids = await readScheduledIds();
  if (ids.length > 0) {
    await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
  }
  await writeScheduledIds([]);
}

export async function scheduleDividendNotifications(
  events: DividendCalendarEvent[]
): Promise<{ ok: boolean; message: string; scheduledCount: number }> {
  configureNotificationHandler();
  const allowed = await ensurePermission();
  if (!allowed) {
    return {
      ok: false,
      message: "Permissão de notificação negada.",
      scheduledCount: 0,
    };
  }

  await ensureAndroidChannel();
  await clearDividendNotifications();

  const scheduled: string[] = [];
  const uniqueByTickerDate = new Set<string>();

  for (const event of events) {
    if (scheduled.length >= 20) break;

    const dedupe = `${event.ticker}:${event.paymentDateIso.slice(0, 10)}`;
    if (uniqueByTickerDate.has(dedupe)) continue;
    uniqueByTickerDate.add(dedupe);

    const triggerDate = buildTriggerDate(event.paymentDateIso);
    if (!triggerDate) continue;

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Lembrete de dividendos: ${event.ticker}`,
        body: `Pagamento previsto para ${new Date(event.paymentDateIso).toLocaleDateString(
          "pt-BR"
        )}. Estimativa por cota: ${toCurrency(event.estimatedPerEvent)}.`,
        data: {
          ticker: event.ticker,
          paymentDateIso: event.paymentDateIso,
          type: "DIVIDEND_REMINDER",
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
        channelId: Platform.OS === "android" ? DIVIDEND_CHANNEL_ID : undefined,
      },
    });

    scheduled.push(identifier);
  }

  await writeScheduledIds(scheduled);

  if (scheduled.length === 0) {
    return {
      ok: false,
      message: "Não encontramos eventos futuros para notificar.",
      scheduledCount: 0,
    };
  }

  return {
    ok: true,
    message: `${scheduled.length} lembrete(s) agendado(s) para a agenda de dividendos.`,
    scheduledCount: scheduled.length,
  };
}
