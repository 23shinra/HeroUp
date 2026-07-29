import { useMemo, useState } from "react";
import { Icon } from "../../components/Icon.jsx";
import { Modal } from "../../components/Modal.jsx";
import {
  formatAttClock,
  formatAttDayLabel,
  formatISODateLocal,
  parseISODateLocal,
  pluralRu,
} from "../../lib/format.js";

const DOW = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

function dayStatus(hit) {
  if (!hit) return null;
  if (hit.status) return hit.status;
  if (hit.pending) return "pending";
  if (hit.training) return "approved";
  return null;
}

export function TrainCalendar({ days = [] }) {
  const [selected, setSelected] = useState(null);

  const model = useMemo(() => {
    if (!days.length) return null;
    const byDate = new Map(days.map((d) => [d.date, d]));
    const anchor = parseISODateLocal(days[0].date);
    if (!anchor) return null;

    const year = anchor.getFullYear();
    const month = anchor.getMonth();
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    const todayIso = formatISODateLocal(new Date());

    const gridStart = new Date(monthStart);
    gridStart.setDate(gridStart.getDate() - ((monthStart.getDay() + 6) % 7));
    const gridEnd = new Date(monthEnd);
    gridEnd.setDate(gridEnd.getDate() + (6 - ((monthEnd.getDay() + 6) % 7)));

    const cells = [];
    for (let cur = new Date(gridStart); cur <= gridEnd; cur.setDate(cur.getDate() + 1)) {
      const iso = formatISODateLocal(cur);
      const inMonth = cur.getMonth() === month;
      const hit = byDate.get(iso);
      const status = dayStatus(hit);
      const approved = status === "approved";
      const pending = status === "pending";
      const isToday = iso === todayIso;
      let cls = "train-cal__day";
      if (!inMonth) cls += " is-out";
      else if (approved) cls += " is-on";
      else if (pending) cls += " is-pending";
      else cls += " is-off";
      if (isToday) cls += " is-today";

      const arrived = formatAttClock(hit?.arrivedAt);
      let title = "";
      if (!inMonth) title = "";
      else if (approved) title = arrived ? `Пришёл в ${arrived}` : "Тренировка подтверждена";
      else if (pending) title = arrived ? `Отметился в ${arrived} · ждёт тренера` : "Ждёт подтверждения тренера";
      else title = `${cur.getDate()} ${MONTHS[month]}: нет тренировки`;

      const interactive = inMonth && (approved || pending);
      cells.push({
        key: iso,
        day: cur.getDate(),
        cls,
        title,
        interactive,
        hit: interactive ? interactivePayload(hit, status, iso) : null,
      });
    }

    const trainedCount = days.filter((d) => d.status === "approved" || d.training).length;
    const pendingCount = days.filter((d) => d.status === "pending" || d.pending).length;
    const trainWord = pluralRu(trainedCount, "тренировка", "тренировки", "тренировок");
    const countLabel = pendingCount
      ? `${trainedCount} ${trainWord} · ${pendingCount} ждут`
      : `${trainedCount} ${trainWord}`;

    return { year, month, cells, countLabel };
  }, [days]);

  if (!days.length) {
    return (
      <div className="train-cal">
        <div className="train-cal__empty muted">Нет дней в периоде</div>
      </div>
    );
  }

  if (!model) return null;

  return (
    <>
      <div className="train-cal" aria-label="Календарь тренировок">
        <div className="train-cal__head">
          <div className="train-cal__title">{MONTHS[model.month]} {model.year}</div>
          <div className="train-cal__count">{model.countLabel}</div>
        </div>
        <div className="train-cal__dows" aria-hidden="true">
          {DOW.map((d) => <span key={d}>{d}</span>)}
        </div>
        <div className="train-cal__grid">
          {model.cells.map((c) => (
            <div
              key={c.key}
              className={c.cls}
              title={c.title}
              aria-label={c.title || "другой месяц"}
              role={c.interactive ? "button" : undefined}
              tabIndex={c.interactive ? 0 : undefined}
              onClick={() => { if (c.interactive) setSelected(c.hit); }}
              onKeyDown={(e) => {
                if (!c.interactive) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelected(c.hit);
                }
              }}
            >
              <span>{c.day}</span>
            </div>
          ))}
        </div>
      </div>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={<><Icon name="calendar" size={18} color="var(--green)" /> Тренировка</>}
      >
        {selected && <TrainDayDetail day={selected} />}
      </Modal>
    </>
  );
}

function interactivePayload(hit, status, iso) {
  if (!hit) return { date: iso, status };
  return {
    date: iso,
    status,
    arrivedAt: hit.arrivedAt || null,
    decidedAt: hit.decidedAt || null,
    praise: hit.praise || null,
    mvp: !!hit.mvp,
  };
}

function TrainDayDetail({ day }) {
  const arrived = formatAttClock(day.arrivedAt);
  const decided = formatAttClock(day.decidedAt);
  const pending = day.status === "pending";
  return (
    <div className="train-day">
      <div className="train-day__date">{formatAttDayLabel(day.date)}</div>
      {pending ? (
        <div className="train-day__status is-pending">
          <Icon name="clock" size={16} color="var(--gold)" /> Ждёт подтверждения тренера
        </div>
      ) : (
        <div className="train-day__status is-on">
          <Icon name="check" size={16} color="var(--green)" /> Тренировка подтверждена
        </div>
      )}
      <div className="train-day__rows">
        <div className="train-day__row"><span>Пришёл</span><b>{arrived || "—"}</b></div>
        {!pending && (
          <div className="train-day__row"><span>Подтверждено</span><b>{decided || "—"}</b></div>
        )}
        {day.mvp ? <div className="train-day__row"><span>MVP</span><b>Да</b></div> : null}
        {day.praise ? (
          <div className="train-day__praise">
            <Icon name="badge" size={16} color="var(--gold)" /> «{day.praise}»
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Offline fallback when /progress/summary is unavailable. */
export function localProgressSummary({ myAttendance = [], battles = [], hero, period = "month" }) {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const dates = [];
  for (let d = new Date(from); d <= last; d.setDate(d.getDate() + 1)) {
    dates.push(formatISODateLocal(d));
  }
  const set = new Set(dates);
  const week = myAttendance.filter((a) => set.has(a.date));
  const approved = week.filter((a) => a.status === "approved");
  const pending = week.filter((a) => a.status === "pending").length;
  const monthBattles = (battles || []).filter((b) => b && set.has(b.date));
  return {
    period,
    from: dates[0],
    to: dates[dates.length - 1],
    trainings: approved.length,
    pending,
    praises: approved.filter((a) => a.praise || a.mvp).length,
    battles: monthBattles.length,
    wins: monthBattles.filter((b) => b.win).length,
    losses: monthBattles.filter((b) => !b.win).length,
    levelStart: hero?.level || 1,
    levelEnd: hero?.level || 1,
    levelDelta: 0,
    scheduleDays: 0,
    scheduleDone: approved.length,
    days: dates.map((day) => {
      const att = week.find((a) => a.date === day);
      const dayBattles = monthBattles.filter((b) => b.date === day);
      const status = att ? att.status : null;
      return {
        date: day,
        status,
        training: status === "approved" ? 1 : 0,
        pending: status === "pending" ? 1 : 0,
        arrivedAt: att ? (att.created_at || att.arrivedAt || null) : null,
        decidedAt: att ? (att.decided_at || att.decidedAt || null) : null,
        praise: att?.praise || null,
        mvp: !!(att && att.mvp),
        battles: dayBattles.length,
        wins: dayBattles.filter((b) => b.win).length,
        level: null,
      };
    }),
    offline: true,
  };
}
