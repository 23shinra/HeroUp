import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { checkinStatus, fmtDur } from "@domain/attendance";
import { sportMeta } from "@domain/game-engine";
import { escapeHtml, formatAttDayLabel } from "../../lib/format.js";
import { useGameStore } from "../../stores/useGameStore.js";

export default function ParentPage() {
  const navigate = useNavigate();
  const S = useGameStore((s) => s.S);
  const myAttendance = useGameStore((s) => s.myAttendance);
  const h = S.hero;
  const st = S.stats;
  const total = (st.wins || 0) + (st.losses || 0);
  const wr = total ? Math.round((st.wins / total) * 100) : 0;
  const sport = sportMeta(h.sport);
  const praise = myAttendance.filter((a) => a.status === "approved" && (a.praise || a.mvp)).slice(0, 4);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  void tick;

  const next = checkinStatus(h);

  return (
    <>
      <div className="topbar">
        <div className="topbar__title">
          <h1>Отчёт для родителя</h1>
          <small>{escapeHtml(h.name)} · {sport?.name}</small>
        </div>
        <div className="topbar__actions">
          <SyncBadge />
          <button type="button" className="icon-btn" aria-label="Назад" onClick={() => navigate("/profile")}>
            <Icon name="arrowL" size={20} />
          </button>
        </div>
      </div>

      <div className="section">
        <div className="card">
          <div className="row between"><span>Уровень</span><b>{h.level}</b></div>
          <div className="divider" />
          <div className="row between"><span>Тренировок подтверждено</span><b>{st.trainings || 0}</b></div>
          <div className="divider" />
          <div className="row between"><span>Текущая серия</span><b>{h.streak || 0} дней</b></div>
          <div className="divider" />
          <div className="row between"><span>Победы / Поражения</span><b>{st.wins}/{st.losses} ({wr}%)</b></div>
        </div>
      </div>

      <div className="section">
        <h2 className="row" style={{ gap: 8 }}><Icon name="calendar" size={16} /> Ближайшая тренировка</h2>
        <div className="card center">
          {next.next ? `Через ${fmtDur(next.next - Date.now())}` : "Расписание пока не задано тренером"}
        </div>
      </div>

      {praise.length > 0 && (
        <div className="section">
          <h2 className="row" style={{ gap: 8 }}><Icon name="badge" size={18} color="var(--gold)" /> Отзывы тренера</h2>
          {praise.map((a) => (
            <div key={a.date} className="praise-row">
              <span className="praise-row__date">{formatAttDayLabel(a.date) || a.date}</span>
              <span className="praise-row__text">
                {a.mvp ? <><b>MVP </b></> : null}
                {a.praise || "Отличная работа!"}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
