import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GAME, xpToNext } from "@domain/game-data";
import { sportMeta, eloOf, sportSpriteSrc } from "@domain/game-engine";
import { remindersFullyOn } from "@domain/reminders";
import { SHApi } from "@domain/sync";
import { Icon } from "../../components/Icon.jsx";
import { CheckinSection } from "../../components/CheckinSection.jsx";
import { LevelRingButton } from "../../components/LevelRingButton.jsx";
import { Modal } from "../../components/Modal.jsx";
import { SyncBadge } from "../../components/SyncBadge.jsx";
import { escapeHtml } from "../../lib/format.js";
import { showAttendanceToasts } from "../../lib/attendanceToasts.js";
import { toggleReminders } from "../../hooks/useRemindersBoot.jsx";
import { useGameStore } from "../../stores/useGameStore.js";
import { TrainCalendar, localProgressSummary } from "./TrainCalendar.jsx";

function metricValue(S, metric) {
  const h = S.hero;
  const st = S.stats || {};
  switch (metric) {
    case "trainings": return st.trainings || 0;
    case "wins": return st.wins || 0;
    case "level": return h.level || 1;
    default: return 0;
  }
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const S = useGameStore((s) => s.S);
  const myAttendance = useGameStore((s) => s.myAttendance);
  const syncAttendance = useGameStore((s) => s.syncAttendance);
  const ensureSeason = useGameStore((s) => s.ensureSeason);
  const setS = useGameStore((s) => s.setS);
  const logout = useGameStore((s) => s.logout);
  const toastMsg = useGameStore((s) => s.toastMsg);
  const addXp = useGameStore((s) => s.addXp);

  const [questsOpen, setQuestsOpen] = useState(false);
  const [achOpen, setAchOpen] = useState(false);
  const [seasonOpen, setSeasonOpen] = useState(false);
  const [remindersOn, setRemindersOn] = useState(remindersFullyOn());
  const [progress, setProgress] = useState(null);
  const [progressLoading, setProgressLoading] = useState(true);

  const h = S.hero;
  const st = S.stats;
  const total = (st.wins || 0) + (st.losses || 0);
  const winrate = total ? Math.round((st.wins / total) * 100) : 0;
  const guild = S.guild;
  const sport = sportMeta(h.sport);
  const need = xpToNext(h.level);
  const xpPct = Math.round((h.xp / need) * 100);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setProgressLoading(true);
      const { applied } = await syncAttendance().catch(() => ({ applied: null }));
      showAttendanceToasts(applied, toastMsg);
      try {
        const data = await SHApi.progressSummary("month");
        if (!cancelled) setProgress(data);
      } catch {
        if (!cancelled) {
          const stNow = useGameStore.getState();
          setProgress(localProgressSummary({
            myAttendance: stNow.myAttendance,
            battles: stNow.S.battles,
            hero: stNow.S.hero,
          }));
        }
      } finally {
        if (!cancelled) setProgressLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [syncAttendance]);

  const claimAchievement = (ach) => {
    if ((h.achievementsClaimed || []).includes(ach.id)) return;
    if (metricValue(S, ach.metric) < ach.goal) {
      toastMsg("Ещё не выполнено");
      return;
    }
    setS((prev) => ({
      ...prev,
      hero: {
        ...prev.hero,
        achievementsClaimed: [...(prev.hero.achievementsClaimed || []), ach.id],
      },
    }));
    addXp(ach.xp);
    toastMsg(`Достижение: ${ach.name} (+${ach.xp} XP)`);
  };

  const claimSeasonTier = (needPts) => {
    ensureSeason();
    const season = GAME.season;
    const tier = season.tiers.find((t) => t.need === needPts);
    if (!tier || (h.seasonPoints || 0) < needPts) return;
    if ((h.seasonClaimed || []).includes(needPts)) return;
    setS((prev) => {
      const hero = { ...prev.hero, seasonClaimed: [...(prev.hero.seasonClaimed || []), needPts] };
      if (tier.reward.coins) hero.coins = (hero.coins || 0) + tier.reward.coins;
      else if (tier.reward.item && !hero.cosmetics.owned.includes(tier.reward.item)) {
        hero.cosmetics = { ...hero.cosmetics, owned: [...hero.cosmetics.owned, tier.reward.item] };
      }
      return { ...prev, hero };
    });
    toastMsg("Награда сезона получена!");
  };

  const praise = myAttendance.filter((a) => a.status === "approved" && (a.praise || a.mvp)).slice(0, 4);

  return (
    <div className="profile-scene">
      <div className="profile-scene__bg" aria-hidden="true" />
      <div className="topbar profile-scene__top">
        <div className="topbar__title">
          <h1>Привет, {escapeHtml(h.name)}!</h1>
          <small className="row" style={{ gap: 5 }}>
            <Icon name={sport?.icon || "user"} size={14} /> {sport?.name || "Секция"}
          </small>
        </div>
        <div className="topbar__actions">
          <SyncBadge />
          <span className="chip" style={{ cursor: "pointer" }} onClick={() => navigate("/clan")} role="button" tabIndex={0}>
            {guild ? <><Icon name="flag" size={15} color="var(--gold)" /> {escapeHtml(guild.name)}</> : <><Icon name="flag" size={15} /> Гильдия</>}
          </span>
        </div>
      </div>

      <div className="profile-locker-hero">
        <div className="profile-locker-hero__tag">
          <Icon name={sport?.icon || "user"} size={14} color="var(--gold)" /> {sport?.name} · личный шкафчик
        </div>
        <div className="hero-card hero-card--locker">
          {sport?.sprite && (
            <div className="hero-avatar hero-avatar--sprite hero-card__locker-sprite">
              <img className="hero-avatar__sprite" src={sportSpriteSrc(sport)} alt={sport.name || ""} />
            </div>
          )}
          <div className="hero-card__locker-meta">
            <div className="hero-card__name">{h.name}</div>
            <div className="small row hero-card__meta" style={{ opacity: 0.9, gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
              <Icon name={sport?.icon || "user"} size={15} /> {sport?.name || "Секция"}
            </div>
            <div className="pill-row" style={{ marginTop: 8, justifyContent: "center" }}>
              <span className="chip" data-tip="Эло — рейтинг за победы в боях">
                <Icon name="elo" size={15} color="#FF5500" /> {eloOf(h.trophies)}
              </span>
            </div>
          </div>
          <div className="hero-card__extra">
            <div className="hero-card__xp">
              <LevelRingButton hero={h} className="hero-card__lvl" />
              <div className="hero-card__xp-track">
                <div className="row between small">
                  <span>{h.xp} / {need}</span>
                </div>
                <div className="bar bar--xp"><div className="bar__fill" style={{ width: `${xpPct}%` }} /></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <CheckinSection />

      <section className="section profile-group profile-dynamics" aria-labelledby="profileDynamicsTitle">
        <div className="profile-group__head">
          <h2 id="profileDynamicsTitle" className="row">
            <Icon name="target" size={18} color="var(--green)" /> Динамика
          </h2>
        </div>
        <div id="profileProgressBody">
          {progressLoading && (
            <div className="loading-state" role="status">
              <span className="loading-state__spinner" aria-hidden="true" />
              <span>Собираем итоги</span>
            </div>
          )}
          {!progressLoading && progress && (
            <>
              {(progress.scheduleDays || 0) > 0 && (
                <div className="profile-dynamics__meta small muted">
                  Цель расписания {progress.scheduleDone || 0}/{progress.scheduleDays || 0}
                  {(progress.pending || 0) > 0 ? ` · ждут ${progress.pending}` : ""}
                </div>
              )}
              <TrainCalendar days={progress.days || []} />
              <div className="profile-metrics" aria-label="Сводка боёв">
                <div className="profile-metrics__item">
                  <div className="profile-metrics__ico"><Icon name="swords" size={18} color="var(--orange)" /></div>
                  <div className="profile-metrics__val">{total}</div>
                  <div className="profile-metrics__lbl">матчей</div>
                </div>
                <div className="profile-metrics__item">
                  <div className="profile-metrics__ico"><Icon name="trophy" size={18} color="var(--gold)" /></div>
                  <div className="profile-metrics__val">{st.wins || 0}</div>
                  <div className="profile-metrics__lbl">побед</div>
                </div>
                <div className="profile-metrics__item">
                  <div className="profile-metrics__ico"><Icon name="winrate" size={18} color="var(--green)" /></div>
                  <div className="profile-metrics__val">{winrate}%</div>
                  <div className="profile-metrics__lbl">% побед</div>
                </div>
              </div>
              {progress.offline && (
                <p className="small muted" style={{ marginTop: 8 }}>Локальные данные — без сети.</p>
              )}
            </>
          )}
          {!progressLoading && !progress && (
            <div className="card center muted">Нет данных за период</div>
          )}
        </div>
      </section>

      <div className="section grid grid-2">
        <button type="button" className="btn btn--ghost btn--icon" onClick={() => setQuestsOpen(true)}>
          <Icon name="tasks" size={18} /> Задания
        </button>
        <button type="button" className="btn btn--ghost btn--icon" onClick={() => setAchOpen(true)}>
          <Icon name="trophy" size={18} color="var(--gold)" /> Достижения
        </button>
        <button type="button" className="btn btn--ghost btn--icon" onClick={() => { ensureSeason(); setSeasonOpen(true); }}>
          <Icon name="gift" size={18} /> Сезон
        </button>
        <Link to="/shop" className="btn btn--ghost btn--icon" style={{ textDecoration: "none" }}>
          <Icon name="bag" size={18} /> Магазин
        </Link>
      </div>

      {praise.length > 0 && (
        <div className="section">
          <h2 className="row" style={{ gap: 8 }}><Icon name="badge" size={18} color="var(--gold)" /> Отзывы тренера</h2>
          {praise.map((a) => (
            <div key={a.date} className="praise-row">
              <span className="praise-row__date">{a.date}</span>
              <span className="praise-row__text">{a.mvp ? <b>MVP </b> : null}{a.praise || "Отличная работа!"}</span>
            </div>
          ))}
        </div>
      )}

      <details className="section profile-settings">
        <summary><Icon name="settings" size={18} /> Настройки <span><Icon name="arrowR" size={16} /></span></summary>
        <div className="profile-settings__body">
          <label className="checkline" style={{ marginBottom: 10 }}>
            <input
              type="checkbox"
              checked={remindersOn}
              onChange={async (e) => {
                const on = await toggleReminders(e.target.checked, toastMsg);
                setRemindersOn(on);
              }}
            />
            <span><Icon name="clock" size={16} color="var(--orange)" /> Напоминания о тренировках</span>
          </label>
          <Link to="/parent" className="btn btn--ghost btn--icon" style={{ textDecoration: "none" }}>
            <Icon name="team" size={18} color="var(--primary)" /> Режим для родителя
          </Link>
          <button type="button" className="btn btn--danger" onClick={() => { logout(); navigate("/auth"); }}>
            Выйти из аккаунта
          </button>
        </div>
      </details>

      <Modal open={questsOpen} onClose={() => setQuestsOpen(false)} title={<><Icon name="tasks" size={18} /> Ежедневные задания</>}>
        {(S.quests?.list?.length ? S.quests.list : GAME.questPool.map((q) => ({ ...q, progress: 0, claimed: false }))).map((q) => (
          <div key={q.id} className="item">
            <div className="item__ico"><Icon name={q.icon} size={22} /></div>
            <div className="item__body">
              <div className="item__title">{q.name}</div>
              <div className="item__sub">{q.progress || 0}/{q.target} · +{q.reward} монет</div>
            </div>
          </div>
        ))}
      </Modal>

      <Modal open={achOpen} onClose={() => setAchOpen(false)} title={<><Icon name="trophy" size={18} color="var(--gold)" /> Достижения</>}>
        {GAME.achievements.map((ach) => {
          const done = metricValue(S, ach.metric) >= ach.goal;
          const claimed = (h.achievementsClaimed || []).includes(ach.id);
          return (
            <div key={ach.id} className="item">
              <div className="item__ico"><Icon name={ach.icon} size={22} /></div>
              <div className="item__body">
                <div className="item__title">{ach.name}</div>
                <div className="item__sub">{ach.desc} · {metricValue(S, ach.metric)}/{ach.goal}</div>
              </div>
              {claimed ? <span className="chip">Получено</span> : done ? (
                <button type="button" className="btn btn--sm btn--gold" onClick={() => claimAchievement(ach)}>+{ach.xp} XP</button>
              ) : null}
            </div>
          );
        })}
      </Modal>

      <Modal open={seasonOpen} onClose={() => setSeasonOpen(false)} title={<><Icon name="gift" size={18} /> {GAME.season.name}</>}>
        <p className="small muted">Очков сезона: {h.seasonPoints || 0}</p>
        {GAME.season.tiers.map((t) => {
          const got = (h.seasonClaimed || []).includes(t.need);
          const ready = (h.seasonPoints || 0) >= t.need;
          return (
            <div key={t.need} className="item">
              <div className="item__body">
                <div className="item__title">{t.need} очков</div>
                <div className="item__sub">{t.reward.coins ? `${t.reward.coins} монет` : "Косметика"}</div>
              </div>
              {got ? <span className="chip">Получено</span> : ready ? (
                <button type="button" className="btn btn--sm btn--gold" onClick={() => claimSeasonTier(t.need)}>Забрать</button>
              ) : <Icon name="lock" size={18} />}
            </div>
          );
        })}
      </Modal>
    </div>
  );
}
