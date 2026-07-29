import { useState } from "react";
import { Modal } from "./Modal.jsx";
import { Icon } from "./Icon.jsx";
import { enableReminders, markRemindersPromptShown } from "@domain/reminders";

export function RemindersModal({ open, onClose }) {
  const [busy, setBusy] = useState(false);

  const handleLater = () => {
    markRemindersPromptShown();
    onClose?.();
  };

  const handleEnable = async () => {
    setBusy(true);
    markRemindersPromptShown();
    const r = await enableReminders();
    setBusy(false);
    if (r.ok) onClose?.(r.message);
    else onClose?.(r.message, false);
  };

  return (
    <Modal
      open={open}
      onClose={handleLater}
      title={<><Icon name="clock" size={18} color="var(--orange)" /> Напоминания</>}
    >
      <p style={{ margin: "0 0 10px" }}>Давай включим напоминания о тренировках?</p>
      <p className="small muted" style={{ margin: "0 0 14px" }}>
        Напомним за 15 минут до занятия и если серия под угрозой — даже когда приложение закрыто.
      </p>
      <button type="button" className="btn btn--accent btn--icon" style={{ width: "100%" }} disabled={busy} onClick={handleEnable}>
        <Icon name="check" size={16} /> Включить
      </button>
      <div className="spacer" />
      <button type="button" className="btn btn--ghost" style={{ width: "100%" }} onClick={handleLater}>
        Позже
      </button>
    </Modal>
  );
}
