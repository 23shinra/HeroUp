import { useEffect, useState } from "react";
import { SHApi } from "@domain/sync";

function snapshot(detail) {
  return {
    online: detail && typeof detail.online === "boolean" ? detail.online : SHApi.isOnline(),
    pending: detail && typeof detail.pending === "number" ? detail.pending : SHApi.outboxCount(),
    flushing: !!(detail && detail.flushing),
  };
}

export function useSyncStatus() {
  const [status, setStatus] = useState(() => snapshot());

  useEffect(() => {
    const refresh = (e) => setStatus(snapshot(e?.detail));
    const onOnline = () => {
      refresh();
      if (SHApi.hasToken()) SHApi.flushOutbox().catch(() => {});
    };
    window.addEventListener("sporthero-sync", refresh);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", refresh);
    refresh();
    return () => {
      window.removeEventListener("sporthero-sync", refresh);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", refresh);
    };
  }, []);

  return status;
}
