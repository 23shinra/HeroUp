// Хранение состояния героя в localStorage.
// v2: с переходом на серверные аккаунты старый локальный прогресс сбрасывается —
// все начинают с чистого листа и регистрируют аккаунт.
export const STORAGE_KEY = "sporthero.save.v2";
export const ACCOUNT_KEY = "sporthero.account";
const LEGACY_STORAGE_KEYS = ["sporthero.save.v1"];
try { LEGACY_STORAGE_KEYS.forEach((k) => localStorage.removeItem(k)); } catch (e) {}

export function normAccount(username) {
  return String(username || "").trim().toLowerCase();
}

export function getBoundAccount() {
  try { return normAccount(localStorage.getItem(ACCOUNT_KEY)); } catch (e) { return ""; }
}

export function setBoundAccount(username) {
  try {
    const u = normAccount(username);
    if (u) localStorage.setItem(ACCOUNT_KEY, u);
    else localStorage.removeItem(ACCOUNT_KEY);
  } catch (e) {}
}

export function defaultState() {
  return {
    auth: { loggedIn: false, email: "", username: "", role: "child", consent: false },
    role: "child", // child | trainer
    guild: null, // { id, name, code, trainerName }
    created: false,
    hero: {
      name: "",
      sport: "wrestling",
      avatar: "wrestler",
      level: 1,
      xp: 0,
      coins: 60,
      trophies: 0,
      lastCheckIn: null, // ISO дата последней тренировки
      schedule: {}, // расписание тренировок (задаёт тренер): { "1": {from,to}, ... } ключ = день недели (0=Вс..6=Сб)
      appliedAttendance: [], // id подтверждённых посещений, за которые уже начислена награда
      guildChestWeek: null, // неделя, за которую забран гильдейский сундук
      seasonId: null, // id текущего сезона (для сброса при новом)
      seasonPoints: 0, // очки сезонного пути
      seasonClaimed: [], // забранные ступени сезона (по need)
      class: null,
      stats: { str: 5, spd: 5, end: 5, int: 5, team: 5 },
      statPoints: 5, // очки характеристик к распределению (по 5 за уровень)
      abilities: [],
      loadout: [], // выбранные супер-скиллы для боя (до 3)
      seenSkills: [], // просмотренные открытые скиллы (для бейджа «новый навык»)
      achievementsClaimed: [], // полученные достижения
      stagesCleared: [], // пройденные этапы карты боёв
      cosmetics: { owned: [], equipped: { skin: null, fx: null, pet: null, title: null } },
      clan: null,
      premium: false,
    },
    quests: { date: null, list: [] },
    battles: [], // история боёв
    clanChat: {}, // сообщения чата по секциям (clanId -> [msg])
    stats: { trainings: 0, wins: 0, losses: 0 },
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    // мягкое слияние на случай новых полей
    return hydrateState(parsed);
  } catch (e) {
    console.warn("Не удалось загрузить сохранение:", e);
    return defaultState();
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    const u = state && state.auth && state.auth.username;
    if (u) setBoundAccount(u);
  } catch (e) {
    console.warn("Не удалось сохранить:", e);
  }
  return state;
}

export function resetState() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
}

/** Полный сброс локального прогресса при смене / выходе из аккаунта. */
export function clearLocalAccountData() {
  resetState();
  setBoundAccount("");
}

/** Привязывает устройство к логину. Если логин сменился — выбрасывает чужой сейв. */
export function bindAccountSession(username) {
  const next = normAccount(username);
  const prev = getBoundAccount();
  let localUser = "";
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      localUser = normAccount(parsed && parsed.auth && parsed.auth.username);
    }
  } catch (e) {}
  const mismatch = (prev && next && prev !== next) || (localUser && next && localUser !== next);
  if (mismatch || !next) {
    resetState();
  }
  setBoundAccount(next);
  return !mismatch;
}

/** Локальный сейв принадлежит этому аккаунту? */
export function localStateOwnsAccount(state, username) {
  if (!state || !state.created) return false;
  const want = normAccount(username);
  if (!want) return false;
  const have = normAccount(state.auth && state.auth.username) || getBoundAccount();
  return !!have && have === want;
}

/** Приводит произвольный объект (например, пришедший с сервера) к полной структуре состояния. */
export function hydrateState(obj) {
  const merged = deepMerge(defaultState(), obj && typeof obj === "object" ? obj : {});
  if (merged.hero) {
    delete merged.hero.streak;
    delete merged.hero.streakMilestonesClaimed;
  }
  return merged;
}

export function deepMerge(base, override) {
  if (Array.isArray(base)) return override ?? base;
  if (typeof base === "object" && base !== null) {
    const out = { ...base };
    for (const key of Object.keys(base)) {
      if (override && key in override) out[key] = deepMerge(base[key], override[key]);
    }
    // сохраняем поля, которых нет в base
    if (override) for (const key of Object.keys(override)) if (!(key in out)) out[key] = override[key];
    return out;
  }
  return override ?? base;
}
