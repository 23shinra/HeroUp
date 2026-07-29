import { useCallback } from "react";
import { useGameStore } from "../stores/useGameStore.js";
import { useSseChannel } from "./useSseChannel.js";
import { showAttendanceToasts } from "../lib/attendanceToasts.js";

export function useChildLive() {
  const S = useGameStore((s) => s.S);
  const syncAttendance = useGameStore((s) => s.syncAttendance);
  const toastMsg = useGameStore((s) => s.toastMsg);
  const ensureQuests = useGameStore((s) => s.ensureQuests);
  const enabled = S.role !== "trainer" && S.auth?.loggedIn;

  const onUpdate = useCallback(async () => {
    ensureQuests();
    const { applied } = await syncAttendance();
    showAttendanceToasts(applied, toastMsg);
  }, [syncAttendance, toastMsg, ensureQuests]);

  useSseChannel("/api/child/events", { enabled, onEvent: onUpdate });

  return { toastMsg };
}
