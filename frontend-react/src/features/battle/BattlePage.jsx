import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GAME } from "@domain/game-data";
import { xpToNext } from "@domain/game-data";
import { SHApi } from "@domain/sync";
import {
  simulateBattle,
  summarizeBattleLog,
  slimBattleLog,
  pickDiscipline,
  makeOpponent,
  mapPlayerToOpponent,
  sportMeta,
  sportSkills,
  skillMeta,
  heroPower,
  effectiveStats,
  eloOf,
  estimateWinChance,
  pick,
  sportSpriteSrc,
  assetUrl,
} from "@domain/game-engine";
import { Icon } from "../../components/Icon.jsx";
import { LevelRingButton } from "../../components/LevelRingButton.jsx";
import { Modal } from "../../components/Modal.jsx";
import { PersonAvatar } from "../../components/PersonAvatar.jsx";
import { SyncBadge } from "../../components/SyncBadge.jsx";
import { escapeHtml } from "../../lib/format.js";
import { todayKey } from "../../lib/format.js";
import { useGameStore } from "../../stores/useGameStore.js";
import { BattleArena } from "./BattleArena.jsx";
import { MatchmakingOverlay } from "./MatchmakingOverlay.jsx";
import { resolveOppSportId, arenaOutcomeSprite } from "./battleHelpers.js";

function loadoutChips(hero) {
  const loadout = hero.loadout || [];
  if (!loadout.length) return <span className="small muted">Выбери до 3 скиллов в «Тренировка»</span>;
  return loadout.map((id) => {
    const sk = skillMeta(id);
    if (!sk) return null;
    return (
      <span key={id} className="chip loadout-chip">
        <Icon name={sk.icon} size={14} color="var(--orange)" /> {sk.name}
      </span>
    );
  });
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

/** Дополняем старые записи: урон из остатка HP, шанс — из сил. */
function enrichBattleRecord(b) {
  if (!b || typeof b !== "object") return b || {};
  const out = { ...b };
  if (out.dmgDealt == null && out.eMax != null && out.eHP != null) {
    out.dmgDealt = Math.max(0, Math.round(Number(out.eMax) - Number(out.eHP)));
  }
  if (out.dmgTaken == null && out.pMax != null && out.pHP != null) {
    out.dmgTaken = Math.max(0, Math.round(Number(out.pMax) - Number(out.pHP)));
  }
  if (out.winChance == null && out.heroPower != null && out.oppPower != null) {
    const hp = Math.max(1, Number(out.heroPower) || 1);
    const op = Math.max(1, Number(out.oppPower) || 1);
    out.winChance = clamp(Math.round((hp / (hp + op)) * 100), 3, 97);
  }
  return out;
}

function BattleHistoryDetail({ raw, onBack }) {
  const b = enrichBattleRecord(raw);
  const hasDetail = b.oppLevel !== undefined || b.oppPower !== undefined || b.pMax != null;
  const pPct = b.pMax ? Math.round((b.pHP / b.pMax) * 100) : null;
  const ePct = b.eMax ? Math.round((b.eHP / b.eMax) * 100) : null;
  const hasCombat = b.dmgDealt != null || b.dmgTaken != null || b.skillProcs != null || b.winChance != null;
  const chance = b.winChance != null ? clamp(b.winChance, 0, 100) : null;
  const chanceColor = chance == null ? null
    : (chance >= 60 ? "var(--green)" : chance >= 35 ? "var(--gold)" : "var(--red)");
  const procs = b.procs || {};
  const hasProcBreakdown = b.procs && typeof b.procs === "object";
  const procRows = [
    { key: "combo", label: "Комбо", ico: "bolt", color: "#30D9FF" },
    { key: "firststrike", label: "Первый удар", ico: "bolt", color: "#3DD16F" },
    { key: "ultimate", label: "Коронный приём", ico: "swords", color: "#B07CFF" },
    { key: "dodge", label: "Уклонение", ico: "wind", color: "#7AE4FF" },
    { key: "stun", label: "Оглушение", ico: "star", color: "#FFB54D" },
  ].filter((row) => (procs[row.key] || 0) > 0);
  const isSparring = !!(b.unranked || b.mode === "sparring");

  return (
    <>
      <button type="button" className="btn btn--ghost btn--sm btn--icon" style={{ marginBottom: 14 }} onClick={onBack}>
        <Icon name="arrowL" size={16} /> К списку
      </button>
      <div className={`result ${b.win ? "result--win" : "result--lose"}`} style={{ marginTop: 0 }}>
        <div className="result__emoji">
          {b.win ? <Icon name="trophy" size={48} color="var(--gold)" /> : <Icon name="flame" size={48} color="var(--orange)" />}
        </div>
        <div className="result__title">{b.win ? "Победа" : "Поражение"}</div>
        <p className="muted" style={{ marginTop: 4 }}>против {escapeHtml(b.opp || "соперника")} · {b.date || ""}</p>
      </div>
      {hasDetail ? (
        <>
          <div className="card">
            {b.heroLevel != null && <div className="row between"><span>Твой уровень</span><b>LVL {b.heroLevel}</b></div>}
            {b.heroLevel != null && b.heroPower != null && <div className="divider" />}
            {b.heroPower != null && (
              <div className="row between">
                <span>Твоя сила</span>
                <b className="row" style={{ gap: 5 }}><Icon name="swords" size={14} /> {b.heroPower}</b>
              </div>
            )}
            {(b.heroLevel != null || b.heroPower != null) && <div className="divider" />}
            <div className="row between">
              <span>Соперник</span>
              <b className="row" style={{ gap: 6 }}><Icon name={b.oppAvatar || "skull"} size={16} /> {escapeHtml(b.opp || "—")}</b>
            </div>
            {b.oppLevel != null && (
              <><div className="divider" /><div className="row between"><span>Уровень соперника</span><b>LVL {b.oppLevel}</b></div></>
            )}
            {b.oppPower != null && (
              <><div className="divider" /><div className="row between"><span>Сила соперника</span><b className="row" style={{ gap: 5 }}><Icon name="swords" size={14} /> {b.oppPower}</b></div></>
            )}
            {b.discipline && (
              <><div className="divider" /><div className="row between"><span>Дисциплина</span><b>{escapeHtml(b.discipline)}</b></div></>
            )}
          </div>
          {hasCombat && (
            <div className="card">
              <div className="label" style={{ marginTop: 0 }}>Ход боя</div>
              {chance != null && (
                <>
                  <div className="row between small" style={{ marginBottom: 6 }}>
                    <span className="row" style={{ gap: 6 }}><Icon name="flame" size={14} color={chanceColor} /> Шанс победы до боя</span>
                    <b style={{ color: chanceColor }}>{chance}%</b>
                  </div>
                  <div className="bar"><div className="bar__fill" style={{ width: `${chance}%`, background: chanceColor }} /></div>
                  <div className="divider" />
                </>
              )}
              {b.dmgDealt != null && (
                <div className="row between">
                  <span className="row" style={{ gap: 6 }}><Icon name="swords" size={14} color="var(--orange)" /> Урон по сопернику</span>
                  <b>−{b.dmgDealt} HP</b>
                </div>
              )}
              {b.dmgDealt != null && b.dmgTaken != null && <div className="divider" />}
              {b.dmgTaken != null && (
                <div className="row between">
                  <span className="row" style={{ gap: 6 }}><Icon name="heart" size={14} color="var(--red)" /> Урон по тебе</span>
                  <b>−{b.dmgTaken} HP</b>
                </div>
              )}
              {(b.dmgDealt != null || b.dmgTaken != null) && <div className="divider" />}
              {hasProcBreakdown ? (
                <div className="row between">
                  <span className="row" style={{ gap: 6 }}><Icon name="sparkles" size={14} color="var(--gold)" /> Скиллы сработали</span>
                  <b>{b.skillProcs || 0}</b>
                </div>
              ) : (
                <>
                  <div className="row between">
                    <span className="row" style={{ gap: 6 }}><Icon name="sparkles" size={14} color="var(--gold)" /> Скиллы сработали</span>
                    <b className="muted">н/д</b>
                  </div>
                  <div className="small muted" style={{ marginTop: 8 }}>Разбивка проков появится у боёв после обновления. Сыграй новый бой.</div>
                </>
              )}
              {procRows.length > 0 && (
                <>
                  <div className="divider" />
                  <div className="small muted" style={{ marginBottom: 8 }}>Разбивка проков</div>
                  {procRows.map((row) => (
                    <div key={row.key} className="row between small" style={{ marginBottom: 6 }}>
                      <span className="row" style={{ gap: 6 }}><Icon name={row.ico} size={13} color={row.color} /> {row.label}</span>
                      <b>×{procs[row.key]}</b>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
          {Array.isArray(b.log) && b.log.length > 0 ? (
            <div className="card">
              <div className="label" style={{ marginTop: 0 }}>Лог ходов</div>
              <div className="battle-turn-log" role="log" aria-label="Лог урона по ходам">
                {b.log.map((line, i) => {
                  const dealt = line.side === "e" && line.dmg != null;
                  const taken = line.side === "p" && line.dmg != null;
                  const cls = [
                    "battle-turn-log__row",
                    dealt ? "is-dealt" : "",
                    taken ? "is-taken" : "",
                    line.crit ? "is-crit" : "",
                    line.fx === "ko" ? "is-ko" : "",
                    line.fx && !line.dmg ? "is-fx" : "",
                  ].filter(Boolean).join(" ");
                  return (
                    <div key={`${i}-${line.t}`} className={cls}>
                      <span className="battle-turn-log__n">{i + 1}</span>
                      <div className="battle-turn-log__body">
                        <div className="battle-turn-log__text">{line.t}</div>
                        {(dealt || taken) && (
                          <div className="battle-turn-log__meta">
                            <span className={dealt ? "battle-turn-log__dmg battle-turn-log__dmg--out" : "battle-turn-log__dmg battle-turn-log__dmg--in"}>
                              {dealt ? "Ты" : "Соперник"} −{line.dmg} HP
                            </span>
                            {line.pHP != null && line.eHP != null && (
                              <span className="battle-turn-log__hp">
                                HP {Math.max(0, Math.round(line.pHP))} / {Math.max(0, Math.round(line.eHP))}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : hasCombat ? (
            <div className="card">
              <div className="label" style={{ marginTop: 0 }}>Лог ходов</div>
              <div className="small muted">Подробный лог урона появится у боёв после обновления. Сыграй новый бой.</div>
            </div>
          ) : null}
          {pPct !== null && (
            <div className="card">
              <div className="row between small" style={{ marginBottom: 6 }}>
                <span>Твоё HP в конце</span>
                <span>{Math.max(0, Math.round(b.pHP))} / {b.pMax} ({pPct}%)</span>
              </div>
              <div className="bar"><div className="bar__fill" style={{ width: `${pPct}%` }} /></div>
              <div className="spacer" />
              <div className="row between small" style={{ marginBottom: 6 }}>
                <span>HP соперника в конце</span>
                <span>{Math.max(0, Math.round(b.eHP))} / {b.eMax} ({ePct}%)</span>
              </div>
              <div className="bar"><div className="bar__fill" style={{ width: `${ePct}%`, background: "var(--red)" }} /></div>
            </div>
          )}
          <div className="card">
            <div className="row between"><span>Опыт</span><b>+{b.xp || 0} XP</b></div>
            <div className="divider" />
            {isSparring ? (
              <div className="row between">
                <span>Режим</span>
                <b className="row" style={{ gap: 5 }}><Icon name="team" size={14} color="var(--primary)" /> Спарринг</b>
              </div>
            ) : (
              <div className="row between">
                <span>Эло</span>
                <b className="row" style={{ gap: 5 }}>{(b.trophies || 0) >= 0 ? "+" : ""}{b.trophies || 0} <Icon name="elo" size={14} color="#FF5500" /></b>
              </div>
            )}
            {b.hits !== undefined && (
              <><div className="divider" /><div className="row between"><span>Ударов в бою</span><b>{b.hits}</b></div></>
            )}
          </div>
        </>
      ) : (
        <div className="card center muted">Подробная статистика недоступна для этой записи.</div>
      )}
    </>
  );
}

export default function BattlePage() {
  const navigate = useNavigate();
  const S = useGameStore((s) => s.S);
  const setS = useGameStore((s) => s.setS);
  const toastMsg = useGameStore((s) => s.toastMsg);
  const battleMode = useGameStore((s) => s.battleMode);
  const setBattleMode = useGameStore((s) => s.setBattleMode);
  const battlePhase = useGameStore((s) => s.battlePhase);
  const setBattlePhase = useGameStore((s) => s.setBattlePhase);
  const battleState = useGameStore((s) => s.battleState);
  const setBattleState = useGameStore((s) => s.setBattleState);
  const resetBattle = useGameStore((s) => s.resetBattle);
  const persistNow = useGameStore((s) => s.persistNow);

  const [finding, setFinding] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyDetailIdx, setHistoryDetailIdx] = useState(null);
  const [loadoutOpen, setLoadoutOpen] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);
  const [sparringOpen, setSparringOpen] = useState(false);
  const [sparringLoading, setSparringLoading] = useState(false);
  const [sparringErr, setSparringErr] = useState("");
  const [sparringMembers, setSparringMembers] = useState([]);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveTarget, setLeaveTarget] = useState(null);
  const finishedRef = useRef(false);

  const h = S.hero;
  const sport = sportMeta(h.sport);

  /** Award XP/Elo/history — keep arena phase for conclusion UI. */
  const finishBattle = () => {
    const st = useGameStore.getState();
    const bs = st.battleState;
    const heroNow = st.S?.hero;
    if (!bs?.result || !heroNow || bs.rewards) return;

    const r = bs.result;
    const opp = bs.opp;
    const unranked = !!(bs.unranked || bs.sparring || bs.mapMode);
    const diff = opp.level - heroNow.level;
    const heroPowerAtBattle = heroPower(heroNow);

    let xpGain = 0;
    let trophyDelta = 0;

    setS((prev) => {
      const next = structuredClone(prev);
      const hero = next.hero;

      if (unranked && bs.mapMode) {
        if (r.win) {
          if (!hero.stagesCleared) hero.stagesCleared = [];
          if (!hero.stagesCleared.includes(bs.stage)) hero.stagesCleared.push(bs.stage);
          xpGain = 25;
        } else {
          xpGain = 10;
        }
      } else if (unranked) {
        trophyDelta = 0;
        xpGain = r.win ? 10 : 8;
      } else if (r.win) {
        next.stats.wins++;
        trophyDelta = Math.min(12, Math.max(1, Math.round(3 + diff * 1.5)));
        hero.trophies += trophyDelta;
        xpGain = 35;
        hero.coins = (hero.coins || 0) + (GAME.coinsPerWin || 0);
        hero.seasonPoints = (hero.seasonPoints || 0) + (GAME.season?.pointsPerWin || 0);
      } else {
        next.stats.losses++;
        const penalty = Math.min(12, Math.max(1, Math.round(3 - diff * 1.5)));
        trophyDelta = -Math.min(penalty, hero.trophies);
        hero.trophies = Math.max(0, hero.trophies + trophyDelta);
        xpGain = 15;
      }

      let xp = hero.xp + xpGain;
      let level = hero.level;
      while (xp >= xpToNext(level)) {
        xp -= xpToNext(level);
        level++;
        hero.statPoints = (hero.statPoints || 0) + 5;
      }
      hero.xp = xp;
      hero.level = level;

      if (!bs.mapMode) {
        const summary = summarizeBattleLog(r.log);
        next.battles = [{
          opp: opp.name,
          oppAvatar: opp.avatar,
          oppLevel: opp.level,
          oppPower: opp.power,
          heroLevel: heroNow.level,
          heroPower: heroPowerAtBattle,
          win: r.win,
          xp: xpGain,
          trophies: trophyDelta,
          unranked: unranked || undefined,
          mode: unranked ? "sparring" : "ranked",
          pHP: Math.max(0, Math.round(r.pHP)),
          pMax: r.pMax,
          eHP: Math.max(0, Math.round(r.eHP)),
          eMax: r.eMax,
          hits: r.log.filter((l) => l.dmg !== undefined).length,
          dmgDealt: summary.dmgDealt,
          dmgTaken: summary.dmgTaken,
          skillProcs: summary.skillProcs,
          procs: summary.procs,
          log: slimBattleLog(r.log),
          winChance: estimateWinChance(heroNow, opp),
          discipline: bs.disc?.name,
          date: todayKey(),
          ts: Date.now(),
        }, ...(next.battles || [])].slice(0, 30);
      }

      return next;
    });

    setBattleState({
      ...bs,
      rewards: {
        xp: xpGain,
        win: r.win,
        trophies: trophyDelta,
        unranked,
        oppLevel: opp.level,
        heroLevel: heroNow.level,
      },
    });
    persistNow();
  };

  const forfeitPendingBattle = () => {
    const st = useGameStore.getState();
    const bs = st.battleState;
    const heroNow = st.S?.hero;
    if (!bs?.opp || bs.rewards || !heroNow) return false;

    const opp = bs.opp;
    const esStats = opp.stats || {};
    const ps = effectiveStats(heroNow);
    const pMax = Math.round(100 + (ps.end || 10) * 6 + heroNow.level * 8);
    const eMax = Math.round(100 + (esStats.end || 10) * 6 + opp.level * 8);
    const chance = estimateWinChance(heroNow, opp);
    const eHP = Math.min(
      eMax,
      Math.max(Math.round(eMax * 0.28), Math.round(eMax * (0.42 + (100 - chance) / 180))),
    );
    setBattleState({
      ...bs,
      result: {
        log: [{ t: "Отказ от боя — техническое поражение.", side: "p", pHP: 0, eHP, dmg: pMax }],
        win: false,
        pMax,
        eMax,
        pHP: 0,
        eHP,
      },
      pendingAccept: false,
      playing: false,
      forfeit: true,
    });
    finishBattle();
    toastMsg("Техническое поражение");
    return true;
  };

  const beginFight = (opp, {
    unranked = false,
    sparring = false,
    mapMode = false,
    stage,
    autoStart = false,
    viaMatchmaking = false,
  } = {}) => {
    const disc = pickDiscipline();
    const result = simulateBattle(h, opp, disc);
    const nextState = {
      opp,
      disc,
      result,
      step: 0,
      stage,
      mapMode,
      unranked,
      sparring,
      autoStart,
      pendingAccept: !!viaMatchmaking,
    };
    finishedRef.current = false;
    setBattleState(nextState);
    if (viaMatchmaking) {
      setBattlePhase("matchmaking");
    } else {
      setBattlePhase("arena");
    }
  };

  const loadSparringMembers = async () => {
    setSparringLoading(true);
    setSparringErr("");
    try {
      const d = await SHApi.guildRoster();
      if (d.guild) {
        setS((prev) => ({ ...prev, guild: d.guild }));
      }
      setSparringMembers((d.members || []).filter((x) => !x.me));
    } catch (e) {
      setSparringErr(e.message || "Не удалось загрузить состав");
      setSparringMembers([]);
    } finally {
      setSparringLoading(false);
    }
  };

  const openSparring = () => {
    if (!S.guild) {
      toastMsg("Сначала вступи в гильдию");
      return;
    }
    setSparringOpen(true);
    loadSparringMembers();
  };

  const pickBattleMode = (next) => {
    setBattleMode(next);
    setModeOpen(false);
    toastMsg(next === "sparring" ? "Режим: спарринг" : "Режим: рейтинг");
  };

  const startBattle = async () => {
    if (!battleState?.mapMode && battleMode === "sparring") {
      openSparring();
      return;
    }
    setFinding(true);
    try {
      let opp;
      const mapMode = !!battleState?.mapMode;
      if (mapMode && battleState.opp) {
        opp = battleState.opp;
        beginFight(opp, {
          mapMode: true,
          stage: battleState.stage,
          unranked: true,
          autoStart: false,
        });
      } else {
        let pool = [];
        try {
          const lb = await SHApi.leaderboard();
          pool = (lb.players || []).filter((p) => !p.me).map(mapPlayerToOpponent);
        } catch {
          /* bots */
        }
        opp = pool.length
          ? pick(pool.sort((a, b) => Math.abs(a.level - h.level) - Math.abs(b.level - h.level)).slice(0, 24))
          : makeOpponent(h);
        beginFight(opp, {
          unranked: false,
          sparring: false,
          autoStart: true,
          viaMatchmaking: true,
        });
      }
    } catch (e) {
      toastMsg(e.message || "Не удалось найти соперника");
    } finally {
      setFinding(false);
    }
  };

  const startSparringBattle = (member) => {
    if (!member) return;
    const opp = mapPlayerToOpponent(member);
    setSparringOpen(false);
    beginFight(opp, { unranked: true, sparring: true, autoStart: false });
  };

  const onMatchmakingDone = () => {
    const bs = useGameStore.getState().battleState;
    if (!bs) return;
    setBattleState({ ...bs, pendingAccept: false, autoStart: true });
    setBattlePhase("arena");
  };

  const onArenaFinished = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    finishBattle();
  };

  const onArenaContinue = () => {
    setBattlePhase("result");
  };

  const toggleLoadoutSkill = (id) => {
    const loadoutNow = useGameStore.getState().S?.hero?.loadout || [];
    const idx = loadoutNow.indexOf(id);
    if (idx < 0 && loadoutNow.length >= 3) {
      toastMsg("Максимум 3 скилла в бою");
      return;
    }
    setS((prev) => {
      const loadout = [...(prev.hero.loadout || [])];
      const at = loadout.indexOf(id);
      if (at >= 0) loadout.splice(at, 1);
      else if (loadout.length < 3) loadout.push(id);
      else return prev;
      return { ...prev, hero: { ...prev.hero, loadout } };
    });
  };

  // Nav leave-guard: forfeit modal when leaving mid-arena
  useEffect(() => {
    const onNavIntent = (e) => {
      const to = e.detail?.to;
      if (!to || to === "/battle") return;
      const st = useGameStore.getState();
      if (st.battlePhase === "arena" && st.battleState?.opp && !st.battleState.rewards) {
        setLeaveTarget(to);
        setLeaveOpen(true);
      }
    };
    window.addEventListener("sh:battle-nav", onNavIntent);
    return () => window.removeEventListener("sh:battle-nav", onNavIntent);
  }, []);

  const leaveModal = (
    <Modal open={leaveOpen} onClose={() => setLeaveOpen(false)} title={<><Icon name="flame" size={18} color="var(--orange)" /> Уйти из боя?</>}>
      <p style={{ margin: "0 0 10px" }}>Ты уверен? Если уйдёшь сейчас — это <b>автопоражение</b>.</p>
      {battleState?.opp && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="row between"><span>Соперник</span><b>{escapeHtml(battleState.opp.name)}</b></div>
          <div className="divider" />
          <div className="row between"><span>Уровень</span><b>LVL {battleState.opp.level}</b></div>
          <div className="divider" />
          <div className="row between"><span>Сила</span><b className="row" style={{ gap: 5 }}><Icon name="swords" size={14} /> {battleState.opp.power}</b></div>
        </div>
      )}
      <p className="small muted" style={{ margin: "0 0 14px" }}>Поражение запишется по статам соперника: Эло и опыт как за проигранный бой.</p>
      <button type="button" className="btn btn--accent btn--icon" style={{ width: "100%" }} onClick={() => setLeaveOpen(false)}>
        <Icon name="swords" size={16} /> Остаться и драться
      </button>
      <div className="spacer" />
      <button
        type="button"
        className="btn btn--ghost"
        style={{ width: "100%", color: "var(--red)" }}
        onClick={() => {
          const to = leaveTarget || "/map";
          setLeaveOpen(false);
          forfeitPendingBattle();
          resetBattle();
          navigate(to);
        }}
      >
        Уйти и проиграть
      </button>
    </Modal>
  );

  if (battlePhase === "matchmaking" && battleState?.opp) {
    return (
      <>
        {leaveModal}
        <div className="battle-scene">
          <div className="battle-scene__bg" aria-hidden="true" />
        </div>
        <MatchmakingOverlay
          opp={battleState.opp}
          heroLevel={h.level}
          onDone={onMatchmakingDone}
        />
      </>
    );
  }

  if (battlePhase === "result" && battleState?.rewards) {
    const rw = battleState.rewards;
    const opp = battleState.opp || {};
    const pSrc = arenaOutcomeSprite(h.sport, !!rw.win) || sportSpriteSrc(sport);
    const oppSportId = resolveOppSportId(opp) || opp.sport || h.sport;
    const eSrc = arenaOutcomeSprite(oppSportId, !rw.win) || assetUrl(opp.sprite) || sportSpriteSrc(sportMeta(oppSportId));
    return (
      <>
        {leaveModal}
      <div className="battle-scene battle-scene--result">
        <div className="battle-scene__bg" aria-hidden="true" />
        <div className="topbar battle-scene__top">
          <div className="topbar__title"><h1>Итог боя</h1></div>
          <div className="topbar__actions"><SyncBadge /></div>
        </div>
        <div className="battle-scene__result">
          <div className={`result ${rw.win ? "result--win" : "result--lose"}`}>
            <div className="result-fighters" aria-hidden="true">
              <div className="result-fighters__side">
                <img className={`sprite-fighter ${rw.win ? "sprite-fighter--up" : "sprite-fighter--down"}`} src={pSrc} alt="" />
                <div className="small">{escapeHtml(h.name)}</div>
              </div>
              <div className="result-fighters__side">
                <img className={`sprite-fighter sprite-fighter--enemy ${rw.win ? "sprite-fighter--down" : "sprite-fighter--up"}`} src={eSrc} alt="" />
                <div className="small">{escapeHtml(opp.name || "Соперник")}</div>
              </div>
            </div>
            <div className="result__title">{rw.win ? "ПОБЕДА!" : "Почти!"}</div>
            <p className="muted" style={{ marginTop: 6 }}>
              {rw.win ? "Твой прогресс решил исход боя" : "В следующий раз получится — тренируйся!"}
            </p>
            {battleState.disc && (
              <div className="pill-row" style={{ justifyContent: "center", marginTop: 10 }}>
                <span className="chip">
                  <Icon name={battleState.disc.icon} size={14} color="var(--orange)" /> {battleState.disc.name} · {battleState.disc.tagline}
                </span>
              </div>
            )}
          </div>
          <div className="card battle-scene__card">
            <div className="row between"><span>Опыт</span><b>+{rw.xp} XP</b></div>
            <div className="divider" />
            {rw.unranked ? (
              <>
                <div className="row between">
                  <span>Режим</span>
                  <b className="row" style={{ gap: 5 }}><Icon name="team" size={15} color="var(--primary)" /> Спарринг · без рейтинга</b>
                </div>
                <div className="small muted" style={{ marginTop: 8 }}>Тренировочный бой с согильдийцем — Эло и монеты не меняются.</div>
              </>
            ) : (
              <>
                <div className="row between">
                  <span>Эло</span>
                  <b className="row" style={{ gap: 5, color: rw.trophies >= 0 ? "var(--green)" : "var(--red)" }}>
                    {rw.trophies >= 0 ? "+" : ""}{rw.trophies} <Icon name="elo" size={15} color="#FF5500" />
                  </b>
                </div>
                <div className="small muted" style={{ marginTop: 8 }}>
                  {(() => {
                    const d = (rw.oppLevel || 0) - (rw.heroLevel || 0);
                    const rel = d > 0 ? "сильнее тебя" : d < 0 ? "слабее тебя" : "равного уровня";
                    return `Соперник был ${rel} (LVL ${rw.oppLevel} против ${rw.heroLevel}) — очки начислены по разнице.`;
                  })()}
                </div>
              </>
            )}
          </div>
          <div className="section" style={{ marginTop: 14 }}>
            <button type="button" className="btn btn--accent btn--icon" onClick={() => { resetBattle(); startBattle(); }}>
              <Icon name="swords" size={18} /> Ещё бой
            </button>
            <div className="spacer" />
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => { resetBattle(); navigate(battleState?.mapMode ? "/map" : "/battle"); }}
            >
              {battleState?.mapMode ? "На карту" : "На главную"}
            </button>
          </div>
        </div>
      </div>
      </>
    );
  }

  if (battlePhase === "arena" && battleState?.result) {
    return (
      <>
        {leaveModal}
        <BattleArena
          hero={h}
          battleState={battleState}
          autoStart={!!battleState.autoStart}
          onFinished={onArenaFinished}
          onContinue={onArenaContinue}
        />
      </>
    );
  }

  return (
    <>
    {leaveModal}
    <div className="battle-scene">
      <div className="battle-scene__bg" aria-hidden="true" />
      <div className="topbar battle-scene__top">
        <div className="topbar__title"><h1>{battleState?.mapMode ? `Этап ${battleState.stage}` : "Путь славы"}</h1></div>
        <div className="topbar__actions">
          <SyncBadge />
          <button
            type="button"
            className="icon-btn"
            aria-label="История боёв"
            onClick={() => { setHistoryDetailIdx(null); setHistoryOpen(true); }}
          >
            <Icon name="scroll" size={20} />
          </button>
        </div>
      </div>

      <div className="hero-stage">
        <div className="hero-stage__figure">
          <img className="hero-stage__sprite" src={sportSpriteSrc(sport)} alt={sport?.name} />
          <div className="hero-stage__platform" aria-hidden="true" />
        </div>
      </div>

      <div className="hero-bar">
        <div className="hero-stage__info">
          <div className="hero-stage__identity">
            <LevelRingButton hero={h} className="hero-stage__lvl" />
            <div className="hero-stage__meta">
              <div className="hero-stage__name">{h.name}</div>
            </div>
          </div>
          <div className="pill-row hero-stage__pills">
            <span className="chip" data-tip="Эло — рейтинг за победы в боях">
              <Icon name="elo" size={15} color="#FF5500" /> {eloOf(h.trophies)}
            </span>
          </div>
        </div>
      </div>

      <div className="battle-dock">
        <div className="battle-scene__hud">
          <div className="row between">
            <h2 className="row" style={{ margin: 0, gap: 8, fontSize: 15 }}>
              <Icon name="bolt" size={16} color="var(--orange)" /> Скиллы в бою
            </h2>
            <button type="button" className="icon-btn" aria-label="Изменить скиллы" onClick={() => setLoadoutOpen(true)}>
              <Icon name="loadout" size={18} color="var(--orange)" />
            </button>
          </div>
          <div className="loadout-row">{loadoutChips(h)}</div>
        </div>

        <div className="battle-cta">
          <button type="button" className={`btn--battle${finding ? " is-loading" : ""}`} disabled={finding} onClick={startBattle}>
            <span className="btn--battle__ico"><Icon name={battleMode === "sparring" ? "team" : "swords"} size={30} /></span>
            <span className="btn--battle__txt">{battleState?.mapMode ? "НА ЭТАП" : battleMode === "sparring" ? "СПАРРИНГ" : "В БОЙ"}</span>
            <span className="btn--battle__sub">{finding ? "Поиск…" : battleState?.mapMode ? battleState.opp?.name : battleMode === "sparring" ? "Выбрать согильдийца" : "Найти соперника"}</span>
          </button>
          {!battleState?.mapMode && (
            <button
              type="button"
              className={`btn--battle-mode${battleMode === "sparring" ? " is-sparring" : ""}`}
              aria-label="Выбрать режим боя"
              onClick={() => setModeOpen(true)}
            >
              <span className="btn--battle-mode__ico"><Icon name={battleMode === "sparring" ? "team" : "elo"} size={22} color={battleMode === "sparring" ? "#fff" : "#FF5500"} /></span>
              <span className="btn--battle-mode__txt">Режим</span>
            </button>
          )}
        </div>
      </div>

      <Modal open={modeOpen} onClose={() => setModeOpen(false)} title={<><Icon name="swords" size={18} color="var(--orange)" /> Режим боя</>}>
        <div className="hub-modal__lead">
          <p>Рейтинг меняет Эло. Спарринг — тренировочный бой с согильдийцем без рейтинга.</p>
        </div>
        <div className="battle-mode-list">
          <button
            type="button"
            className={`battle-mode-opt${battleMode === "ranked" ? " is-on" : ""}`}
            onClick={() => pickBattleMode("ranked")}
          >
            <span className="battle-mode-opt__ico"><Icon name="elo" size={22} color="#FF5500" /></span>
            <span className="battle-mode-opt__body">
              <b>Рейтинг</b>
              <span>Случайный соперник · Эло и награды</span>
            </span>
            {battleMode === "ranked" ? <span className="chip chip--gold">Сейчас</span> : null}
          </button>
          <button
            type="button"
            className={`battle-mode-opt${battleMode === "sparring" ? " is-on" : ""}`}
            onClick={() => pickBattleMode("sparring")}
          >
            <span className="battle-mode-opt__ico"><Icon name="team" size={22} color="var(--primary)" /></span>
            <span className="battle-mode-opt__body">
              <b>Спарринг</b>
              <span>Согильдиец · без Эло</span>
            </span>
            {battleMode === "sparring" ? <span className="chip chip--gold">Сейчас</span> : null}
          </button>
        </div>
      </Modal>

      <Modal open={sparringOpen} onClose={() => setSparringOpen(false)} title={<><Icon name="team" size={18} color="var(--primary)" /> Спарринг</>}>
        {sparringLoading && (
          <div className="loading-state" role="status">
            <span className="loading-state__spinner" aria-hidden="true" />
            <span>Загружаем гильдию</span>
          </div>
        )}
        {!sparringLoading && sparringErr && (
          <div className="error-state" role="alert">
            <b>{sparringErr}</b>
            <button type="button" className="btn btn--ghost btn--sm" onClick={loadSparringMembers}>Попробовать снова</button>
          </div>
        )}
        {!sparringLoading && !sparringErr && !sparringMembers.length && (
          <div className="hub-empty">
            <Icon name="team" size={28} />
            <b>Некого вызвать</b>
            <span>В гильдии пока нет других бойцов</span>
          </div>
        )}
        {!sparringLoading && !sparringErr && sparringMembers.length > 0 && (
          <>
            <div className="hub-modal__lead">
              <p>Выбери согильдийца — бой пойдёт против его текущих статов, без Эло.</p>
            </div>
            <div className="hub-list sparring-list">
              {sparringMembers.map((m) => {
                const opp = mapPlayerToOpponent(m);
                return (
                  <button
                    key={m.id}
                    type="button"
                    className="item item--tap sparring-pick"
                    onClick={() => startSparringBattle(m)}
                  >
                    <div className="item__ico"><PersonAvatar entity={m} size={24} /></div>
                    <div className="item__body">
                      <div className="item__title">{escapeHtml(m.name)}</div>
                      <div className="item__sub">LVL {m.level} · Сила {opp.power}</div>
                    </div>
                    <span className="chip"><Icon name="elo" size={13} color="#FF5500" /> {eloOf(m.trophies)}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </Modal>

      <Modal
        open={historyOpen}
        onClose={() => { setHistoryOpen(false); setHistoryDetailIdx(null); }}
        title={<><Icon name="scroll" size={18} /> История боёв</>}
      >
        {historyDetailIdx != null && (S.battles || [])[historyDetailIdx] ? (
          <BattleHistoryDetail
            raw={(S.battles || [])[historyDetailIdx]}
            onBack={() => setHistoryDetailIdx(null)}
          />
        ) : (S.battles || []).length ? (S.battles || []).map((raw, i) => {
          const b = enrichBattleRecord(raw);
          const chance = b.winChance != null ? ` · шанс ${b.winChance}%` : "";
          const dmg = b.dmgDealt != null ? ` · −${b.dmgDealt} HP` : "";
          const modeTag = (b.unranked || b.mode === "sparring") ? " · спарринг" : "";
          return (
            <button
              key={`${b.ts || b.date || i}-${i}`}
              type="button"
              className="item item--tap"
              aria-label={`Подробности боя против ${b.opp || "соперника"}`}
              onClick={() => setHistoryDetailIdx(i)}
            >
              <div className="item__ico">{b.win ? <Icon name="trophy" size={24} color="var(--gold)" /> : <Icon name="swords" size={24} color="var(--red)" />}</div>
              <div className="item__body">
                <div className="item__title">{b.win ? "Победа" : "Поражение"} против {escapeHtml(b.opp)}</div>
                <div className="item__sub">
                  {b.date || ""}
                  {b.oppLevel ? ` · соперник LVL ${b.oppLevel}` : ""}
                  {modeTag}
                  {chance}
                  {dmg}
                </div>
              </div>
              <span className="chip chip--gold" style={{ flexShrink: 0 }}>Подробнее</span>
            </button>
          );
        }) : <p className="muted center">Пока нет боёв</p>}
      </Modal>

      <Modal open={loadoutOpen} onClose={() => setLoadoutOpen(false)} title={<><Icon name="loadout" size={18} /> Набор для боя</>}>
        {sportSkills(h.sport).filter((sk) => h.level >= sk.req).map((sk) => {
          const active = (h.loadout || []).includes(sk.id);
          return (
            <button key={sk.id} type="button" className={`item item--tap${active ? " item--current" : ""}`} onClick={() => toggleLoadoutSkill(sk.id)}>
              <div className="item__ico"><Icon name={sk.icon} size={24} color={active ? "var(--green)" : undefined} /></div>
              <div className="item__body">
                <div className="item__title">{sk.name}</div>
                <div className="item__sub">{sk.desc}</div>
              </div>
            </button>
          );
        })}
      </Modal>
    </div>
    </>
  );
}
