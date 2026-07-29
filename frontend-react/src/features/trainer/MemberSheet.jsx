import { useEffect, useState } from "react";
import { xpToNext } from "@domain/game-data";
import { sportMeta, eloOf } from "@domain/game-engine";
import {
  WEEK_DAYS, addMinutes, normSlot, toMin,
} from "@domain/attendance";
import { SHApi } from "@domain/sync";
import { Modal } from "../../components/Modal.jsx";
import { Icon } from "../../components/Icon.jsx";
import { escapeHtml } from "../../lib/format.js";

function statsGrid(stats) {
  const ids = [
    { id: "str", name: "Сила", icon: "strength" },
    { id: "spd", name: "Скорость", icon: "speed" },
    { id: "end", name: "Выносливость", icon: "endurance" },
    { id: "int", name: "Интеллект", icon: "intellect" },
    { id: "team", name: "Командность", icon: "team" },
  ];
  return (
    <div className="stats-grid">
      {ids.map((s) => (
        <div key={s.id} className="stat-cell">
          <Icon name={s.icon} size={16} />
          <span>{s.name}</span>
          <b>{stats?.[s.id] || 0}</b>
        </div>
      ))}
    </div>
  );
}

export function MemberSheet({ member, open, onClose, onSaved, toastMsg }) {
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(false);

  const m = member;
  const sport = m ? sportMeta(m.sport) : null;

  useEffect(() => {
    if (!m || !open) return;
    const d = {};
    Object.keys(m.schedule || {}).forEach((k) => { d[k] = normSlot(m.schedule[k]); });
    setDraft(d);
  }, [m?.id, open]);

  if (!m) return null;

  const toggleDay = (dayI) => {
    setDraft((prev) => {
      const next = { ...prev };
      if (next[dayI] != null) delete next[dayI];
      else next[dayI] = { from: "18:00", to: "19:30" };
      return next;
    });
  };

  const setTime = (dayI, kind, val) => {
    setDraft((prev) => {
      const slot = { ...(prev[dayI] || { from: "18:00", to: "19:30" }) };
      slot[kind] = val;
      if (kind === "from" && toMin(slot.to) <= toMin(val)) {
        slot.to = addMinutes(val, 60);
      }
      if (kind === "to" && toMin(val) <= toMin(slot.from)) {
        slot.to = addMinutes(slot.from, 60);
      }
      return { ...prev, [dayI]: slot };
    });
  };

  const saveSchedule = async (all = false) => {
    setBusy(true);
    try {
      if (all) await SHApi.setGuildSchedule(draft);
      else await SHApi.setMemberSchedule(m.id, draft);
      toastMsg(all ? "Расписание применено всем" : "Расписание сохранено");
      onSaved?.();
    } catch (e) {
      toastMsg(e.message || "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  };

  const transfer = async () => {
    const code = window.prompt("Код гильдии для перевода:");
    if (!code?.trim()) return;
    setBusy(true);
    try {
      await SHApi.transferGuildMember(m.id, code.trim().toUpperCase());
      toastMsg("Ребёнок переведён");
      onSaved?.();
      onClose();
    } catch (e) {
      toastMsg(e.message || "Не удалось перевести");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Убрать ${m.name} из гильдии?`)) return;
    setBusy(true);
    try {
      await SHApi.removeGuildMember(m.id);
      toastMsg("Ребёнок удалён из гильдии");
      onSaved?.();
      onClose();
    } catch (e) {
      toastMsg(e.message || "Не удалось удалить");
    } finally {
      setBusy(false);
    }
  };

  const need = xpToNext(m.level || 1);
  const pct = Math.round(((m.xp || 0) / need) * 100);

  return (
    <Modal open={open} onClose={onClose} title={<><Icon name="user" size={20} /> {escapeHtml(m.name)}</>}>
      <div className="pill-row" style={{ marginBottom: 12 }}>
        <span className="chip chip--gold"><Icon name="star" size={14} color="var(--gold)" /> LVL {m.level}</span>
        <span className="chip"><Icon name="flame" size={14} color="var(--orange)" /> {m.streak || 0} дней</span>
        <span className="chip"><Icon name="dumbbell" size={14} /> {m.trainings || 0} трен.</span>
        <span className="chip"><Icon name="elo" size={14} color="#FF5500" /> {eloOf(m.trophies)}</span>
        {sport && <span className="chip"><Icon name={sport.icon} size={14} /> {sport.name}</span>}
      </div>
      <div className="row between small" style={{ marginBottom: 6 }}><span>Опыт</span><span>{m.xp}/{need} XP</span></div>
      <div className="bar bar--xp"><div className="bar__fill" style={{ width: `${Math.min(100, pct)}%` }} /></div>

      <h3 className="row" style={{ gap: 8, fontSize: 14, margin: "16px 0 8px" }}>
        <Icon name="strength" size={16} color="var(--orange)" /> Характеристики
        {m.statPoints ? <span className="small muted">({m.statPoints} очков не распределено)</span> : null}
      </h3>
      {statsGrid(m.stats)}

      <h3 className="row" style={{ gap: 8, fontSize: 14, margin: "16px 0 8px" }}>
        <Icon name="calendar" size={16} color="var(--primary)" /> Расписание
      </h3>
      <p className="small muted" style={{ margin: "0 0 8px" }}>Отметь дни и время тренировок — ребёнок увидит их у себя.</p>
      <div className="week-cal">
        {WEEK_DAYS.map((d) => {
          const on = draft[d.i] != null;
          return (
            <button key={d.i} type="button" className={`day-cell${on ? " day-cell--on" : ""}`} onClick={() => toggleDay(String(d.i))}>
              <span className="day-cell__name">{d.name}</span>
              <span className="day-cell__time">{on ? draft[d.i].from : "—"}</span>
            </button>
          );
        })}
      </div>
      <div className="sched-times" style={{ marginTop: 10 }}>
        {WEEK_DAYS.filter((d) => draft[d.i] != null).map((d) => (
          <div key={d.i} className="sched-row row between" style={{ marginBottom: 8 }}>
            <span>{d.name}</span>
            <span className="timerange row" style={{ gap: 6 }}>
              <input type="time" value={draft[d.i].from} onChange={(e) => setTime(String(d.i), "from", e.target.value)} />
              <span>—</span>
              <input type="time" value={draft[d.i].to} onChange={(e) => setTime(String(d.i), "to", e.target.value)} />
            </span>
          </div>
        ))}
      </div>
      <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <button type="button" className="btn btn--icon" disabled={busy} onClick={() => saveSchedule(false)}>
          <Icon name="check" size={18} /> Сохранить расписание
        </button>
        <button type="button" className="btn btn--ghost btn--icon" disabled={busy} onClick={() => saveSchedule(true)}>
          <Icon name="calendar" size={16} /> Применить всем детям
        </button>
      </div>
      <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <button type="button" className="btn btn--ghost btn--icon" disabled={busy} onClick={transfer}>
          <Icon name="arrowR" size={16} /> Перевести в другую гильдию
        </button>
        <button type="button" className="btn btn--ghost btn--icon" disabled={busy} onClick={remove}>
          <Icon name="close" size={16} /> Убрать из гильдии
        </button>
      </div>
    </Modal>
  );
}
