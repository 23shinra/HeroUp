import { useEffect, useState } from "react";
import { useGameStore } from "../stores/useGameStore.js";
import {
  ensureRemindersDefault,
  enableReminders,
  remindersFullyOn,
  scheduleReminders,
  setRemindersEnabled,
  shouldShowRemindersPrompt,
  syncPushSubscription,
} from "@domain/reminders";
import { RemindersModal } from "../components/RemindersModal.jsx";

export function useRemindersBoot() {
  const S = useGameStore((s) => s.S);
  const myAttendance = useGameStore((s) => s.myAttendance);
  const toastMsg = useGameStore((s) => s.toastMsg);
  const booted = useGameStore((s) => s.booted);
  const [promptOpen, setPromptOpen] = useState(false);

  useEffect(() => {
    if (!booted || S.role !== "child" || !S.auth?.loggedIn) return;
    ensureRemindersDefault(S.role);
    scheduleReminders({ role: S.role, hero: S.hero, myAttendance });
    // Re-sync Web Push when already on (VAPID/keys may have changed).
    if (remindersFullyOn()) {
      syncPushSubscription(true).catch(() => {});
    }
  }, [booted, S.role, S.auth?.loggedIn, S.hero?.schedule, S.hero?.streak, myAttendance]);

  useEffect(() => {
    if (!booted || S.role !== "child" || !S.auth?.loggedIn) return;
    if (!shouldShowRemindersPrompt(S.role)) return;
    const t = setTimeout(() => {
      if (shouldShowRemindersPrompt(S.role)) setPromptOpen(true);
    }, 700);
    return () => clearTimeout(t);
  }, [booted, S.role, S.auth?.loggedIn]);

  const modal = (
    <RemindersModal
      open={promptOpen}
      onClose={(msg, ok = true) => {
        setPromptOpen(false);
        if (msg) toastMsg(msg, ok ? 2800 : 3200);
        scheduleReminders({ role: S.role, hero: S.hero, myAttendance });
      }}
    />
  );

  return { modal, remindersOn: remindersFullyOn() };
}

export async function toggleReminders(enabled, toastMsg) {
  if (enabled) {
    const r = await enableReminders();
    toastMsg(r.message);
    return r.ok;
  }
  setRemindersEnabled(false);
  try { await syncPushSubscription(false); } catch { /* ignore */ }
  toastMsg("Напоминания отключены");
  return false;
}
