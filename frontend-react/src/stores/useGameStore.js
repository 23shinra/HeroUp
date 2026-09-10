import { create } from "zustand";
import { GAME, xpToNext, STAT_POINTS_PER_LEVEL } from "@domain/game-data";
import {
  loadState,
  saveState,
  hydrateState,
  defaultState,
  bindAccountSession,
  localStateOwnsAccount,
  clearLocalAccountData,
} from "@domain/state";
import { pickNewerState, addXpPure } from "@domain/game-engine";
import { processApprovedAttendance } from "@domain/attendance";
import { todayKey } from "../lib/format.js";
import { SHApi } from "@domain/sync";

let persistTimer = null;
const BATTLE_STORAGE_KEY = "sporthero.battle";

function loadBattleFromSession() {
  try {
    const raw = sessionStorage.getItem(BATTLE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.phase || parsed.phase === "intro") return null;
    // Finished fight (rewards already applied): drop session so reload opens the battle hub,
    // not a stuck arena with a dead "В бой!" button.
    if (parsed.state?.rewards || parsed.phase === "result") {
      sessionStorage.removeItem(BATTLE_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveBattleToSession(phase, state) {
  try {
    if (!phase || phase === "intro" || !state) {
      sessionStorage.removeItem(BATTLE_STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(BATTLE_STORAGE_KEY, JSON.stringify({ phase, state }));
  } catch { /* ignore */ }
}

function stateSyncScore(st) {
  if (!st?.hero) return 0;
  const h = st.hero;
  const stats = st.stats || {};
  const heroStats = h.stats || {};
  const battles = Array.isArray(st.battles) ? st.battles.length : 0;
  const stages = h.stagesCleared?.length || 0;
  const loadout = h.loadout?.length || 0;
  const ach = h.achievementsClaimed?.length || 0;
  const seasonClaimed = h.seasonClaimed?.length || 0;
  const cosmetics = h.cosmetics?.owned?.length || 0;
  const questDone = Array.isArray(st.quests?.list)
    ? st.quests.list.filter((q) => q?.claimed).length
    : 0;
  const statSum = ["str", "spd", "end", "int", "team"].reduce(
    (a, id) => a + (Number(heroStats[id]) || 0),
    0,
  );
  const spentStatPoints = Math.max(0, (Number(h.level) || 1) * 5 - (Number(h.statPoints) || 0));
  return (
    (Number(h.level) || 1) * 1_000_000
    + (Number(h.xp) || 0) * 100
    + (Number(stats.wins) || 0) * 10_000
    + (Number(stats.losses) || 0) * 1000
    + (Number(stats.trainings) || 0) * 5000
    + battles * 300
    + stages * 500
    + (Number(h.trophies) || 0) * 10
    + (Number(h.coins) || 0)
    + (Number(h.tokens) || 0)
    + (Number(h.seasonPoints) || 0) * 5
    + statSum * 50
    + spentStatPoints * 80
    + loadout * 40
    + ach * 120
    + seasonClaimed * 90
    + cosmetics * 60
    + questDone * 70
    + (h.class ? 500 : 0)
    + (Number(st.updatedAt) || 0) / 1e13
  );
}

function addXpToHero(h, amount) {
  let xp = (h.xp || 0) + amount;
  let level = h.level || 1;
  let leveled = 0;
  while (xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level++;
    leveled++;
  }
  h.xp = xp;
  h.level = level;
  if (leveled) h.statPoints = (h.statPoints || 0) + leveled * STAT_POINTS_PER_LEVEL;
  return { amount, leveled };
}

export const useGameStore = create((set, get) => ({
  S: loadState(),
  booted: false,
  booting: false,
  sessionExpiredBound: false,
  toast: null,
  toastTimer: null,
  battleMode: "ranked",
  battlePhase: loadBattleFromSession()?.phase || "intro",
  battleState: loadBattleFromSession()?.state || null,
  myAttendance: [],

  setS: (updater) => {
    const prev = get().S;
    let next = typeof updater === "function" ? updater(prev) : updater;
    if (!next || typeof next !== "object") return prev;
    // Клиент не может сам уменьшить токены — только сервер/админ через applyServerState.
    const prevTokens = Math.max(0, Math.floor(Number(prev?.hero?.tokens) || 0));
    const nextTokens = Math.max(0, Math.floor(Number(next?.hero?.tokens) || 0));
    if (next.hero && nextTokens < prevTokens) {
      next = { ...next, hero: { ...next.hero, tokens: prevTokens } };
    }
    saveState(next);
    set({ S: next });
    get().persistDebounced();
    return next;
  },

  persistDebounced: () => {
    if (!SHApi.hasToken()) return;
    SHApi.parkSaveState(get().S);
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      SHApi.flushOutbox().catch((e) => {
        if (e?.status === 401) get().logout();
      });
    }, 700);
  },

  persistNow: () => {
    const next = get().S;
    saveState(next);
    set({ S: next });
    if (SHApi.hasToken()) {
      SHApi.parkSaveState(next);
      return SHApi.flushOutbox();
    }
    return Promise.resolve();
  },

  toastMsg: (msg, ms = 2800) => {
    clearTimeout(get().toastTimer);
    const timer = setTimeout(() => set({ toast: null, toastTimer: null }), ms);
    set({ toast: msg, toastTimer: timer });
  },

  setBattleMode: (mode) => set({ battleMode: mode }),
  setBattlePhase: (phase) => {
    const st = get().battleState;
    saveBattleToSession(phase, st);
    set({ battlePhase: phase });
  },
  setBattleState: (battleState) => {
    const phase = get().battlePhase;
    saveBattleToSession(phase, battleState);
    set({ battleState });
  },
  resetBattle: () => {
    saveBattleToSession(null, null);
    set({ battlePhase: "intro", battleState: null });
  },

  upsertAttendance: (a) => {
    if (!a) return;
    set((prev) => {
      const list = [...prev.myAttendance];
      const i = list.findIndex((x) => x.date === a.date);
      if (i >= 0) list[i] = a;
      else list.unshift(a);
      return { myAttendance: list };
    });
  },

  ensureQuests: () => {
    get().setS((S) => {
      if (S.quests?.date === todayKey()) return S;
      const shuffled = [...GAME.questPool].sort(() => Math.random() - 0.5).slice(0, 3);
      return {
        ...S,
        quests: {
          date: todayKey(),
          list: shuffled.map((q) => ({ ...q, progress: 0, claimed: false })),
        },
      };
    });
  },

  questProgress: (type, n = 1) => {
    get().ensureQuests();
    get().setS((S) => ({
      ...S,
      quests: {
        ...S.quests,
        list: (S.quests?.list || []).map((q) => (
          q.type === type && !q.claimed
            ? { ...q, progress: Math.min(q.target, (q.progress || 0) + n) }
            : q
        )),
      },
    }));
  },

  applySession: (d, greeting) => {
    const username = d.username || "";
    bindAccountSession(username);
    let S = hydrateState(d.state || {});
    S.auth = S.auth || {};
    S.auth.loggedIn = true;
    S.auth.username = username;
    S.auth.phone = d.phone || S.auth.phone || "";
    S.auth.passwordSet = d.passwordSet !== undefined ? !!d.passwordSet : !!S.auth.passwordSet;
    S.role = d.role || "child";
    S.guild = d.guild || S.guild || null;
    if (S.role === "child") {
      S.hero = S.hero || {};
      // Серверное расписание гильдии — источник истины (не локальный кеш).
      const sched = d.schedule || d.state?.hero?.schedule;
      if (sched && typeof sched === "object") S.hero.schedule = sched;
      S.created = !!(S.hero && S.hero.name);
    } else {
      S.created = true;
    }
    S = saveState(S);
    set({ S });
    if (greeting) get().toastMsg(greeting);
    return S;
  },

  logout: () => {
    SHApi.logout();
    clearLocalAccountData();
    set({
      S: defaultState(),
      battlePhase: "intro",
      battleState: null,
      myAttendance: [],
    });
  },

  addXp: (amount) => {
    get().setS((S) => {
      const h = { ...S.hero };
      addXpToHero(h, amount);
      return { ...S, hero: h };
    });
  },

  addCoins: (amount) => {
    get().setS((S) => ({
      ...S,
      hero: { ...S.hero, coins: (S.hero.coins || 0) + amount },
    }));
  },

  syncAttendance: async () => {
    try {
      const d = await SHApi.myAttendance();
      const list = d.attendance || [];
      get().ensureQuests();
      const { S: nextS, applied } = processApprovedAttendance(get().S, list, addXpPure);
      if (applied) {
        saveState(nextS);
        set({ S: nextS, myAttendance: list });
        get().persistDebounced();
      } else {
        set({ myAttendance: list });
      }
      return { list, applied };
    } catch {
      return { list: get().myAttendance, applied: null };
    }
  },

  /** Применить серверный state после камерной тренировки / outbox flush. */
  applyServerState: (remoteState) => {
    if (!remoteState || typeof remoteState !== "object") return get().S;
    const local = get().S;
    const remoteTokens = remoteState.hero && "tokens" in remoteState.hero
      ? Math.max(0, Math.floor(Number(remoteState.hero.tokens) || 0))
      : null;
    const localTokens = Math.max(0, Math.floor(Number(local.hero?.tokens) || 0));
    const hydrated = hydrateState({
      ...local,
      ...remoteState,
      hero: { ...(local.hero || {}), ...(remoteState.hero || {}) },
      stats: { ...(local.stats || {}), ...(remoteState.stats || {}) },
      auth: { ...(local.auth || {}), ...(remoteState.auth || {}) },
    });
    // Сервер — источник истины, но локально не даём случайно просесть ниже известного баланса
    // (кроме явного ответа сервера, который уже учтён в remoteTokens).
    if (remoteTokens != null) hydrated.hero.tokens = remoteTokens;
    else hydrated.hero.tokens = Math.max(localTokens, Math.max(0, Math.floor(Number(hydrated.hero.tokens) || 0)));
    saveState(hydrated);
    set({ S: hydrated });
    return hydrated;
  },

  completeExerciseSession: async ({ sessionId, exerciseType, reps }) => {
    const result = await SHApi.completeExerciseSessionQueued({ sessionId, exerciseType, reps });
    if (result?.state) {
      get().applyServerState(result.state);
      get().persistDebounced();
    }
    return result;
  },

  openSkillBox: async () => {
    const result = await SHApi.openSkillBox();
    if (result?.state) {
      get().applyServerState(result.state);
      get().persistDebounced();
    }
    return result;
  },

  boot: async () => {
    if (get().booting) return;
    set({ booting: true });
    SHApi.startSyncWatchers();

    if (typeof window !== "undefined" && !get().sessionExpiredBound) {
      window.addEventListener("sporthero-session-expired", () => {
        get().logout();
        get().toastMsg("Сессия истекла — войди снова");
      });
      window.addEventListener("sporthero-state-patch", (ev) => {
        if (ev?.detail) get().applyServerState(ev.detail);
      });
      set({ sessionExpiredBound: true });
    }

    let S = loadState();

    if (SHApi.hasToken()) {
      const local = loadState();
      if (SHApi.isOnline()) {
        try {
          await SHApi.flushOutbox();
        } catch {
          /* ignore */
        }
      }
      try {
        if (!SHApi.isOnline()) throw Object.assign(new Error("Нет сети"), { status: 0, offline: true });
        const d = await SHApi.getState();
        const remote = hydrateState(d.state || {});
        remote.auth = remote.auth || {};
        remote.auth.username = d.username || remote.auth.username || "";
        remote.auth.phone = d.phone || remote.auth.phone || "";
        remote.auth.passwordSet = d.passwordSet !== undefined ? !!d.passwordSet : !!remote.auth.passwordSet;
        const localReady = localStateOwnsAccount(local, d.username) ? local : null;
        const chosen = pickNewerState(localReady, remote);
        S = hydrateState(chosen || remote);
        S.auth.loggedIn = true;
        S.auth.username = d.username || S.auth.username || "";
        S.auth.phone = d.phone || S.auth.phone || "";
        S.auth.passwordSet = d.passwordSet !== undefined ? !!d.passwordSet : !!S.auth.passwordSet;
        S.role = d.role || S.role || "child";
        S.guild = d.guild || S.guild || null;
        if (S.role === "child") {
          S.hero = S.hero || {};
          const sched = d.schedule || d.state?.hero?.schedule;
          if (sched && typeof sched === "object") S.hero.schedule = sched;
          S.created = !!(S.hero && S.hero.name);
        } else {
          S.created = true;
        }
        bindAccountSession(S.auth.username);
        S = saveState(S);
        if (localReady && stateSyncScore(localReady) > stateSyncScore(remote)) {
          SHApi.parkSaveState(S);
          try {
            const r = await SHApi.flushOutbox();
            if (r?.flushed > 0) get().toastMsg("Офлайн-прогресс синхронизирован");
          } catch {
            /* ignore */
          }
        }
        if (S.role === "child") await get().syncAttendance();
      } catch (e) {
        if (e?.status === 401) {
          SHApi.logout();
          S = defaultState();
        } else {
          const bound = localStateOwnsAccount(local, local.auth?.username)
            ? local.auth?.username
            : "";
          const ownLocal = localStateOwnsAccount(local, bound) || (local.created && bound);
          S = ownLocal ? local : defaultState();
          if (S.auth) S.auth.loggedIn = true;
          if (S.created && ownLocal) SHApi.parkSaveState(S);
        }
      }
    }

    set({ S, booted: true, booting: false });
  },

  isReady: () => {
    const { S } = get();
    return SHApi.hasToken() && S.auth?.loggedIn && S.created;
  },

  ensureSeason: () => {
    const season = GAME.season;
    if (!season) return;
    get().setS((S) => {
      const h = { ...S.hero };
      if (h.seasonId !== season.id) {
        h.seasonId = season.id;
        h.seasonPoints = 0;
        h.seasonClaimed = [];
      }
      return { ...S, hero: h };
    });
  },
}));

export { addXpToHero, GAME, xpToNext };
