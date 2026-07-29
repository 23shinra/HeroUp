import { useState } from "react";
import { Modal } from "../../components/Modal.jsx";
import { Icon } from "../../components/Icon.jsx";
import { PRAISE_PRESETS } from "@domain/attendance";
import { escapeHtml } from "../../lib/format.js";

export function ApproveSheet({ att, open, onClose, onConfirm }) {
  const [praise, setPraise] = useState("");
  const [mvp, setMvp] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!att) return null;

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm({ praise: praise.trim(), mvp });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={<><Icon name="check" size={18} color="var(--green)" /> Подтвердить: {escapeHtml(att.childName || att.name || "")}</>}
    >
      <div className="label">Похвала (по желанию)</div>
      <div className="praise-picker">
        {PRAISE_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            className={`praise-chip${praise === p ? " praise-chip--on" : ""}`}
            onClick={() => setPraise(p)}
          >
            {p}
          </button>
        ))}
      </div>
      <input
        className="input"
        maxLength={80}
        placeholder="Или напиши свой отзыв…"
        style={{ marginTop: 10 }}
        value={praise}
        onChange={(e) => setPraise(e.target.value)}
      />
      <label className="mvp-toggle" style={{ marginTop: 14, display: "flex", gap: 8, alignItems: "center" }}>
        <input type="checkbox" checked={mvp} onChange={(e) => setMvp(e.target.checked)} />
        <span><Icon name="medal" size={16} color="var(--gold)" /> Отметить как MVP тренировки</span>
      </label>
      <button type="button" className="btn btn--gold btn--icon" style={{ marginTop: 16, width: "100%" }} disabled={busy} onClick={confirm}>
        <Icon name="check" size={18} /> Подтвердить
      </button>
    </Modal>
  );
}
