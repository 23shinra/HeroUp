import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GAME, xpToNext } from "@domain/game-data";
import { SHApi } from "@domain/sync";
import { sportMeta, eloOf } from "@domain/game-engine";
import { guildQrSrc, inviteJoinUrl } from "@domain/attendance";
import { escapeHtml, fmtDateShort, todayKey } from "../../lib/format.js";
import { Icon } from "../../components/Icon.jsx";
import { SyncBadge } from "../../components/SyncBadge.jsx";
import { useTrainerLive } from "../../hooks/useTrainerLive.js";
import { useGameStore } from "../../stores/useGameStore.js";
import { ApproveSheet } from "./ApproveSheet.jsx";
import { MemberSheet } from "./MemberSheet.jsx";

export default function TrainerPage() {
  const navigate = useNavigate();
  const S = useGameStore((s) => s.S);
  const logout = useGameStore((s) => s.logout);
  const toastMsg = useGameStore((s) => s.toastMsg);
  const g = S.guild || {};

  const [tab, setTab] = useState("kids");
  const [members, setMembers] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [weekly, setWeekly] = useState(null);
  const [sportDraft, setSportDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [approveAtt, setApproveAtt] = useState(null);
  const [member, setMember] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, a, info] = await Promise.all([
        SHApi.guildMembers(),
        SHApi.guildAttendance(),
        SHApi.guildInfo().catch(() => ({})),
      ]);
      setMembers(m.members || []);
      setAttendance(a.attendance || []);
      setWeekly(a.weekly || info.weekly || null);
    } catch (e) {
      toastMsg(e.message || "Не удалось загрузить данные");
    } finally {
      setLoading(false);
    }
  }, [toastMsg]);

  useEffect(() => { load(); }, [load]);
  useTrainerLive(load);

  const pendingCheckIn = attendance.filter((x) => x.status === "pending").length;
  const pendingLeave = attendance.filter((x) => x.status === "approved" && x.leave_status === "pending").length;
  const sport = g.sport ? sportMeta(g.sport) : null;
  const pending = attendance.filter((a) => a.status === "pending");
  const decided = attendance.filter((a) => a.status !== "pending").slice(0, 20);
  const pendingLeaveList = attendance.filter((a) => a.status === "approved" && a.leave_status === "pending");
  const decidedLeave = attendance.filter((a) => a.leave_status === "approved" || a.leave_status === "rejected").slice(0, 20);

  const decide = async (id, approve, leave = false, extra) => {
    try {
      if (leave) await SHApi.decideLeaveAttendance(id, approve);
      else await SHApi.decideAttendance(id, approve, extra);
      toastMsg(approve ? "Посещение подтверждено" : "Заявка отклонена");
      load();
    } catch (e) {
      toastMsg(e.message || "Ошибка");
    }
  };

  const approveAll = async () => {
    if (!pending.length) return;
    try {
      await Promise.all(pending.map((a) => SHApi.decideAttendance(a.id, true)));
      toastMsg(`Подтверждено: ${pending.length}`);
      load();
    } catch (e) {
      toastMsg(e.message || "Не удалось подтвердить все");
    }
  };

  const exportCsv = () => {
    const rows = [["date", "child", "status", "leave_status"]]
      .concat(attendance.map((a) => [a.date, a.childName, a.status, a.leave_status || ""]));
    const csv = rows.map((r) => r.map((x) => `"${String(x || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${todayKey()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveSport = async () => {
    if (!sportDraft) return;
    try {
      await SHApi.setGuildSport(sportDraft);
      toastMsg("Секция сохранена");
      load();
    } catch (e) {
      toastMsg(e.message || "Не удалось сохранить");
    }
  };

  const copyCode = () => {
    if (g.code) {
      navigator.clipboard?.writeText(g.code);
      toastMsg("Код скопирован");
    }
  };

  const copyInvite = () => {
    if (g.code) {
      navigator.clipboard?.writeText(inviteJoinUrl(g.code));
      toastMsg("Ссылка скопирована");
    }
  };

  const activeMembers = members.filter((m) => (m.weekTrainings || 0) > 0).length;
  const activation = members.length ? Math.round((activeMembers / members.length) * 100) : 0;

  const weeklyCard = weekly?.target ? (
    <div className="card guild-goal" style={{ marginBottom: 12 }}>
      <div className="row between small" style={{ marginBottom: 6 }}>
        <span className="row" style={{ gap: 6 }}><Icon name="gift" size={15} color="var(--gold)" /> Цель гильдии на неделю</span>
        <b>{weekly.count}/{weekly.target}{weekly.count >= weekly.target ? " ✓" : ""}</b>
      </div>
      <div className="bar">
        <div
          className="bar__fill"
          style={{
            width: `${Math.min(100, Math.round((weekly.count / weekly.target) * 100))}%`,
            background: weekly.count >= weekly.target ? "var(--green)" : "var(--gold)",
          }}
        />
      </div>
    </div>
  ) : null;

  return (
    <>
      <div className="topbar">
        <div className="topbar__title">
          <h1>{escapeHtml(g.name || "Моя гильдия")}</h1>
          <small className="row" style={{ gap: 5 }}>
            <Icon name="badge" size={14} color="var(--gold)" /> Тренер · {escapeHtml(S.hero.name || "")}
            {sport ? ` · ${sport.name}` : ""}
          </small>
        </div>
        <div className="topbar__actions">
          <SyncBadge />
          <button type="button" className="icon-btn" aria-label="Выйти" onClick={() => { logout(); navigate("/auth"); }}>
            <Icon name="logout" size={20} />
          </button>
        </div>
      </div>

      <div className="section">
        {!sport ? (
          <div className="card">
            <div className="label" style={{ marginTop: 0 }}>Укажи секцию гильдии</div>
            <p className="small muted" style={{ margin: "0 0 10px" }}>Нужно для QR-кода: дети автоматически попадут в выбранную секцию.</p>
            <div className="model-tiles">
              {GAME.sports.map((s) => (
                <button key={s.id} type="button" className={`model-tile${sportDraft === s.id ? " model-tile--on" : ""}`} onClick={() => setSportDraft(s.id)}>
                  <span className="model-tile__ico"><Icon name={s.icon} size={28} /></span>
                  <span className="model-tile__t">{s.name}</span>
                </button>
              ))}
            </div>
            <button type="button" className="btn btn--icon" style={{ marginTop: 12 }} disabled={!sportDraft} onClick={saveSport}>
              <Icon name="check" size={18} /> Сохранить секцию
            </button>
          </div>
        ) : (
          <div className="card guild-invite">
            <div className="guild-invite__qr">
              <div className="small muted center">QR для вступления детей</div>
              {g.code && (
                <img className="guild-qr__img" width="200" height="200" alt="QR-код гильдии" src={guildQrSrc(g.code)} />
              )}
              <div className="small row center" style={{ gap: 6, marginTop: 8 }}>
                <Icon name={sport.icon} size={14} /> Секция: {sport.name}
              </div>
            </div>
            <div className="guild-invite__code">
              <div className="small muted">Код приглашения</div>
              <div className="guild-code__val">{escapeHtml(g.code || "—")}</div>
              <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <button type="button" className="btn btn--sm" onClick={copyCode}><Icon name="copy" size={15} /> Код</button>
                <button type="button" className="btn btn--sm btn--ghost" onClick={copyInvite}><Icon name="share" size={15} /> Ссылка</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="section">
        <div className="card">
          <div className="row between">
            <b><Icon name="target" size={16} color="var(--green)" /> KPI пилота (4 недели)</b>
            <span className="small muted">{todayKey()}</span>
          </div>
          <div className="divider" />
          <div className="row between"><span>Детей в секции</span><b>{members.length}</b></div>
          <div className="row between"><span>Активированы за неделю</span><b>{activeMembers} ({activation}%)</b></div>
          <div className="row between"><span>Подтверждённые посещения недели</span><b>{weekly ? `${weekly.count}/${weekly.target || "—"}` : "—"}</b></div>
          <div className="row between"><span>Ожидают решения тренера</span><b>{pendingCheckIn}</b></div>
        </div>
      </div>

      <div className="section">
        <div className="seg">
          <button type="button" className={`seg__btn${tab === "kids" ? " seg__btn--on" : ""}`} onClick={() => setTab("kids")}>
            <Icon name="team" size={15} /> Дети
          </button>
          <button type="button" className={`seg__btn${tab === "attendance" ? " seg__btn--on" : ""}`} onClick={() => setTab("attendance")}>
            <Icon name="check" size={15} /> Посещения{pendingCheckIn ? ` (${pendingCheckIn})` : ""}
          </button>
          <button type="button" className={`seg__btn${tab === "leave" ? " seg__btn--on" : ""}`} onClick={() => setTab("leave")}>
            <Icon name="logout" size={15} /> Уход{pendingLeave ? ` (${pendingLeave})` : ""}
          </button>
        </div>
        <div className="spacer" />

        {loading ? (
          <div className="loading-state"><span className="loading-state__spinner" aria-hidden="true" /><span>Загружаем данные команды</span></div>
        ) : tab === "kids" ? (
          members.length ? members.map((m) => {
            const need = xpToNext(m.level);
            const pct = Math.round((m.xp / need) * 100);
            const mSport = sportMeta(m.sport);
            return (
              <button key={m.id} type="button" className="item item--tap" style={{ width: "100%", textAlign: "left" }} onClick={() => setMember(m)}>
                <div className="item__ico"><Icon name={mSport?.avatar || "user"} size={24} /></div>
                <div className="item__body">
                  <div className="item__title">
                    {escapeHtml(m.name)}
                    {m.pending ? <span className="badge badge--ok" style={{ marginLeft: 6 }}>{m.pending} заявк.</span> : null}
                  </div>
                  <div className="item__sub row" style={{ gap: 8 }}>
                    <Icon name="star" size={12} color="var(--gold)" /> LVL {m.level}
                    · <Icon name="flame" size={12} color="var(--orange)" /> {m.streak || 0}
                    · неделя {m.weekTrainings || 0}{m.weekTarget ? `/${m.weekTarget}` : ""}
                    {mSport ? ` · ${mSport.name}` : ""}
                  </div>
                  <div className="bar bar--xp" style={{ marginTop: 6 }}><div className="bar__fill" style={{ width: `${pct}%` }} /></div>
                </div>
                <span className="item__chevron"><Icon name="arrowR" size={16} /></span>
              </button>
            );
          }) : (
            <div className="card center muted" style={{ padding: 22 }}>
              <Icon name="team" size={28} />
              <div style={{ marginTop: 8 }}>Пока нет детей в гильдии</div>
              <div className="small" style={{ marginTop: 6 }}>Покажи детям QR-код или ссылку — секция подставится автоматически</div>
            </div>
          )
        ) : tab === "attendance" ? (
          <>
            {weeklyCard}
            <div className="row between" style={{ marginBottom: 8 }}>
              <div className="label" style={{ margin: 0 }}>Заявки на приход</div>
              <span className="row" style={{ gap: 6 }}>
                {pending.length > 0 && (
                  <button type="button" className="btn btn--sm btn--gold" onClick={approveAll}>
                    <Icon name="check" size={14} /> Подтвердить все ({pending.length})
                  </button>
                )}
                <button type="button" className="btn btn--sm btn--ghost" onClick={exportCsv}>
                  <Icon name="copy" size={14} /> Экспорт CSV
                </button>
              </span>
            </div>
            {pending.length ? pending.map((a) => (
              <div key={a.id} className="item">
                <div className="item__ico"><Icon name="clock" size={22} color="var(--orange)" /></div>
                <div className="item__body">
                  <div className="item__title">{escapeHtml(a.childName || a.name || "Ребёнок")}</div>
                  <div className="item__sub">Тренировка {fmtDateShort(a.date)} · ждёт подтверждения</div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <button type="button" className="btn btn--sm btn--gold" onClick={() => setApproveAtt(a)}><Icon name="check" size={15} /></button>
                  <button type="button" className="btn btn--sm btn--ghost" onClick={() => decide(a.id, false)}><Icon name="close" size={15} /></button>
                </div>
              </div>
            )) : (
              <div className="card center muted row" style={{ justifyContent: "center", gap: 8 }}>
                <Icon name="check" size={20} color="var(--green)" /> Нет заявок на приход
              </div>
            )}
            {decided.length > 0 && (
              <>
                <div className="label" style={{ marginTop: 12 }}>История</div>
                {decided.map((a) => (
                  <div key={`${a.id}-hist`} className="item">
                    <div className="item__ico">
                      <Icon name={a.status === "approved" ? "check" : "close"} size={20} color={a.status === "approved" ? "var(--green)" : "var(--red)"} />
                    </div>
                    <div className="item__body">
                      <div className="item__title">{escapeHtml(a.childName || a.name || "Ребёнок")}</div>
                      <div className="item__sub">
                        Тренировка {fmtDateShort(a.date)} · {a.status === "approved" ? "подтверждено" : "отклонено"}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        ) : (
          <>
            <div className="label">Заявки на уход</div>
            {pendingLeaveList.length ? pendingLeaveList.map((a) => (
              <div key={a.id} className="item">
                <div className="item__ico"><Icon name="logout" size={22} color="var(--primary)" /></div>
                <div className="item__body">
                  <div className="item__title">{escapeHtml(a.childName || a.name || "Ребёнок")}</div>
                  <div className="item__sub">Уход {fmtDateShort(a.date)} · ждёт подтверждения</div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <button type="button" className="btn btn--sm btn--gold" onClick={() => decide(a.id, true, true)}><Icon name="check" size={15} /></button>
                  <button type="button" className="btn btn--sm btn--ghost" onClick={() => decide(a.id, false, true)}><Icon name="close" size={15} /></button>
                </div>
              </div>
            )) : (
              <div className="card center muted row" style={{ justifyContent: "center", gap: 8 }}>
                <Icon name="check" size={20} color="var(--green)" /> Нет заявок на уход
              </div>
            )}
            {decidedLeave.length > 0 && (
              <>
                <div className="label" style={{ marginTop: 12 }}>История уходов</div>
                {decidedLeave.map((a) => (
                  <div key={`${a.id}-leave`} className="item">
                    <div className="item__ico">
                      <Icon name={a.leave_status === "approved" ? "check" : "close"} size={20} color={a.leave_status === "approved" ? "var(--green)" : "var(--red)"} />
                    </div>
                    <div className="item__body">
                      <div className="item__title">{escapeHtml(a.childName || a.name || "Ребёнок")}</div>
                      <div className="item__sub">
                        Уход {fmtDateShort(a.date)} · {a.leave_status === "approved" ? "подтверждён" : "отклонён"}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>

      <ApproveSheet
        att={approveAtt}
        open={!!approveAtt}
        onClose={() => setApproveAtt(null)}
        onConfirm={(extra) => decide(approveAtt.id, true, false, extra)}
      />
      <MemberSheet
        member={member}
        open={!!member}
        onClose={() => setMember(null)}
        onSaved={load}
        toastMsg={toastMsg}
      />
    </>
  );
}
