import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { GAME, CLASS_FEATURE_ENABLED } from "@domain/game-data";
import { statMeta } from "@domain/game-engine";
import { Icon } from "../../components/Icon.jsx";
import { SyncBadge } from "../../components/SyncBadge.jsx";
import { useGameStore } from "../../stores/useGameStore.js";

export default function ClassSelectPage() {
  const navigate = useNavigate();
  const S = useGameStore((s) => s.S);
  const setS = useGameStore((s) => s.setS);
  const toastMsg = useGameStore((s) => s.toastMsg);
  const [draft, setDraft] = useState(null);

  if (!CLASS_FEATURE_ENABLED) {
    return <Navigate to="/skills" replace />;
  }

  const confirm = () => {
    if (!draft) {
      toastMsg("Выбери класс");
      return;
    }
    setS((prev) => ({ ...prev, hero: { ...prev.hero, class: draft } }));
    toastMsg("Класс выбран навсегда!");
    navigate("/skills");
  };

  return (
    <>
      <div className="topbar">
        <div className="topbar__title"><h1>Выбери класс!</h1><small>5 уровень — время специализации</small></div>
        <div className="topbar__actions"><SyncBadge /></div>
      </div>
      <p className="muted">Класс даёт постоянный бонус и суперспособность в бою. Выбор навсегда.</p>
      <div className="section">
        {GAME.classes.map((c) => (
          <button
            key={c.id}
            type="button"
            className="item item--tap"
            style={{ width: "100%", border: draft === c.id ? "2px solid var(--primary)" : undefined, marginBottom: 12 }}
            onClick={() => setDraft(c.id)}
          >
            <div className="item__ico"><Icon name={c.icon} size={24} /></div>
            <div className="item__body" style={{ textAlign: "left" }}>
              <div className="item__title">{c.name}</div>
              <div className="item__sub">{c.power}</div>
              <div className="quest__prog">+{c.bonus} к «{statMeta(c.stat)?.name}»</div>
            </div>
          </button>
        ))}
      </div>
      <button type="button" className="btn btn--icon" disabled={!draft} onClick={confirm}>
        <Icon name="check" size={18} /> Подтвердить класс
      </button>
    </>
  );
}
