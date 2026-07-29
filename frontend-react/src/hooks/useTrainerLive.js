import { useCallback } from "react";
import { useGameStore } from "../stores/useGameStore.js";
import { useSseChannel } from "./useSseChannel.js";

export function useTrainerLive(onRefresh) {
  const S = useGameStore((s) => s.S);
  const enabled = S.role === "trainer" && S.auth?.loggedIn;

  const onUpdate = useCallback(() => {
    if (onRefresh) onRefresh();
  }, [onRefresh]);

  useSseChannel("/api/guild/events", { enabled, onEvent: onUpdate });
}
