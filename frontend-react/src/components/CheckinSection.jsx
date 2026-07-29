import { useEffect, useState } from "react";
import {
  activeEvent,
  attendanceForToday,
  checkinStatus,
  fmtClock,
  fmtDur,
  weeklyGoal,
} from "@domain/attendance";
import { SHApi } from "@domain/sync";
import { Icon } from "./Icon.jsx";
import { escapeHtml, todayKey } from "../lib/format.js";
import { useGameStore } from "../stores/useGameStore.js";

export function CheckinSection() {
  const S = useGameStore((s) => s.S);
  const myAttendance = useGameStore((s) => s.myAttendance);
  const toastMsg = useGameStore((s) => s.toastMsg);
  const upsertAttendance = useGameStore((s) => s.upsertAttendance);

  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  const h = S.hero;
  const st = checkinStatus(h);
  const today = attendanceForToday(myAttendance);
  const status = today?.status || null;
  const leaveStatus = today?.leave_status || null;
  const event = activeEvent();
  const goal = weeklyGoal(h, myAttendance);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  void tick;

  const onCheckIn = async () => {
    if (!st.active) {
      toastMsg("Отметиться можно во время тренировки");
      return;
    }
    if (today && (today.status === "pending" || today.status === "approved")) {
      toastMsg("Сегодня уже отмечено");
      return;
    }
    setBusy(true);
    try {
      const d = await SHApi.requestAttendanceQueued(todayKey());
      if (d.attendance) upsertAttendance(d.attendance);
      toastMsg(d.queued ? "Офлайн: заявка уйдёт при появлении сети" : "Заявка отправлена тренеру");
    } catch (e) {
      toastMsg(e.message || "Не удалось отметиться");
    } finally {
      setBusy(false);
    }
  };

  const onLeave = async () => {
    if (!today || today.status !== "approved") {
      toastMsg("Сначала тренер должен подтвердить приход");
      return;
    }
    if (today.leave_status === "pending") {
      toastMsg("Заявка на уход уже отправлена");
      return;
    }
    if (today.leave_status === "approved") {
      toastMsg("Уход уже подтверждён");
      return;
    }
    setBusy(true);
    try {
      const d = await SHApi.requestLeaveAttendanceQueued(todayKey());
      if (d.attendance) upsertAttendance({ ...today, ...d.attendance });
      toastMsg(d.queued ? "Офлайн: заявка уйдёт при появлении сети" : "Заявка на уход отправлена тренеру");
    } catch (e) {
      toastMsg(e.message || "Не удалось отправить заявку");
    } finally {
      setBusy(false);
    }
  };

  let btn;
  let note;

  if (!st.hasSchedule) {
    btn = (
      <button type="button" className="btn btn--icon" disabled>
        <Icon name="calendar" size={18} /> Расписание задаёт тренер
      </button>
    );
  } else if (status === "approved" && leaveStatus === "approved") {
    btn = (
      <button type="button" className="btn btn--icon" disabled>
        <Icon name="check" size={18} /> Уход подтверждён
      </button>
    );
    note = <p className="profile-today__note" style={{ color: "var(--green)" }}>Тренировка завершена</p>;
  } else if (status === "approved" && leaveStatus === "pending") {
    btn = (
      <button type="button" className="btn btn--icon" disabled>
        <Icon name="clock" size={18} /> Ждём подтверждения ухода
      </button>
    );
    note = <p className="profile-today__note" style={{ color: "var(--orange)" }}>Тренер подтвердит уход</p>;
  } else if (status === "approved") {
    btn = (
      <button type="button" className="btn btn--icon btn--accent" disabled={busy} onClick={onLeave}>
        <Icon name="logout" size={18} /> Ушёл с тренировки
      </button>
    );
    note = (
      <>
        <p className="profile-today__note" style={{ color: "var(--green)" }}>Приход подтверждён</p>
        {leaveStatus === "rejected" && (
          <p className="profile-today__note" style={{ color: "var(--red)" }}>Уход отклонён — отправь снова</p>
        )}
      </>
    );
  } else if (status === "pending") {
    btn = (
      <button type="button" className="btn btn--icon" disabled>
        <Icon name="clock" size={18} /> Ждём подтверждения тренера
      </button>
    );
    note = <p className="profile-today__note" style={{ color: "var(--orange)" }}>После подтверждения начислим опыт</p>;
  } else if (st.active) {
    btn = (
      <button type="button" className="btn btn--icon btn--accent" disabled={busy} onClick={onCheckIn}>
        <Icon name="dumbbell" size={18} /> Отметить тренировку
      </button>
    );
    note = (
      <>
        <p className="profile-today__note" style={{ color: "var(--green)" }}>
          <Icon name="clock" size={13} color="var(--green)" /> Идёт тренировка · <b>{fmtClock(st.msLeft)}</b>
        </p>
        {status === "rejected" && (
          <p className="profile-today__note" style={{ color: "var(--red)" }}>Заявка отклонена — отметься снова</p>
        )}
      </>
    );
  } else {
    btn = (
      <button type="button" className="btn btn--icon" disabled>
        <Icon name="lock" size={18} /> Отметить можно во время тренировки
      </button>
    );
    note = st.next
      ? <p className="profile-today__note muted">До тренировки <b>{fmtDur(st.next - Date.now())}</b></p>
      : <p className="profile-today__note muted">Ближайших тренировок нет</p>;
  }

  return (
    <section className="section profile-group profile-today" id="checkinSection" aria-labelledby="profileTodayTitle">
      <div className="profile-group__head">
        <h2 id="profileTodayTitle" className="row">
          <Icon name="dumbbell" size={18} color="var(--orange)" /> Сегодня
        </h2>
        <span className="small muted">Тренировка</span>
      </div>
      {btn}
      {note}
      {event && (
        <div className="event-banner">
          <Icon name={event.icon || "sparkles"} size={16} color="var(--gold)" />
          {" "}
          <span>
            {escapeHtml(event.name)}
            {event.xpMult && event.xpMult > 1 ? ` · ×${event.xpMult} XP` : ""}
          </span>
        </div>
      )}
      {goal.target > 0 && (
        <div className="wgoal" style={{ marginTop: 12 }}>
          <div className="row between small" style={{ marginBottom: 6 }}>
            <span className="row" style={{ gap: 6 }}>
              <Icon name="target" size={14} color="var(--primary)" /> Цель недели
            </span>
            <b>{goal.done}/{goal.target}{goal.done >= goal.target ? " ✓" : ""}</b>
          </div>
          <div className="bar">
            <div
              className="bar__fill"
              style={{
                width: `${Math.min(100, Math.round((goal.done / goal.target) * 100))}%`,
                background: goal.done >= goal.target ? "var(--green)" : "var(--primary)",
              }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
