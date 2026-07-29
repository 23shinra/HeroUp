import { useSyncStatus } from "../hooks/useSyncStatus.js";
import { useUiStore } from "../stores/useUiStore.js";
import { Icon } from "./Icon.jsx";
import { Modal } from "./Modal.jsx";

export function SyncBadge() {
  const { online, pending, flushing } = useSyncStatus();
  const setSyncModalOpen = useUiStore((s) => s.setSyncModalOpen);

  let className = "sync-badge sync-badge--online sync-badge--icon sync-badge--tap";
  let label = "Есть подключение к сети";
  if (!online) {
    className = "sync-badge sync-badge--offline sync-badge--icon sync-badge--tap";
    label = "Нет сети. Нажмите, чтобы узнать подробности";
  } else if (flushing) {
    className = "sync-badge sync-badge--syncing sync-badge--icon sync-badge--tap";
    label = "Идёт синхронизация";
  } else if (pending > 0) {
    className = "sync-badge sync-badge--pending sync-badge--icon sync-badge--tap";
    label = "Есть неотправленные данные";
  }

  return (
    <button
      type="button"
      id="syncBadge"
      className={className}
      aria-live="polite"
      aria-label={label}
      onClick={() => setSyncModalOpen(true)}
    >
      <Icon name={online ? "wifi" : "wifiOff"} size={16} />
      {pending > 0 && !flushing && <span className="sync-badge__count">{pending}</span>}
    </button>
  );
}

export function SyncStatusModal() {
  const open = useUiStore((s) => s.syncModalOpen);
  const setSyncModalOpen = useUiStore((s) => s.setSyncModalOpen);
  const { online, pending, flushing } = useSyncStatus();

  let title = "Есть сеть";
  let lead = "Подключение есть — прогресс синхронизируется сразу.";
  if (!online) {
    title = "Нет сети";
    lead = "После подключения к интернету данные отправятся.";
  } else if (flushing) {
    title = "Синхронизация";
    lead = "Сейчас отправляем сохранённые изменения на сервер.";
  } else if (pending > 0) {
    title = "Ожидает отправки";
    lead = `В очереди ${pending}. Данные уйдут при стабильной сети.`;
  }

  return (
    <Modal
      open={open}
      onClose={() => setSyncModalOpen(false)}
      title={
        <>
          <Icon name={online ? "wifi" : "wifiOff"} size={22} color={online ? "var(--green)" : "var(--red)"} />
          {title}
        </>
      }
    >
      <p style={{ margin: 0, lineHeight: 1.45 }}>{lead}</p>
      {!online && pending > 0 && (
        <p className="small muted" style={{ marginTop: 10 }}>В очереди: {pending}</p>
      )}
    </Modal>
  );
}
