import { SHApi } from "../sync/index.js";
import {
  attendanceForToday,
  checkinStatus,
  windowForDate,
  trainingSchedule,
} from "../attendance/index.js";

export const REMINDERS_KEY = "sporthero.reminders";
export const REMINDERS_PROMPT_KEY = "sporthero.remPrompt";

let timers = [];

export function remindersEnabled() {
  try { return localStorage.getItem(REMINDERS_KEY) === "1"; } catch { return false; }
}

export function remindersOptedOut() {
  try { return localStorage.getItem(REMINDERS_KEY) === "0"; } catch { return false; }
}

export function setRemindersEnabled(v) {
  try { localStorage.setItem(REMINDERS_KEY, v ? "1" : "0"); } catch { /* ignore */ }
  if (!v) clearReminders();
}

export function clearReminders() {
  timers.forEach(clearTimeout);
  timers = [];
}

function notify(title, body) {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/assets/icon-192.png" });
    }
  } catch { /* ignore */ }
}

export function remindersFullyOn() {
  return remindersEnabled()
    && typeof Notification !== "undefined"
    && Notification.permission === "granted";
}

export function remindersShouldPrompt(role) {
  if (role !== "child") return false;
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "denied") return false;
  if (remindersOptedOut()) return false;
  return !remindersFullyOn();
}

export function ensureRemindersDefault(role) {
  if (role !== "child" || remindersOptedOut()) return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  if (!remindersEnabled()) setRemindersEnabled(true);
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function syncPushSubscription(enable) {
  if (!("serviceWorker" in navigator) || !window.PushManager) return false;
  const reg = await navigator.serviceWorker.ready;
  if (!enable) {
    const current = await reg.pushManager.getSubscription();
    if (current) {
      try { await SHApi.pushUnsubscribe(current.endpoint); } catch { /* ignore */ }
      try { await current.unsubscribe(); } catch { /* ignore */ }
    }
    return true;
  }
  let keyData;
  try { keyData = await SHApi.pushVapidKey(); } catch { return false; }
  if (!keyData?.publicKey) return false;
  const appKey = urlBase64ToUint8Array(keyData.publicKey);
  let sub = await reg.pushManager.getSubscription();
  // Если ключ сменился — старая подписка невалидна, пересоздаём.
  if (sub) {
    try {
      const existing = sub.options && sub.options.applicationServerKey;
      const same = existing
        && existing.byteLength === appKey.byteLength
        && Array.from(new Uint8Array(existing)).every((b, i) => b === appKey[i]);
      if (!same) {
        try { await SHApi.pushUnsubscribe(sub.endpoint); } catch { /* ignore */ }
        try { await sub.unsubscribe(); } catch { /* ignore */ }
        sub = null;
      }
    } catch {
      try { await sub.unsubscribe(); } catch { /* ignore */ }
      sub = null;
    }
  }
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: appKey,
    });
  }
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Almaty";
  await SHApi.pushSubscribe(sub.toJSON(), timezone);
  return true;
}

export async function enableReminders() {
  if (typeof Notification === "undefined") {
    return { ok: false, message: "Браузер не поддерживает уведомления" };
  }
  let perm = Notification.permission;
  if (perm === "default") {
    try { perm = await Notification.requestPermission(); } catch { /* ignore */ }
  }
  if (perm !== "granted") {
    return { ok: false, message: "Разреши уведомления в браузере" };
  }
  setRemindersEnabled(true);
  let pushOk = false;
  try { pushOk = await syncPushSubscription(true); } catch { pushOk = false; }
  if (pushOk) {
    try { await SHApi.pushTest(); } catch { /* ignore */ }
  }
  try { new Notification("LevelUp", { body: "Будем напоминать о тренировках!" }); } catch { /* ignore */ }
  return {
    ok: true,
    pushOk,
    message: pushOk ? "Напоминания и Web Push включены" : "Локальные напоминания включены",
  };
}

export function scheduleReminders({ role, hero, myAttendance }) {
  clearReminders();
  if (role !== "child" || !remindersEnabled()) return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

  const now = new Date();
  const sched = trainingSchedule(hero);
  const w = windowForDate(now, sched);
  if (!w) return;

  const pre = w.start.getTime() - 15 * 60000 - now.getTime();
  if (pre > 0 && pre < 24 * 3600000) {
    timers.push(setTimeout(
      () => notify("Скоро тренировка", "Через 15 минут начало — не забудь отметиться!"),
      pre,
    ));
  }

  const evening = w.end.getTime() - 30 * 60000 - now.getTime();
  if (evening > 0 && evening < 24 * 3600000) {
    timers.push(setTimeout(() => {
      const t = attendanceForToday(myAttendance);
      const streak = hero?.streak || 0;
      if ((!t || t.status === "rejected") && streak > 0) {
        notify("Серия под угрозой", `Серия ${streak} дн. — успей отметиться до конца тренировки!`);
      } else if (!t || t.status === "rejected") {
        notify("Отметь тренировку", "Ты на тренировке? Отметься, пока идёт занятие.");
      }
    }, evening));
  }
}

export function shouldShowRemindersPrompt(role) {
  if (!remindersShouldPrompt(role)) return false;
  try { return sessionStorage.getItem(REMINDERS_PROMPT_KEY) !== "1"; } catch { return true; }
}

export function markRemindersPromptShown() {
  try { sessionStorage.setItem(REMINDERS_PROMPT_KEY, "1"); } catch { /* ignore */ }
}
