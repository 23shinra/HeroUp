import { useEffect, useRef } from "react";
import { SHApi } from "@domain/sync";

/**
 * Generic EventSource hook with token query param and cleanup on unmount.
 */
export function useSseChannel(path, { enabled = true, event = "update", onEvent } = {}) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (!enabled || !path || typeof EventSource === "undefined") return undefined;
    const token = SHApi.getToken();
    if (!token) return undefined;

    const url = `${path}${path.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);

    const handler = () => {
      if (handlerRef.current) handlerRef.current();
    };
    es.addEventListener(event, handler);

    return () => {
      es.removeEventListener(event, handler);
      es.close();
    };
  }, [path, enabled, event]);
}
