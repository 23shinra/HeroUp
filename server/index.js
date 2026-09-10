"use strict";

// LevelUp backend: аккаунты (ребёнок/тренер), гильдии, посещения, расписание.
// Express + SQLite (better-sqlite3). Пароли — bcrypt, сессии — JWT.

const path = require("path");
const crypto = require("crypto");
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const QRCode = require("qrcode");
const Database = require("better-sqlite3");
const {
  SKILL_BOX_COST,
  SKILL_RARITIES,
  sportSkills,
  boxSkills,
  rollSkillBox,
  seedOwnedSkills,
} = require("./loot");
const {
  normalizePhone,
  phoneLooksValid,
  sendOtp,
  verifyOtp,
} = require("./cascadeOtp");

const PORT = process.env.PORT || 3021;
const JWT_SECRET = process.env.JWT_SECRET || "sporthero-dev-secret-change-me";
const TOKEN_TTL = "180d";
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "data.db");
const TRAINING_WINDOW_MIN = Number(process.env.TRAINING_WINDOW_MIN || 120);
const APP_TZ = process.env.APP_TZ || "Asia/Almaty";

// ---------- База данных ----------
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    username_lc TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'child',
    guild_id INTEGER,
    schedule_json TEXT NOT NULL DEFAULT '{}',
    state_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS guilds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    trainer_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    child_id INTEGER NOT NULL,
    guild_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    leave_status TEXT,
    leave_requested_at TEXT,
    leave_decided_at TEXT,
    praise TEXT,
    mvp INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    decided_at TEXT,
    UNIQUE(child_id, date)
  );
`);

// Мягкие миграции для существующих баз (столбцы могли отсутствовать).
for (const [col, ddl] of [
  ["praise", "ALTER TABLE attendance ADD COLUMN praise TEXT"],
  ["mvp", "ALTER TABLE attendance ADD COLUMN mvp INTEGER NOT NULL DEFAULT 0"],
  ["leave_status", "ALTER TABLE attendance ADD COLUMN leave_status TEXT"],
  ["leave_requested_at", "ALTER TABLE attendance ADD COLUMN leave_requested_at TEXT"],
  ["leave_decided_at", "ALTER TABLE attendance ADD COLUMN leave_decided_at TEXT"],
  ["sport", "ALTER TABLE guilds ADD COLUMN sport TEXT"],
  ["schedule_json", "ALTER TABLE guilds ADD COLUMN schedule_json TEXT NOT NULL DEFAULT '{}'"],
  ["token_rev", "ALTER TABLE users ADD COLUMN token_rev INTEGER NOT NULL DEFAULT 0"],
  ["wallet_tokens", "ALTER TABLE users ADD COLUMN wallet_tokens INTEGER NOT NULL DEFAULT 0"],
  ["phone", "ALTER TABLE users ADD COLUMN phone TEXT"],
  ["password_set", "ALTER TABLE users ADD COLUMN password_set INTEGER NOT NULL DEFAULT 1"],
]) {
  try { db.exec(ddl); } catch (e) { /* столбец уже есть */ }
}
try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS users_phone_uq ON users(phone) WHERE phone IS NOT NULL AND phone != ''"); } catch (_) { /* ignore */ }

// Одноразовая заливка кошелька из state_json (только вверх, никогда вниз).
try {
  const rows = db.prepare("SELECT id, state_json, wallet_tokens FROM users").all();
  const bump = db.prepare(
    "UPDATE users SET wallet_tokens = ? WHERE id = ? AND wallet_tokens < ?"
  );
  for (const row of rows) {
    let fromJson = 0;
    try {
      fromJson = Math.max(0, Math.floor(Number(JSON.parse(row.state_json || "{}").hero?.tokens) || 0));
    } catch (_) { /* ignore */ }
    const cur = Math.max(0, Math.floor(Number(row.wallet_tokens) || 0));
    const next = Math.max(cur, fromJson);
    if (next > cur) bump.run(next, row.id, next);
  }
} catch (_) { /* ignore */ }

// Границы текущей недели (Пн..Вс) в виде дат "YYYY-MM-DD".
function weekRange(base = new Date()) {
  const d = new Date(base);
  const day = d.getDay() || 7;
  const mon = new Date(d); mon.setDate(d.getDate() - (day - 1));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const fmt = (x) => x.toISOString().slice(0, 10);
  return { from: fmt(mon), to: fmt(sun) };
}
// Число запланированных тренировок в неделю по расписанию ребёнка.
function scheduledPerWeek(scheduleJson) {
  try { const s = JSON.parse(scheduleJson || "{}"); return Object.keys(s).filter((k) => s[k] != null).length; }
  catch (e) { return 0; }
}

/** Расписание гильдии — единое для всех детей. */
function scheduleOfUser(user) {
  if (user && user.guild_id) {
    const guild = q.guildById.get(user.guild_id);
    if (guild) return safeParseJson(guild.schedule_json || "{}", {});
  }
  return safeParseJson((user && user.schedule_json) || "{}", {});
}

function scheduleJsonOfUser(user) {
  return JSON.stringify(scheduleOfUser(user));
}

/** Сохранить расписание гильдии и синхронизировать всем детям. */
function applyGuildSchedule(guildId, schedule) {
  const json = JSON.stringify(schedule && typeof schedule === "object" ? schedule : {});
  q.setGuildScheduleCol.run(json, guildId);
  q.setScheduleByGuild.run(json, guildId);
  return json;
}

const q = {
  byUsername: db.prepare("SELECT * FROM users WHERE username_lc = ?"),
  byId: db.prepare("SELECT * FROM users WHERE id = ?"),
  byPhone: db.prepare("SELECT * FROM users WHERE phone = ?"),
  insertUser: db.prepare(
    "INSERT INTO users (username, username_lc, password_hash, role, guild_id, schedule_json, state_json, phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ),
  setPhone: db.prepare("UPDATE users SET phone = ?, updated_at = datetime('now') WHERE id = ?"),
  setGuildId: db.prepare("UPDATE users SET guild_id = ? WHERE id = ?"),
  saveState: db.prepare("UPDATE users SET state_json = ?, updated_at = datetime('now') WHERE id = ?"),
  setWallet: db.prepare("UPDATE users SET wallet_tokens = ?, updated_at = datetime('now') WHERE id = ?"),
  addWallet: db.prepare("UPDATE users SET wallet_tokens = wallet_tokens + ?, updated_at = datetime('now') WHERE id = ?"),
  spendWallet: db.prepare(
    "UPDATE users SET wallet_tokens = wallet_tokens - ?, updated_at = datetime('now') WHERE id = ? AND wallet_tokens >= ?"
  ),
  setPassword: db.prepare("UPDATE users SET password_hash = ?, password_set = 1, updated_at = datetime('now') WHERE id = ?"),
  setPasswordSet: db.prepare("UPDATE users SET password_set = ?, updated_at = datetime('now') WHERE id = ?"),
  bumpTokenRev: db.prepare("UPDATE users SET token_rev = token_rev + 1, updated_at = datetime('now') WHERE id = ?"),
  deleteAttendanceByChild: db.prepare("DELETE FROM attendance WHERE child_id = ?"),
  deleteUserById: db.prepare("DELETE FROM users WHERE id = ?"),
  clearGuildForChildren: db.prepare("UPDATE users SET guild_id = NULL WHERE guild_id = ? AND role = 'child'"),
  deleteGuildById: db.prepare("DELETE FROM guilds WHERE id = ?"),
  setSchedule: db.prepare("UPDATE users SET schedule_json = ?, updated_at = datetime('now') WHERE id = ?"),
  setScheduleByGuild: db.prepare("UPDATE users SET schedule_json = ?, updated_at = datetime('now') WHERE guild_id = ? AND role = 'child'"),
  setGuildScheduleCol: db.prepare("UPDATE guilds SET schedule_json = ? WHERE id = ?"),

  insertGuild: db.prepare("INSERT INTO guilds (name, code, trainer_id, sport) VALUES (?, ?, ?, ?)"),
  guildById: db.prepare("SELECT * FROM guilds WHERE id = ?"),
  guildByCode: db.prepare("SELECT * FROM guilds WHERE code = ?"),
  guildByTrainer: db.prepare("SELECT * FROM guilds WHERE trainer_id = ?"),

  childrenOfGuild: db.prepare("SELECT * FROM users WHERE guild_id = ? AND role = 'child' ORDER BY id"),
  allChildren: db.prepare("SELECT * FROM users WHERE role = 'child'"),
  allGuilds: db.prepare("SELECT * FROM guilds"),

  attByChildDate: db.prepare("SELECT * FROM attendance WHERE child_id = ? AND date = ?"),
  insertAtt: db.prepare("INSERT INTO attendance (child_id, guild_id, date, status) VALUES (?, ?, ?, 'pending')"),
  attMine: db.prepare("SELECT * FROM attendance WHERE child_id = ? ORDER BY date DESC LIMIT 60"),
  attById: db.prepare("SELECT * FROM attendance WHERE id = ?"),
  attOfGuild: db.prepare(`
    SELECT a.*, u.username AS child_username, u.state_json AS child_state
    FROM attendance a JOIN users u ON u.id = a.child_id
    WHERE a.guild_id = ? ORDER BY (a.status = 'pending') DESC, a.date DESC LIMIT 100`),
  decideAtt: db.prepare("UPDATE attendance SET status = ?, decided_at = datetime('now') WHERE id = ?"),
  decideAttFull: db.prepare("UPDATE attendance SET status = ?, praise = ?, mvp = ?, decided_at = datetime('now') WHERE id = ?"),
  requestLeave: db.prepare("UPDATE attendance SET leave_status = 'pending', leave_requested_at = datetime('now') WHERE id = ?"),
  decideLeave: db.prepare("UPDATE attendance SET leave_status = ?, leave_decided_at = datetime('now') WHERE id = ?"),
  pendingCountByChild: db.prepare("SELECT COUNT(*) AS n FROM attendance WHERE child_id = ? AND status = 'pending'"),

  // Недельные агрегаты подтверждённых посещений.
  weekByChild: db.prepare(
    "SELECT child_id, COUNT(*) AS n FROM attendance WHERE status = 'approved' AND date >= ? AND date <= ? GROUP BY child_id"),
  weekByChildGuild: db.prepare(
    "SELECT child_id, COUNT(*) AS n FROM attendance WHERE guild_id = ? AND status = 'approved' AND date >= ? AND date <= ? GROUP BY child_id"),
  weekTotalGuild: db.prepare(
    "SELECT COUNT(*) AS n FROM attendance WHERE guild_id = ? AND status = 'approved' AND date >= ? AND date <= ?"),
  approvedByChild: db.prepare("SELECT COUNT(*) AS n FROM attendance WHERE child_id = ? AND status = 'approved'"),
};

/** Одноразовая миграция: вынести расписание с детей на гильдию и выровнять всех. */
try {
  const guilds = q.allGuilds.all();
  for (const g of guilds) {
    const current = safeParseJson(g.schedule_json || "{}", {});
    const kids = q.childrenOfGuild.all(g.id);
    let chosen = current;
    if (!Object.keys(chosen).length) {
      const counts = new Map();
      for (const kid of kids) {
        const raw = kid.schedule_json || "{}";
        const parsed = safeParseJson(raw, {});
        if (!Object.keys(parsed).length) continue;
        counts.set(raw, (counts.get(raw) || 0) + 1);
      }
      let best = null;
      let bestN = 0;
      for (const [raw, n] of counts) {
        if (n > bestN) { best = raw; bestN = n; }
      }
      if (best) chosen = safeParseJson(best, {});
    }
    applyGuildSchedule(g.id, chosen);
  }
} catch (e) {
  console.warn("guild schedule migrate:", e && e.message);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS guild_chest_claims (
    user_id INTEGER NOT NULL,
    guild_id INTEGER NOT NULL,
    week_key TEXT NOT NULL,
    coins INTEGER NOT NULL DEFAULT 60,
    claimed_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, week_key)
  );
  CREATE TABLE IF NOT EXISTS progress_snapshots (
    user_id INTEGER NOT NULL,
    day TEXT NOT NULL,
    level INTEGER NOT NULL DEFAULT 1,
    xp INTEGER NOT NULL DEFAULT 0,
    trainings INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    streak INTEGER NOT NULL DEFAULT 0,
    trophies INTEGER NOT NULL DEFAULT 0,
    coins INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, day)
  );
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'Asia/Almaty',
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS notification_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    day TEXT NOT NULL,
    sent_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, type, day)
  );
  CREATE TABLE IF NOT EXISTS exercise_sessions (
    session_id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    day TEXT NOT NULL,
    exercise_type TEXT NOT NULL,
    reps INTEGER NOT NULL DEFAULT 0,
    accepted_reps INTEGER NOT NULL DEFAULT 0,
    xp_awarded INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_exercise_sessions_user_day
    ON exercise_sessions(user_id, day);
`);

const GUILD_CHEST_COINS = 60;
/** Токены за камерные тренировки (колонка xp_awarded хранит токены). */
const EXERCISE_TOKENS_PER_REP = 1;
const EXERCISE_DAILY_TOKEN_CAP = 30;
const EXERCISE_MAX_REPS = 50;
const EXERCISE_TYPES = new Set(["squat", "pushup"]);
const STAT_POINTS_PER_LEVEL = 5;

function isoWeekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((t - yearStart) / 864e5) + 1) / 7);
  return t.getUTCFullYear() + "-W" + String(week).padStart(2, "0");
}

function xpToNextLevel(level) {
  return 100 + (Math.max(1, Number(level) || 1) - 1) * 60;
}

/** Начислить XP герою (мутирует hero). Возвращает число повышений уровня. */
function applyXpToHero(hero, amount) {
  const gain = Math.max(0, Math.floor(Number(amount) || 0));
  if (!gain) return 0;
  hero.xp = (Number(hero.xp) || 0) + gain;
  let leveled = 0;
  let level = Math.max(1, Number(hero.level) || 1);
  while (hero.xp >= xpToNextLevel(level)) {
    hero.xp -= xpToNextLevel(level);
    level += 1;
    leveled += 1;
  }
  hero.level = level;
  if (leveled) {
    hero.statPoints = (Number(hero.statPoints) || 0) + leveled * STAT_POINTS_PER_LEVEL;
  }
  return leveled;
}

function exerciseDayRemaining(userId, day) {
  const used = Number(q.exerciseDayXp.get(userId, day).xp) || 0;
  return Math.max(0, EXERCISE_DAILY_TOKEN_CAP - used);
}

function ensureHeroLootFields(hero) {
  if (!hero || typeof hero !== "object") return hero;
  if (!Number.isFinite(Number(hero.tokens))) hero.tokens = 0;
  else hero.tokens = Math.max(0, Math.floor(Number(hero.tokens)));
  hero.ownedSkills = seedOwnedSkills(hero);
  if (!Array.isArray(hero.loadout)) hero.loadout = [];
  else {
    const owned = new Set(hero.ownedSkills);
    hero.loadout = hero.loadout.filter((id) => owned.has(id)).slice(0, 3);
  }
  return hero;
}

/** Источник истины по токенам — колонка users.wallet_tokens. */
function walletOf(user) {
  return Math.max(0, Math.floor(Number(user && user.wallet_tokens) || 0));
}

function parseUserState(user) {
  const state = safeParseJson((user && user.state_json) || "{}", {});
  if (!state.hero || typeof state.hero !== "object") state.hero = {};
  state.hero.tokens = walletOf(user);
  // Расписание всегда с гильдии — не из клиентского кеша.
  if (user && user.role === "child") {
    state.hero.schedule = scheduleOfUser(user);
  }
  return state;
}

/** Сохранить прогресс, зеркаля кошелёк в hero.tokens (клиент не может его занизить). */
function persistUserState(userId, state) {
  const user = q.byId.get(userId);
  const next = state && typeof state === "object" ? JSON.parse(JSON.stringify(state)) : {};
  if (!next.hero || typeof next.hero !== "object") next.hero = {};
  next.hero.tokens = walletOf(user || { wallet_tokens: 0 });
  q.saveState.run(JSON.stringify(next), userId);
  return next;
}

/** Начислить токены (камера / админ). */
function creditWallet(userId, amount) {
  const n = Math.max(0, Math.floor(Number(amount) || 0));
  if (n > 0) q.addWallet.run(n, userId);
  return walletOf(q.byId.get(userId));
}

/**
 * Списать токены. Разрешено только явным серверным действиям (бокс)
 * или админ-эндпоинту — никогда из PUT /state.
 */
function debitWallet(userId, amount) {
  const cost = Math.max(0, Math.floor(Number(amount) || 0));
  if (cost === 0) return walletOf(q.byId.get(userId));
  const r = q.spendWallet.run(cost, userId, cost);
  if (!r.changes) return null;
  return walletOf(q.byId.get(userId));
}

/** Админ: выставить абсолютный баланс (единственный путь «удалить» токены вручную). */
function setWalletAdmin(userId, amount) {
  const n = Math.max(0, Math.floor(Number(amount) || 0));
  q.setWallet.run(n, userId);
  return walletOf(q.byId.get(userId));
}

function monthRange(base = new Date()) {
  const y = base.getFullYear();
  const m = base.getMonth();
  const from = new Date(y, m, 1);
  const to = new Date(y, m + 1, 0);
  const fmt = (x) => {
    const yy = x.getFullYear();
    const mm = String(x.getMonth() + 1).padStart(2, "0");
    const dd = String(x.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  };
  return { from: fmt(from), to: fmt(to) };
}

function datesBetween(from, to) {
  const out = [];
  const cur = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

q.chestClaimGet = db.prepare("SELECT * FROM guild_chest_claims WHERE user_id = ? AND week_key = ?");
q.chestClaimInsert = db.prepare(
  "INSERT INTO guild_chest_claims (user_id, guild_id, week_key, coins) VALUES (?, ?, ?, ?)"
);
q.exerciseBySession = db.prepare("SELECT * FROM exercise_sessions WHERE session_id = ?");
q.exerciseDayXp = db.prepare(
  "SELECT COALESCE(SUM(xp_awarded), 0) AS xp FROM exercise_sessions WHERE user_id = ? AND day = ?"
);
q.exerciseInsert = db.prepare(`
  INSERT INTO exercise_sessions (session_id, user_id, day, exercise_type, reps, accepted_reps, xp_awarded)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
q.snapshotUpsert = db.prepare(`
  INSERT INTO progress_snapshots (user_id, day, level, xp, trainings, wins, losses, streak, trophies, coins)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(user_id, day) DO UPDATE SET
    level = excluded.level,
    xp = excluded.xp,
    trainings = excluded.trainings,
    wins = excluded.wins,
    losses = excluded.losses,
    streak = excluded.streak,
    trophies = excluded.trophies,
    coins = excluded.coins
`);
q.snapshotsRange = db.prepare(
  "SELECT * FROM progress_snapshots WHERE user_id = ? AND day >= ? AND day <= ? ORDER BY day ASC"
);
q.attApprovedRange = db.prepare(
  "SELECT * FROM attendance WHERE child_id = ? AND status = 'approved' AND date >= ? AND date <= ? ORDER BY date ASC"
);
q.attPendingRange = db.prepare(
  "SELECT COUNT(*) AS n FROM attendance WHERE child_id = ? AND status = 'pending' AND date >= ? AND date <= ?"
);
q.attRange = db.prepare(
  "SELECT * FROM attendance WHERE child_id = ? AND date >= ? AND date <= ? ORDER BY date ASC"
);
q.pushByEndpoint = db.prepare("SELECT * FROM push_subscriptions WHERE endpoint = ?");
q.pushUpsert = db.prepare(`
  INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, timezone, enabled, updated_at)
  VALUES (?, ?, ?, ?, ?, 1, datetime('now'))
  ON CONFLICT(endpoint) DO UPDATE SET
    user_id = excluded.user_id,
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    timezone = excluded.timezone,
    enabled = 1,
    updated_at = datetime('now')
`);
q.pushDisable = db.prepare("UPDATE push_subscriptions SET enabled = 0, updated_at = datetime('now') WHERE user_id = ? AND endpoint = ?");
q.pushByUser = db.prepare("SELECT * FROM push_subscriptions WHERE user_id = ? AND enabled = 1");
q.pushAllEnabled = db.prepare("SELECT * FROM push_subscriptions WHERE enabled = 1");
q.notifLogged = db.prepare("SELECT 1 AS ok FROM notification_log WHERE user_id = ? AND type = ? AND day = ?");
q.notifLogInsert = db.prepare("INSERT OR IGNORE INTO notification_log (user_id, type, day) VALUES (?, ?, ?)");

function saveProgressSnapshot(userId, state) {
  const hero = (state && state.hero) || {};
  const stats = (state && state.stats) || {};
  const day = new Date().toISOString().slice(0, 10);
  q.snapshotUpsert.run(
    userId,
    day,
    Number(hero.level) || 1,
    Number(hero.xp) || 0,
    Number(stats.trainings) || 0,
    Number(stats.wins) || 0,
    Number(stats.losses) || 0,
    0,
    Number(hero.trophies) || 0,
    Number(hero.coins) || 0
  );
}

// Недельная цель гильдии: сумма запланированных тренировок всех детей vs подтверждённые.
function guildWeekly(guildId) {
  const { from, to } = weekRange();
  const kids = q.childrenOfGuild.all(guildId);
  const guild = q.guildById.get(guildId);
  const perKid = scheduledPerWeek((guild && guild.schedule_json) || "{}");
  const target = kids.length * perKid;
  const count = q.weekTotalGuild.get(guildId, from, to).n;
  return { count, target, members: kids.length, from, to };
}

// ---------- Приложение ----------
const app = express();
app.use(express.json({ limit: "1mb" }));

function signToken(user) {
  return jwt.sign({ uid: user.id, u: user.username, r: user.role, tv: user.token_rev || 0 }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function auth(req, res, next) {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(401).json({ error: "no_token" });
  try {
    const payload = jwt.verify(m[1], JWT_SECRET);
    const user = q.byId.get(payload.uid);
    if (!user) return res.status(401).json({ error: "user_gone" });
    if ((payload.tv || 0) !== (user.token_rev || 0)) return res.status(401).json({ error: "session_revoked" });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: "bad_token" });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) return res.status(403).json({ error: "forbidden" });
    next();
  };
}

// Авторизация через query-параметр (EventSource не умеет слать заголовки).
function authQuery(req, res, next) {
  const t = req.query && req.query.token;
  if (!t) return res.status(401).end();
  try {
    const payload = jwt.verify(t, JWT_SECRET);
    const user = q.byId.get(payload.uid);
    if (!user) return res.status(401).end();
    if ((payload.tv || 0) !== (user.token_rev || 0)) return res.status(401).end();
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).end();
  }
}

// ---------- Real-time (SSE) ----------
// Открытые потоки тренеров по гильдиям: guildId -> Set(res).
const guildStreams = new Map();
function notifyGuild(guildId, type) {
  const set = guildStreams.get(guildId);
  if (!set || !set.size) return;
  const msg = `event: update\ndata: ${JSON.stringify({ type, ts: Date.now() })}\n\n`;
  set.forEach((res) => { try { res.write(msg); } catch (e) {} });
}

// Открытые потоки детей: childId -> Set(res).
const childStreams = new Map();
function notifyChild(childId, type) {
  const set = childStreams.get(childId);
  if (!set || !set.size) return;
  const msg = `event: update\ndata: ${JSON.stringify({ type, ts: Date.now() })}\n\n`;
  set.forEach((res) => { try { res.write(msg); } catch (e) {} });
}

function validCreds(username, password) {
  if (typeof username !== "string" || typeof password !== "string") return "Неверные данные";
  const u = username.trim();
  if (u.length < 3 || u.length > 24) return "Логин: от 3 до 24 символов";
  if (!/^[a-zA-Z0-9_.\-]+$/.test(u)) return "Логин: латиница, цифры, _ . -";
  if (password.length < 8 || password.length > 100) return "Пароль: минимум 8 символов";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Пароль должен содержать буквы и цифры";
  return null;
}

const authAttempts = new Map();
function authRateLimit(req, res, next) {
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").toString().split(",")[0].trim();
  const key = `${ip}:${req.path}`;
  const now = Date.now();
  const item = authAttempts.get(key) || { count: 0, resetAt: now + 60000 };
  if (now > item.resetAt) { item.count = 0; item.resetAt = now + 60000; }
  item.count += 1;
  authAttempts.set(key, item);
  if (item.count > 25) return res.status(429).json({ error: "Слишком много попыток. Подожди минуту." });
  next();
}

function toMin(hm) {
  const m = String(hm || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return h * 60 + mm;
}

function safeParseJson(raw, fallback) {
  try { return JSON.parse(raw || ""); } catch (e) { return fallback; }
}

/** День недели для календарной даты YYYY-MM-DD (0=вс … 6=сб). */
function dowForDateStr(dateStr) {
  const m = String(dateStr || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return String(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12)).getUTCDay());
}

/** Границы слота в минутах от полуночи (учитывает from/to; иначе +TRAINING_WINDOW_MIN). */
function slotBoundsMinutes(slot) {
  if (slot == null) return null;
  const fromHm = typeof slot === "string" ? slot : slot.from;
  const startMin = toMin(fromHm);
  if (startMin == null) return null;
  let endMin = typeof slot === "object" ? toMin(slot.to) : null;
  if (endMin == null || endMin <= startMin) endMin = startMin + TRAINING_WINDOW_MIN;
  return { startMin, endMin };
}

/**
 * Окно тренировки в APP_TZ: расписание задаётся локальным временем (Алматы),
 * а не часовым поясом сервера (часто UTC).
 */
function trainingWindowForDate(user, dateStr, timeZone = APP_TZ) {
  const schedule = scheduleOfUser(user);
  const dow = dowForDateStr(dateStr);
  if (dow == null) return null;
  const bounds = slotBoundsMinutes(schedule[dow]);
  if (!bounds) return null;
  // Условные Date для сравнений: «локальные» часы dateStr в TZ через минуты дня.
  // Для API достаточно start/end как абсолютных моментов вокруг «сейчас».
  const localNow = localPartsInTz(new Date(), timeZone);
  const now = new Date();
  const start = new Date(now.getTime() + (bounds.startMin - localNow.minutes) * 60000);
  // Если dateStr не сегодня в TZ — сдвигаем на разницу дней.
  if (localNow.day !== dateStr) {
    const [y1, m1, d1] = localNow.day.split("-").map(Number);
    const [y2, m2, d2] = dateStr.split("-").map(Number);
    const dayDiff = Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
    start.setTime(start.getTime() + dayDiff * 86400000);
  }
  start.setSeconds(0, 0);
  const end = new Date(start.getTime() + (bounds.endMin - bounds.startMin) * 60000);
  return { start, end, bounds, timeZone };
}

function isWithinTrainingWindow(user, dateStr, now = new Date(), timeZone = APP_TZ) {
  const local = localPartsInTz(now, timeZone);
  if (local.day !== dateStr) return false;
  const schedule = scheduleOfUser(user);
  const dow = dowForDateStr(dateStr);
  if (dow == null) return false;
  const bounds = slotBoundsMinutes(schedule[dow]);
  if (!bounds) return false;
  return local.minutes >= bounds.startMin && local.minutes < bounds.endMin;
}

function todayInAppTz(now = new Date(), timeZone = APP_TZ) {
  return localPartsInTz(now, timeZone).day;
}

function ensureChildState(nextState, oldState, user) {
  const oldHero = (oldState && oldState.hero) || {};
  const nextHero = (nextState && nextState.hero) || {};
  const oldStats = (oldState && oldState.stats) || {};
  const nextStats = (nextState && nextState.stats) || {};
  const approved = q.approvedByChild.get(user.id).n || 0;

  let safeLevel = Math.max(1, Math.min(100, Number(nextHero.level) || 1));
  const prevLevel = Math.max(1, Math.min(100, Number(oldHero.level) || 1));
  if (safeLevel - prevLevel > 3) throw new Error("Подозрительный рост уровня");
  // Серверные награды (камера/сундук) не должны откатываться устаревшим PUT /state.
  if (safeLevel < prevLevel) safeLevel = prevLevel;
  const xpCap = 100 + (safeLevel - 1) * 60;
  const prevXp = Math.max(0, Number(oldHero.xp) || 0);
  let safeXp = Math.max(0, Math.min(xpCap - 1, Number(nextHero.xp) || 0));
  if (safeLevel === prevLevel && safeXp < prevXp) safeXp = Math.min(xpCap - 1, prevXp);
  const prevTrophies = Number(oldHero.trophies) || 0;
  const rawTrophies = Number(nextHero.trophies) || 0;
  if (Math.abs(rawTrophies - prevTrophies) > 25) throw new Error("Подозрительное изменение рейтинга");
  const safeTrophies = Math.max(0, Math.min(5000, rawTrophies));

  const prevCoins = Number(oldHero.coins) || 0;
  const rawCoins = Number(nextHero.coins) || 0;
  if (rawCoins - prevCoins > 1500) throw new Error("Подозрительный рост монет");
  const safeCoins = Math.max(0, Math.min(200000, rawCoins));

  // Токены живут в users.wallet_tokens — клиентский PUT никогда их не меняет.
  const safeTokens = Math.max(0, Math.floor(Number(user && user.wallet_tokens) || 0));

  const statIds = ["str", "spd", "end", "int", "team"];
  const statsObj = {};
  let statSum = 0;
  statIds.forEach((id) => {
    const v = Math.max(1, Math.min(500, Number((nextHero.stats || {})[id]) || 1));
    statsObj[id] = v;
    statSum += v;
  });
  const classBonus = nextHero.class ? 8 : 0;
  const maxStatSum = 25 + safeLevel * 5 + classBonus;
  if (statSum > maxStatSum + 4) throw new Error("Подозрительная прокачка характеристик");
  const spentPoints = Math.max(0, statSum - 25 - classBonus);
  const pointBank = safeLevel * 5 - spentPoints;
  const safeStatPoints = Math.max(0, Math.min(999, Number(nextHero.statPoints) || pointBank));
  if (safeStatPoints > pointBank + 4) throw new Error("Подозрительный запас очков");

  const trainings = Math.max(0, Math.min(approved, Number(nextStats.trainings) || approved));
  const wins = Math.max(0, Math.min(5000, Number(nextStats.wins) || 0));
  const losses = Math.max(0, Math.min(5000, Number(nextStats.losses) || 0));
  if ((wins + losses) - ((Number(oldStats.wins) || 0) + (Number(oldStats.losses) || 0)) > 20) {
    throw new Error("Подозрительно много боёв");
  }

  const merged = JSON.parse(JSON.stringify(nextState || {}));
  if (!merged.hero) merged.hero = {};
  if (!merged.stats) merged.stats = {};
  if (!merged.auth || typeof merged.auth !== "object") merged.auth = {};
  merged.auth.username = user.username;
  merged.auth.role = "child";
  merged.auth.loggedIn = true;
  merged.hero.level = safeLevel;
  merged.hero.xp = safeXp;
  merged.hero.trophies = safeTrophies;
  merged.hero.coins = safeCoins;
  merged.hero.tokens = safeTokens;
  merged.hero.stats = statsObj;
  merged.hero.statPoints = safeStatPoints;
  merged.hero.schedule = scheduleOfUser(user);
  merged.stats.trainings = trainings;
  merged.stats.wins = wins;
  merged.stats.losses = losses;
  return merged;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function genGuildCode() {
  for (let attempt = 0; attempt < 50; attempt++) {
    let code = "";
    for (let i = 0; i < 6; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    if (!q.guildByCode.get(code)) return code;
  }
  return "G" + Date.now().toString(36).toUpperCase().slice(-5);
}

// Сводка о ребёнке для тренера (парсится из его сохранённого состояния).
function childSummary(user) {
  let st = {};
  try { st = JSON.parse(user.state_json || "{}"); } catch (e) {}
  const hero = st.hero || {};
  const stats = st.stats || {};
  const schedule = scheduleOfUser(user);
  return {
    id: user.id,
    username: user.username,
    name: hero.name || user.username,
    sport: hero.sport || null,
    avatar: hero.avatar || null,
    level: hero.level || 1,
    xp: hero.xp || 0,
    trophies: hero.trophies || 0,
    statPoints: hero.statPoints || 0,
    stats: hero.stats || { str: 0, spd: 0, end: 0, int: 0, team: 0 },
    trainings: stats.trainings || 0,
    wins: stats.wins || 0,
    losses: stats.losses || 0,
    schedule,
    pending: q.pendingCountByChild.get(user.id).n,
  };
}

function guildPublic(guild) {
  if (!guild) return null;
  const trainer = q.byId.get(guild.trainer_id);
  return {
    id: guild.id,
    name: guild.name,
    code: guild.code,
    sport: guild.sport || null,
    trainerName: trainer ? trainer.username : "",
  };
}

const VALID_SPORTS = new Set(["boxing", "wrestling", "robotics"]);

function sportAvatar(sportId) {
  if (sportId === "boxing") return "boxer";
  if (sportId === "wrestling") return "wrestler";
  if (sportId === "robotics") return "roboticist";
  return "user";
}

function applyGuildSportToState(state, sportId) {
  const next = state && typeof state === "object" ? state : {};
  if (!next.hero || typeof next.hero !== "object") next.hero = {};
  next.hero.sport = sportId;
  next.hero.avatar = sportAvatar(sportId);
  return next;
}

// Новый аккаунт всегда стартует с чистого прогресса — клиентский state
// может содержать чужой localStorage после предыдущего входа на устройстве.
function freshRegisterState({ role, username, heroName, sportId, consent }) {
  const sport = sportId && VALID_SPORTS.has(sportId) ? sportId : "wrestling";
  const avatar = sportAvatar(sport);
  const name = typeof heroName === "string" ? heroName.trim().slice(0, 40) : "";
  return {
    auth: {
      loggedIn: true,
      email: "",
      username: typeof username === "string" ? username : "",
      role: role === "trainer" ? "trainer" : "child",
      consent: !!consent,
    },
    role: role === "trainer" ? "trainer" : "child",
    guild: null,
    created: true,
    hero: {
      name,
      sport,
      avatar,
      level: 1,
      xp: 0,
      coins: 60,
      trophies: 0,
      lastCheckIn: null,
      schedule: {},
      appliedAttendance: [],
      guildChestWeek: null,
      seasonId: null,
      seasonPoints: 0,
      seasonClaimed: [],
      class: null,
      stats: { str: 5, spd: 5, end: 5, int: 5, team: 5 },
      statPoints: 5,
      abilities: [],
      loadout: [],
      seenSkills: [],
      achievementsClaimed: [],
      stagesCleared: [],
      cosmetics: { owned: [], equipped: { skin: null, fx: null, pet: null, title: null } },
      clan: null,
      premium: false,
    },
    quests: { date: null, list: [] },
    battles: [],
    clanChat: {},
    stats: { trainings: 0, wins: 0, losses: 0 },
  };
}

function inviteUrlForGuild(guild, req) {
  const host = (req.get("x-forwarded-host") || req.get("host") || "train.esl.kz").split(",")[0].trim();
  const proto = (req.get("x-forwarded-proto") || req.protocol || "https").split(",")[0].trim();
  return `${proto}://${host}/auth?join=${encodeURIComponent(guild.code)}`;
}

function sessionPayload(user) {
  const guild = user.guild_id ? q.guildById.get(user.guild_id) : null;
  const schedule = scheduleOfUser(user);
  return {
    token: signToken(user),
    username: user.username,
    role: user.role,
    phone: user.phone || null,
    passwordSet: Number(user.password_set) !== 0,
    state: parseUserState(user),
    schedule,
    guild: guildPublic(guild),
  };
}

function signPhoneTicket(phone, purpose) {
  return jwt.sign(
    { phone, purpose: purpose || "register", kind: "otp_phone" },
    JWT_SECRET,
    { expiresIn: "15m" },
  );
}

function readPhoneTicket(ticket, expectedPurpose) {
  if (!ticket || typeof ticket !== "string") return null;
  try {
    const payload = jwt.verify(ticket, JWT_SECRET);
    if (payload.kind !== "otp_phone") return null;
    if (expectedPurpose && payload.purpose !== expectedPurpose) return null;
    const phone = normalizePhone(payload.phone);
    if (!phoneLooksValid(phone)) return null;
    return { phone, purpose: payload.purpose };
  } catch {
    return null;
  }
}

function otpHttpStatus(result) {
  const st = Number(result && result.status) || 0;
  if (st === 401 || st === 429 || st === 502 || st === 503) return st;
  if (result && result.success) return 200;
  return 422;
}

function publicOtpResult(result) {
  const out = {
    success: !!(result && result.success),
    message: String((result && result.message) || (result && result.success ? "OK" : "Ошибка OTP")),
  };
  if (result && result.expires_in != null) out.expires_in = result.expires_in;
  return out;
}

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Cascade OTP: отправка кода (только сервер → otp.kztusdt.kz).
app.post("/api/otp/send", authRateLimit, async (req, res) => {
  const phone = normalizePhone(req.body && req.body.phone);
  const purpose = String((req.body && req.body.purpose) || "verification").slice(0, 40);
  if (!phoneLooksValid(phone)) {
    return res.status(422).json({ success: false, message: "Неверный формат номера телефона" });
  }
  if (purpose === "login") {
    const user = q.byPhone.get(phone);
    if (!user) {
      return res.status(422).json({
        success: false,
        message: "Номер не привязан к аккаунту. Зарегистрируйся или войди по логину.",
      });
    }
  }
  if (purpose === "register") {
    const taken = q.byPhone.get(phone);
    if (taken) {
      return res.status(422).json({ success: false, message: "Этот номер уже занят" });
    }
  }
  try {
    const result = await sendOtp(phone, { purpose });
    return res.status(otpHttpStatus(result)).json(publicOtpResult(result));
  } catch {
    return res.status(502).json({ success: false, message: "Не удалось отправить код" });
  }
});

// Cascade OTP: проверка кода. login → JWT; register → phoneTicket.
app.post("/api/otp/verify", authRateLimit, async (req, res) => {
  const phone = normalizePhone(req.body && req.body.phone);
  const code = String((req.body && req.body.code) || "");
  const purpose = String((req.body && req.body.purpose) || "verification").slice(0, 40);
  if (!phoneLooksValid(phone)) {
    return res.status(422).json({ success: false, message: "Неверный формат номера телефона" });
  }
  try {
    const result = await verifyOtp(phone, code, purpose);
    if (!(result && result.success)) {
      return res.status(otpHttpStatus(result)).json(publicOtpResult(result));
    }
    if (purpose === "login") {
      const user = q.byPhone.get(phone);
      if (!user) {
        return res.status(422).json({
          success: false,
          message: "Номер не привязан к аккаунту",
        });
      }
      return res.json({ success: true, message: "Номер подтверждён", ...sessionPayload(user) });
    }
    if (purpose === "register") {
      if (q.byPhone.get(phone)) {
        return res.status(422).json({ success: false, message: "Этот номер уже занят" });
      }
      return res.json({
        success: true,
        message: "Номер подтверждён",
        phone,
        phoneTicket: signPhoneTicket(phone, "register"),
      });
    }
    return res.json({
      success: true,
      message: result.message || "Номер подтверждён",
      phone,
      phoneTicket: signPhoneTicket(phone, purpose),
    });
  } catch {
    return res.status(502).json({ success: false, message: "Не удалось проверить код" });
  }
});

// Админ: выдать / выставить токены (единственный способ уменьшить баланс).
app.post("/api/admin/wallet", (req, res) => {
  const key = process.env.ADMIN_API_KEY || "";
  if (!key || String((req.body && req.body.key) || req.get("x-admin-key") || "") !== key) {
    return res.status(403).json({ error: "forbidden" });
  }
  const username = String((req.body && req.body.username) || "").trim();
  if (!username) return res.status(400).json({ error: "username_required" });
  const user = q.byUsername.get(username.toLowerCase());
  if (!user) return res.status(404).json({ error: "user_not_found" });

  const mode = String((req.body && req.body.mode) || "set");
  const amount = Math.floor(Number(req.body && req.body.tokens));
  if (!Number.isFinite(amount) || amount < 0) {
    return res.status(400).json({ error: "tokens_must_be_non_negative_int" });
  }

  let next;
  if (mode === "add") {
    next = creditWallet(user.id, amount);
  } else if (mode === "set") {
    next = setWalletAdmin(user.id, amount);
  } else {
    return res.status(400).json({ error: "mode_must_be_set_or_add" });
  }

  const state = persistUserState(user.id, parseUserState(q.byId.get(user.id)));
  res.json({ ok: true, username: user.username, tokens: next, state });
});

// Публичная карточка гильдии по коду (для регистрации ребёнка по QR/ссылке).
app.get("/api/guild/preview", (req, res) => {
  const code = (req.query.code || "").trim().toUpperCase();
  if (!code) return res.status(400).json({ error: "Введи код гильдии" });
  const guild = q.guildByCode.get(code);
  if (!guild) return res.status(404).json({ error: "Гильдия с таким кодом не найдена" });
  res.json(guildPublic(guild));
});

// QR-код со ссылкой на регистрацию в гильдию.
app.get("/api/guild/qr", async (req, res) => {
  try {
    const code = (req.query.code || "").trim().toUpperCase();
    if (!code) return res.status(400).end();
    const guild = q.guildByCode.get(code);
    if (!guild) return res.status(404).end();
    const url = inviteUrlForGuild(guild, req);
    const buf = await QRCode.toBuffer(url, {
      type: "png",
      width: 280,
      margin: 1,
      color: { dark: "#151A2E", light: "#FFFFFF" },
    });
    res.type("image/png").set("Cache-Control", "public, max-age=300").send(buf);
  } catch (e) {
    res.status(500).end();
  }
});

// Регистрация по OTP: phoneTicket + роль + имя (+ гильдия / секция). Без логина/пароля.
app.post("/api/register", authRateLimit, (req, res) => {
  const { role, state, guildCode, guildName, sport, consent, phoneTicket, name } = req.body || {};
  const ticket = readPhoneTicket(phoneTicket, "register");
  if (!ticket) {
    return res.status(400).json({ error: "Подтверди номер телефона кодом из сообщения" });
  }
  if (q.byPhone.get(ticket.phone)) {
    return res.status(409).json({ error: "Этот номер уже зарегистрирован — войди по коду" });
  }

  const r = role === "trainer" ? "trainer" : "child";
  let u = `u${ticket.phone}`;
  if (q.byUsername.get(u.toLowerCase())) {
    u = `u${ticket.phone}_${crypto.randomBytes(2).toString("hex")}`;
  }
  // OTP-аккаунт: случайный hash, вход только по телефону.
  const hash = bcrypt.hashSync(crypto.randomBytes(24).toString("hex"), 10);
  const clientHeroName =
    (typeof name === "string" && name.trim())
    || (state && state.hero && typeof state.hero.name === "string" ? state.hero.name : "")
    || "";
  const heroName = clientHeroName.trim().slice(0, r === "child" ? 16 : 24);
  if (heroName.length < 2) {
    return res.status(400).json({ error: r === "child" ? "Введи имя героя" : "Введи своё имя" });
  }

  if (r === "trainer") {
    const sportId = typeof sport === "string" ? sport.trim() : "";
    if (!VALID_SPORTS.has(sportId)) {
      return res.status(400).json({ error: "Выбери секцию гильдии" });
    }
    const trainerState = freshRegisterState({
      role: "trainer",
      username: u,
      heroName,
      sportId,
      consent: true,
    });
    const stateJson = JSON.stringify(trainerState);
    const info = q.insertUser.run(u, u.toLowerCase(), hash, "trainer", null, "{}", stateJson, ticket.phone);
    q.setPasswordSet.run(0, info.lastInsertRowid);
    const code = genGuildCode();
    const gname = (typeof guildName === "string" && guildName.trim())
      ? guildName.trim().slice(0, 40)
      : `Гильдия ${heroName}`;
    const ginfo = q.insertGuild.run(gname, code, info.lastInsertRowid, sportId);
    q.setGuildId.run(ginfo.lastInsertRowid, info.lastInsertRowid);
    const user = q.byId.get(info.lastInsertRowid);
    return res.json(sessionPayload(user));
  }

  if (!consent) return res.status(400).json({ error: "Нужно согласие родителя" });
  if (typeof guildCode !== "string" || !guildCode.trim()) {
    return res.status(400).json({ error: "Введи код гильдии от тренера" });
  }
  const guild = q.guildByCode.get(guildCode.trim().toUpperCase());
  if (!guild) return res.status(404).json({ error: "Гильдия с таким кодом не найдена" });
  if (!guild.sport || !VALID_SPORTS.has(guild.sport)) {
    return res.status(400).json({ error: "У гильдии не указана секция — попроси тренера обновить настройки" });
  }
  const childState = freshRegisterState({
    role: "child",
    username: u,
    heroName,
    sportId: guild.sport,
    consent: true,
  });
  const childStateJson = JSON.stringify(childState);
  const info = q.insertUser.run(u, u.toLowerCase(), hash, "child", guild.id, guild.schedule_json || "{}", childStateJson, ticket.phone);
  q.setPasswordSet.run(0, info.lastInsertRowid);
  const user = q.byId.get(info.lastInsertRowid);
  notifyGuild(guild.id, "join");
  res.json(sessionPayload(user));
});

// Вход.
app.post("/api/login", authRateLimit, (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Неверные данные" });
  }
  const user = q.byUsername.get(username.trim().toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Неверный логин или пароль" });
  }
  res.json(sessionPayload(user));
});

// Текущее состояние аккаунта.
app.get("/api/state", auth, (req, res) => {
  res.json(sessionPayload(req.user));
});

// Сохранение прогресса (только ребёнок).
app.put("/api/state", auth, (req, res) => {
  const { state } = req.body || {};
  if (!state || typeof state !== "object") return res.status(400).json({ error: "no_state" });
  let normalized = state;
  if (req.user.role === "child") {
    const fresh = q.byId.get(req.user.id) || req.user;
    const oldState = parseUserState(fresh);
    try {
      normalized = ensureChildState(state, oldState, fresh);
    } catch (e) {
      return res.status(400).json({ error: e.message || "invalid_state" });
    }
    normalized = persistUserState(req.user.id, normalized);
  } else {
    q.saveState.run(JSON.stringify(normalized), req.user.id);
  }
  if (req.user.role === "child") {
    try { saveProgressSnapshot(req.user.id, normalized); } catch (e) {}
  }
  if (req.user.role === "child" && req.user.guild_id) notifyGuild(req.user.guild_id, "progress");
  res.json({ ok: true, state: normalized });
});

// Общий рейтинг: реальные игроки и гильдии из базы.
app.get("/api/leaderboard", auth, (req, res) => {
  const guildNames = {};
  q.allGuilds.all().forEach((g) => { guildNames[g.id] = g.name; });
  const { from, to } = weekRange();
  const weekMap = {};
  q.weekByChild.all(from, to).forEach((r) => { weekMap[r.child_id] = r.n; });
  const children = q.allChildren.all().map((u) => {
    let hero = {};
    try { hero = (JSON.parse(u.state_json || "{}").hero) || {}; } catch (e) {}
    return {
      id: u.id,
      name: hero.name || u.username,
      level: hero.level || 1,
      trophies: hero.trophies || 0,
      avatar: hero.avatar || "user",
      sport: hero.sport || null,
      class: hero.class || null,
      stats: hero.stats || { str: 0, spd: 0, end: 0, int: 0, team: 0 },
      loadout: hero.loadout || [],
      guildId: u.guild_id || null,
      guildName: u.guild_id ? (guildNames[u.guild_id] || null) : null,
      weekTrainings: weekMap[u.id] || 0,
      me: u.id === req.user.id,
    };
  });
  children.sort((a, b) => b.trophies - a.trophies || b.level - a.level);

  const totalsByGuild = {};
  children.forEach((c) => {
    if (!c.guildId) return;
    const t = totalsByGuild[c.guildId] || (totalsByGuild[c.guildId] = { total: 0, members: 0, week: 0 });
    t.total += c.trophies; t.members += 1; t.week += c.weekTrainings;
  });
  const guilds = q.allGuilds.all().map((g) => ({
    id: g.id,
    name: g.name,
    members: (totalsByGuild[g.id] && totalsByGuild[g.id].members) || 0,
    total: (totalsByGuild[g.id] && totalsByGuild[g.id].total) || 0,
    weekTrainings: (totalsByGuild[g.id] && totalsByGuild[g.id].week) || 0,
    mine: req.user.guild_id === g.id,
  })).sort((a, b) => b.total - a.total || b.members - a.members);

  res.json({ players: children, guilds });
});

// ---------- Посещения (ребёнок) ----------
// Заявка на посещение — ждёт подтверждения тренера.
app.post("/api/attendance", auth, requireRole("child"), (req, res) => {
  if (!req.user.guild_id) return res.status(400).json({ error: "Ты не в гильдии" });
  const date = (req.body && req.body.date) || todayInAppTz();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "bad_date" });
  const today = todayInAppTz();
  if (date !== today) return res.status(400).json({ error: "Отметить можно только сегодня" });
  const w = trainingWindowForDate(req.user, date);
  if (!w) return res.status(409).json({ error: "Сегодня нет тренировки по расписанию" });
  if (!isWithinTrainingWindow(req.user, date)) {
    return res.status(409).json({ error: "Отмечаться можно только во время тренировки" });
  }
  const existing = q.attByChildDate.get(req.user.id, date);
  if (existing) {
    if (existing.status === "approved") return res.status(409).json({ error: "Уже подтверждено" });
    if (existing.status === "pending") return res.json({ attendance: existing });
    q.decideAtt.run("pending", existing.id); // rejected → повторная заявка
    notifyGuild(req.user.guild_id, "attendance");
    return res.json({ attendance: q.attById.get(existing.id) });
  }
  const info = q.insertAtt.run(req.user.id, req.user.guild_id, date);
  notifyGuild(req.user.guild_id, "attendance");
  res.json({ attendance: q.attById.get(info.lastInsertRowid) });
});

// Заявка ребёнка на уход с тренировки (подтверждает тренер).
app.post("/api/attendance/leave", auth, requireRole("child"), (req, res) => {
  const date = (req.body && req.body.date) || todayInAppTz();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "bad_date" });
  const att = q.attByChildDate.get(req.user.id, date);
  if (!att) return res.status(404).json({ error: "Сначала отметь тренировку" });
  if (att.status !== "approved") return res.status(409).json({ error: "Уход можно запросить только после подтверждённого прихода" });
  if (att.leave_status === "pending") return res.json({ attendance: att });
  if (att.leave_status === "approved") return res.status(409).json({ error: "Уход уже подтверждён" });
  q.requestLeave.run(att.id);
  if (req.user.guild_id) notifyGuild(req.user.guild_id, "leave");
  res.json({ attendance: q.attById.get(att.id) });
});

// Поток событий ребёнка в реальном времени (SSE): решения тренера по посещениям.
app.get("/api/child/events", authQuery, requireRole("child"), (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });
  if (res.flushHeaders) res.flushHeaders();
  res.write("retry: 5000\n\n");
  res.write("event: hello\ndata: {}\n\n");

  let set = childStreams.get(req.user.id);
  if (!set) { set = new Set(); childStreams.set(req.user.id, set); }
  set.add(res);

  const ping = setInterval(() => { try { res.write(": ping\n\n"); } catch (e) {} }, 25000);
  req.on("close", () => {
    clearInterval(ping);
    const s = childStreams.get(req.user.id);
    if (s) { s.delete(res); if (!s.size) childStreams.delete(req.user.id); }
  });
});

// Свои посещения (для применения наград и отображения статуса).
app.get("/api/attendance/mine", auth, requireRole("child"), (req, res) => {
  res.json({ attendance: q.attMine.all(req.user.id) });
});

// Гильдмейты ребёнка (для страницы гильдии).
app.get("/api/guild/roster", auth, requireRole("child"), (req, res) => {
  if (!req.user.guild_id) return res.json({ guild: null, members: [], weekly: null });
  const guild = q.guildById.get(req.user.guild_id);
  const weekly = guildWeekly(req.user.guild_id);
  const weekKey = isoWeekKey();
  const claim = q.chestClaimGet.get(req.user.id, weekKey);
  const { from, to } = weekRange();
  const myWeek = (q.weekByChildGuild.all(req.user.guild_id, from, to).find((r) => r.child_id === req.user.id) || {}).n || 0;
  const members = q.childrenOfGuild.all(req.user.guild_id).map(childSummary)
    .map((c) => ({
      id: c.id,
      name: c.name,
      level: c.level,
      trophies: c.trophies,
      avatar: c.avatar,
      sport: c.sport,
      stats: c.stats,
      me: c.id === req.user.id,
    }));
  res.json({
    guild: guildPublic(guild),
    members,
    weekly: Object.assign({}, weekly, {
      weekKey,
      claimed: !!claim,
      coins: GUILD_CHEST_COINS,
      myCount: myWeek,
      reached: weekly.target > 0 && weekly.count >= weekly.target,
    }),
  });
});

// Забрать недельный сундук гильдии (серверная выдача).
app.post("/api/guild/chest/claim", auth, requireRole("child"), (req, res) => {
  if (!req.user.guild_id) return res.status(400).json({ error: "Ты не в гильдии" });
  const weekly = guildWeekly(req.user.guild_id);
  if (!weekly.target || weekly.count < weekly.target) {
    return res.status(409).json({ error: "Цель гильдии ещё не выполнена" });
  }
  const weekKey = isoWeekKey();
  const existing = q.chestClaimGet.get(req.user.id, weekKey);
  if (existing) {
    return res.json({ ok: true, already: true, coins: existing.coins, weekKey });
  }
  const state = parseUserState(req.user);
  if (!state.hero || typeof state.hero !== "object") state.hero = {};
  const coins = GUILD_CHEST_COINS;
  state.hero.coins = Math.max(0, (Number(state.hero.coins) || 0) + coins);
  state.hero.guildChestWeek = weekKey;
  state.updatedAt = Date.now();
  const tx = db.transaction(() => {
    q.chestClaimInsert.run(req.user.id, req.user.guild_id, weekKey, coins);
    persistUserState(req.user.id, state);
  });
  try {
    tx();
  } catch (e) {
    if (String(e && e.message || "").includes("UNIQUE")) {
      return res.json({ ok: true, already: true, coins, weekKey });
    }
    throw e;
  }
  const saved = parseUserState(q.byId.get(req.user.id));
  try { saveProgressSnapshot(req.user.id, saved); } catch (e) {}
  res.json({ ok: true, coins, weekKey, state: saved });
});

// Камерная тренировка: серверная идемпотентная выдача токенов (без видео).
app.get("/api/exercise/daily", auth, requireRole("child"), (req, res) => {
  const day = todayInAppTz();
  const used = Number(q.exerciseDayXp.get(req.user.id, day).xp) || 0;
  res.json({
    day,
    usedTokens: used,
    remainingTokens: Math.max(0, EXERCISE_DAILY_TOKEN_CAP - used),
    dailyCap: EXERCISE_DAILY_TOKEN_CAP,
    tokensPerRep: EXERCISE_TOKENS_PER_REP,
    // legacy aliases
    usedXp: used,
    remainingXp: Math.max(0, EXERCISE_DAILY_TOKEN_CAP - used),
    xpPerRep: EXERCISE_TOKENS_PER_REP,
  });
});

app.post("/api/exercise/session", auth, requireRole("child"), (req, res) => {
  const body = req.body || {};
  const sessionId = String(body.sessionId || "").trim().slice(0, 80);
  const exerciseType = String(body.exerciseType || body.type || "").trim().toLowerCase();
  const reps = Math.floor(Number(body.reps) || 0);
  if (!sessionId || !/^[a-zA-Z0-9_-]{8,80}$/.test(sessionId)) {
    return res.status(400).json({ error: "Некорректный sessionId" });
  }
  if (!EXERCISE_TYPES.has(exerciseType)) {
    return res.status(400).json({ error: "Доступны только squat и pushup" });
  }
  if (!Number.isFinite(reps) || reps < 0 || reps > EXERCISE_MAX_REPS) {
    return res.status(400).json({ error: `Повторы: 0…${EXERCISE_MAX_REPS}` });
  }

  const existing = q.exerciseBySession.get(sessionId);
  if (existing) {
    if (existing.user_id !== req.user.id) {
      return res.status(409).json({ error: "Сессия уже занята" });
    }
    const day = existing.day;
    const used = Number(q.exerciseDayXp.get(req.user.id, day).xp) || 0;
    const state = parseUserState(q.byId.get(req.user.id) || req.user);
    const tokensAwarded = existing.xp_awarded;
    return res.json({
      ok: true,
      already: true,
      sessionId,
      exerciseType: existing.exercise_type,
      reps: existing.reps,
      acceptedReps: existing.accepted_reps,
      tokensAwarded,
      xpAwarded: tokensAwarded,
      day,
      usedTokens: used,
      remainingTokens: Math.max(0, EXERCISE_DAILY_TOKEN_CAP - used),
      usedXp: used,
      remainingXp: Math.max(0, EXERCISE_DAILY_TOKEN_CAP - used),
      dailyCap: EXERCISE_DAILY_TOKEN_CAP,
      state,
    });
  }

  const day = todayInAppTz();
  const remaining = exerciseDayRemaining(req.user.id, day);
  const maxByCap = Math.floor(remaining / EXERCISE_TOKENS_PER_REP);
  const acceptedReps = Math.max(0, Math.min(reps, maxByCap));
  const tokensAwarded = acceptedReps * EXERCISE_TOKENS_PER_REP;

  const fresh = q.byId.get(req.user.id);
  const state = parseUserState(fresh || req.user);
  ensureHeroLootFields(state.hero);
  const dayTokens = (Number(q.exerciseDayXp.get(req.user.id, day).xp) || 0) + tokensAwarded;
  if (!state.hero.exercise || typeof state.hero.exercise !== "object") state.hero.exercise = {};
  state.hero.exercise = {
    lastDay: day,
    dayTokens,
    dayXp: dayTokens,
    lastType: exerciseType,
    lastReps: acceptedReps,
    lastSessionId: sessionId,
  };
  state.updatedAt = Date.now();

  const tx = db.transaction(() => {
    q.exerciseInsert.run(sessionId, req.user.id, day, exerciseType, reps, acceptedReps, tokensAwarded);
    if (tokensAwarded > 0) creditWallet(req.user.id, tokensAwarded);
    persistUserState(req.user.id, state);
  });
  try {
    tx();
  } catch (e) {
    if (String(e && e.message || "").includes("UNIQUE")) {
      const row = q.exerciseBySession.get(sessionId);
      const used = Number(q.exerciseDayXp.get(req.user.id, row ? row.day : day).xp) || 0;
      const awarded = row ? row.xp_awarded : tokensAwarded;
      return res.json({
        ok: true,
        already: true,
        sessionId,
        exerciseType: row ? row.exercise_type : exerciseType,
        reps: row ? row.reps : reps,
        acceptedReps: row ? row.accepted_reps : acceptedReps,
        tokensAwarded: awarded,
        xpAwarded: awarded,
        day: row ? row.day : day,
        usedTokens: used,
        remainingTokens: Math.max(0, EXERCISE_DAILY_TOKEN_CAP - used),
        usedXp: used,
        remainingXp: Math.max(0, EXERCISE_DAILY_TOKEN_CAP - used),
        dailyCap: EXERCISE_DAILY_TOKEN_CAP,
        state: parseUserState(q.byId.get(req.user.id)),
      });
    }
    throw e;
  }

  try { saveProgressSnapshot(req.user.id, parseUserState(q.byId.get(req.user.id))); } catch (e) {}
  const usedTokens = Number(q.exerciseDayXp.get(req.user.id, day).xp) || 0;
  const saved = parseUserState(q.byId.get(req.user.id));
  res.json({
    ok: true,
    already: false,
    sessionId,
    exerciseType,
    reps,
    acceptedReps,
    tokensAwarded,
    xpAwarded: tokensAwarded,
    leveled: 0,
    day,
    usedTokens,
    remainingTokens: Math.max(0, EXERCISE_DAILY_TOKEN_CAP - usedTokens),
    usedXp: usedTokens,
    remainingXp: Math.max(0, EXERCISE_DAILY_TOKEN_CAP - usedTokens),
    dailyCap: EXERCISE_DAILY_TOKEN_CAP,
    state: saved,
  });
});

// Открыть бокс навыков за токены.
app.post("/api/boxes/open", auth, requireRole("child"), (req, res) => {
  const fresh = q.byId.get(req.user.id);
  const state = parseUserState(fresh || req.user);
  ensureHeroLootFields(state.hero);

  const tokens = walletOf(fresh || req.user);
  if (tokens < SKILL_BOX_COST) {
    return res.status(400).json({
      error: `Нужно ${SKILL_BOX_COST} токенов`,
      tokens,
      cost: SKILL_BOX_COST,
    });
  }

  const skills = boxSkills(state.hero.sport);
  const roll = rollSkillBox({ skills, ownedSkills: state.hero.ownedSkills });
  // Списание токенов за открытие кейса (возврат при дубликате).
  // PUT /state кошелёк не трогает — только этот эндпоинт и /api/admin/wallet.
  const netSpend = Math.max(0, SKILL_BOX_COST - (roll.tokensRefund || 0));
  if (roll.skillId && !roll.duplicate) {
    const owned = new Set(state.hero.ownedSkills);
    owned.add(roll.skillId);
    state.hero.ownedSkills = [...owned];
  }
  state.updatedAt = Date.now();

  const boxTx = db.transaction(() => {
    if (netSpend > 0) {
      const left = debitWallet(req.user.id, netSpend);
      if (left == null) throw new Error("insufficient_tokens");
    } else if ((roll.tokensRefund || 0) > SKILL_BOX_COST) {
      creditWallet(req.user.id, (roll.tokensRefund || 0) - SKILL_BOX_COST);
    }
    persistUserState(req.user.id, state);
  });
  try {
    boxTx();
  } catch (e) {
    if (String(e && e.message) === "insufficient_tokens") {
      return res.status(400).json({
        error: `Нужно ${SKILL_BOX_COST} токенов`,
        tokens: walletOf(q.byId.get(req.user.id)),
        cost: SKILL_BOX_COST,
      });
    }
    throw e;
  }

  const boxSaved = parseUserState(q.byId.get(req.user.id));
  const rarityMeta = SKILL_RARITIES[roll.rarity] || SKILL_RARITIES.common;
  res.json({
    ok: true,
    cost: SKILL_BOX_COST,
    tokens: boxSaved.hero.tokens,
    rarity: roll.rarity,
    rarityName: rarityMeta.name,
    rarityColor: rarityMeta.color,
    skillId: roll.skillId,
    skillName: roll.skill ? roll.skill.name : null,
    duplicate: !!roll.duplicate,
    tokensRefund: roll.tokensRefund || 0,
    ownedSkills: boxSaved.hero.ownedSkills,
    state: boxSaved,
  });
});

// Сводка прогресса за неделю или месяц.
app.get("/api/progress/summary", auth, requireRole("child"), (req, res) => {
  const period = String((req.query && req.query.period) || "week");
  const range = period === "month" ? monthRange() : weekRange();
  const { from, to } = range;
  const approved = q.attApprovedRange.all(req.user.id, from, to);
  const attendance = q.attRange.all(req.user.id, from, to);
  const pending = q.attPendingRange.get(req.user.id, from, to).n || 0;
  const praises = approved.filter((a) => a.praise || a.mvp).length;
  const state = safeParseJson(req.user.state_json || "{}", {});
  const hero = state.hero || {};
  const battles = Array.isArray(state.battles) ? state.battles.filter((b) => b && b.date && b.date >= from && b.date <= to) : [];
  const wins = battles.filter((b) => b.win).length;
  const losses = battles.filter((b) => !b.win).length;
  const snapshots = q.snapshotsRange.all(req.user.id, from, to);
  const firstSnap = snapshots[0] || null;
  const lastSnap = snapshots.length ? snapshots[snapshots.length - 1] : null;
  const levelStart = firstSnap ? firstSnap.level : (hero.level || 1);
  const levelEnd = lastSnap ? lastSnap.level : (hero.level || 1);
  const scheduleDays = scheduledPerWeek(scheduleJsonOfUser(req.user));
  const days = datesBetween(from, to).map((day) => {
    const att = attendance.find((a) => a.date === day);
    const dayBattles = battles.filter((b) => b.date === day);
    const snap = snapshots.find((s) => s.day === day);
    const status = att ? att.status : null;
    return {
      date: day,
      status,
      training: status === "approved" ? 1 : 0,
      pending: status === "pending" ? 1 : 0,
      arrivedAt: att ? att.created_at : null,
      decidedAt: att ? att.decided_at : null,
      praise: att && att.praise ? att.praise : null,
      mvp: !!(att && att.mvp),
      battles: dayBattles.length,
      wins: dayBattles.filter((b) => b.win).length,
      level: snap ? snap.level : null,
    };
  });
  res.json({
    period: period === "month" ? "month" : "week",
    from,
    to,
    trainings: approved.length,
    pending,
    praises,
    battles: battles.length,
    wins,
    losses,
    levelStart,
    levelEnd,
    levelDelta: Math.max(0, levelEnd - levelStart),
    scheduleDays,
    scheduleDone: approved.length,
    days,
  });
});

// ---------- Push-подписки ----------
let webpush = null;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@train.esl.kz";
try {
  webpush = require("web-push");
  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  } else {
    webpush = null;
  }
} catch (e) {
  webpush = null;
}

app.get("/api/push/vapid-public-key", auth, (req, res) => {
  if (!VAPID_PUBLIC_KEY) return res.status(503).json({ error: "push_not_configured" });
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

app.post("/api/push/subscribe", auth, requireRole("child"), (req, res) => {
  const sub = req.body && req.body.subscription;
  if (!sub || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
    return res.status(400).json({ error: "bad_subscription" });
  }
  const timezone = typeof req.body.timezone === "string" && req.body.timezone ? req.body.timezone : "Asia/Almaty";
  q.pushUpsert.run(req.user.id, sub.endpoint, sub.keys.p256dh, sub.keys.auth, timezone);
  res.json({ ok: true });
});

app.post("/api/push/unsubscribe", auth, (req, res) => {
  const endpoint = req.body && req.body.endpoint;
  if (!endpoint) return res.status(400).json({ error: "no_endpoint" });
  q.pushDisable.run(req.user.id, endpoint);
  res.json({ ok: true });
});

app.post("/api/push/test", auth, requireRole("child"), async (req, res) => {
  if (!webpush) return res.status(503).json({ error: "push_not_configured" });
  const rows = q.pushByUser.all(req.user.id);
  if (!rows.length) return res.status(400).json({ error: "no_subscription" });
  const payload = JSON.stringify({
    title: "LevelUp",
    body: "Тестовое уведомление — пуши работают!",
    url: "/profile",
  });
  let ok = 0;
  let lastErr = null;
  for (const row of rows) {
    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        payload
      );
      ok += 1;
    } catch (err) {
      lastErr = err && (err.body || err.message || String(err.statusCode || err));
      if (err && (err.statusCode === 404 || err.statusCode === 410)) {
        try { q.pushDisable.run(req.user.id, row.endpoint); } catch (e) {}
      }
    }
  }
  if (!ok) return res.status(502).json({ error: "push_failed", detail: String(lastErr || "") });
  res.json({ ok: true, sent: ok });
});

function sendPushToUser(userId, payload, type, day) {
  if (!webpush) return 0;
  if (q.notifLogged.get(userId, type, day)) return 0;
  const rows = q.pushByUser.all(userId);
  if (!rows.length) return 0;
  let sent = 0;
  const body = JSON.stringify(payload);
  rows.forEach((row) => {
    const subscription = {
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh, auth: row.auth },
    };
    webpush.sendNotification(subscription, body).then(() => {
      sent++;
    }).catch((err) => {
      if (err && (err.statusCode === 404 || err.statusCode === 410)) {
        try { q.pushDisable.run(userId, row.endpoint); } catch (e) {}
      }
    });
  });
  try { q.notifLogInsert.run(userId, type, day); } catch (e) {}
  return rows.length;
}

function localPartsInTz(date, timeZone) {
  try {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: timeZone || "Asia/Almaty",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    });
    const parts = {};
    fmt.formatToParts(date).forEach((p) => { if (p.type !== "literal") parts[p.type] = p.value; });
    return {
      day: `${parts.year}-${parts.month}-${parts.day}`,
      minutes: Number(parts.hour) * 60 + Number(parts.minute),
    };
  } catch (e) {
    const d = date;
    return {
      day: d.toISOString().slice(0, 10),
      minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
    };
  }
}

function parseHm(hm) {
  const m = String(hm || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function runPushSchedulerTick() {
  if (!webpush) return;
  const subs = q.pushAllEnabled.all();
  const byUser = new Map();
  subs.forEach((s) => {
    if (!byUser.has(s.user_id)) byUser.set(s.user_id, s);
  });
  byUser.forEach((sub, userId) => {
    const user = q.byId.get(userId);
    if (!user || user.role !== "child") return;
    const tz = sub.timezone || "Asia/Almaty";
    const now = new Date();
    const local = localPartsInTz(now, tz);
    const day = local.day;
    const schedule = scheduleOfUser(user);
    // day-of-week in local tz
    const localDate = new Date(`${day}T12:00:00`);
    const dow = String(localDate.getDay());
    const slot = schedule[dow];
    if (!slot) return;
    const bounds = slotBoundsMinutes(slot);
    if (!bounds) return;
    const { startMin, endMin } = bounds;
    const att = q.attByChildDate.get(userId, day);
    const approved = att && att.status === "approved";
    const pending = att && att.status === "pending";

    // За 15 минут до начала.
    if (!approved && local.minutes >= startMin - 15 && local.minutes < startMin - 14) {
      sendPushToUser(userId, {
        title: "Скоро тренировка",
        body: "Через 15 минут начало — не забудь отметиться!",
        url: "/battle",
      }, "training_soon", day);
    }

    // Напоминание ближе к концу окна.
    if (!approved && !pending && local.minutes >= endMin - 30 && local.minutes < endMin - 29) {
      sendPushToUser(userId, {
        title: "Не забудь отметиться",
        body: "Тренировка скоро закончится — отметь посещение!",
        url: "/battle",
      }, "training_window_end", day);
    }
  });
}

setInterval(() => {
  try { runPushSchedulerTick(); } catch (e) { console.warn("push scheduler:", e && e.message); }
}, 60000);

// ---------- Тренер ----------
// Поток событий гильдии в реальном времени (SSE).
app.get("/api/guild/events", authQuery, requireRole("trainer"), (req, res) => {
  const guild = q.guildByTrainer.get(req.user.id);
  if (!guild) return res.status(404).end();
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });
  if (res.flushHeaders) res.flushHeaders();
  res.write("retry: 5000\n\n");
  res.write("event: hello\ndata: {}\n\n");

  let set = guildStreams.get(guild.id);
  if (!set) { set = new Set(); guildStreams.set(guild.id, set); }
  set.add(res);

  const ping = setInterval(() => { try { res.write(": ping\n\n"); } catch (e) {} }, 25000);
  req.on("close", () => {
    clearInterval(ping);
    const s = guildStreams.get(guild.id);
    if (s) { s.delete(res); if (!s.size) guildStreams.delete(guild.id); }
  });
});

app.get("/api/guild/info", auth, requireRole("trainer"), (req, res) => {
  const guild = q.guildByTrainer.get(req.user.id);
  const count = guild ? q.childrenOfGuild.all(guild.id).length : 0;
  res.json({ guild: guildPublic(guild), memberCount: count });
});

app.put("/api/guild/sport", auth, requireRole("trainer"), (req, res) => {
  const guild = q.guildByTrainer.get(req.user.id);
  if (!guild) return res.status(404).json({ error: "Гильдия не найдена" });
  const sportId = typeof req.body.sport === "string" ? req.body.sport.trim() : "";
  if (!VALID_SPORTS.has(sportId)) return res.status(400).json({ error: "Выбери секцию" });
  db.prepare("UPDATE guilds SET sport = ? WHERE id = ?").run(sportId, guild.id);
  const updated = q.guildById.get(guild.id);
  res.json({ ok: true, guild: guildPublic(updated) });
});

app.get("/api/guild/members", auth, requireRole("trainer"), (req, res) => {
  const guild = q.guildByTrainer.get(req.user.id);
  if (!guild) return res.json({ members: [], weekly: null });
  const { from, to } = weekRange();
  const weekMap = {};
  q.weekByChildGuild.all(guild.id, from, to).forEach((r) => { weekMap[r.child_id] = r.n; });
  const members = q.childrenOfGuild.all(guild.id).map((u) => {
    const c = childSummary(u);
    c.weekTrainings = weekMap[u.id] || 0;
    c.weekTarget = scheduledPerWeek(scheduleJsonOfUser(u));
    return c;
  });
  res.json({ members, weekly: guildWeekly(guild.id) });
});

// Список посещений гильдии (сначала ожидающие).
app.get("/api/guild/attendance", auth, requireRole("trainer"), (req, res) => {
  const guild = q.guildByTrainer.get(req.user.id);
  if (!guild) return res.json({ attendance: [] });
  const rows = q.attOfGuild.all(guild.id).map((a) => {
    let name = a.child_username;
    try { const st = JSON.parse(a.child_state || "{}"); if (st.hero && st.hero.name) name = st.hero.name; } catch (e) {}
    return { id: a.id, childId: a.child_id, childName: name, date: a.date, status: a.status, leave_status: a.leave_status };
  });
  res.json({ attendance: rows });
});

// Подтвердить/отклонить посещение.
app.post("/api/attendance/:id/decision", auth, requireRole("trainer"), (req, res) => {
  const guild = q.guildByTrainer.get(req.user.id);
  const att = q.attById.get(Number(req.params.id));
  if (!att || !guild || att.guild_id !== guild.id) return res.status(404).json({ error: "not_found" });
  const approve = !!(req.body && req.body.approve);
  const praise = req.body && typeof req.body.praise === "string" ? req.body.praise.trim().slice(0, 80) : "";
  const mvp = approve && !!(req.body && req.body.mvp) ? 1 : 0;
  q.decideAttFull.run(approve ? "approved" : "rejected", praise || null, mvp, att.id);
  notifyChild(att.child_id, "decision");
  res.json({ attendance: q.attById.get(att.id) });
});

// Подтвердить/отклонить уход с тренировки.
app.post("/api/attendance/:id/leave-decision", auth, requireRole("trainer"), (req, res) => {
  const guild = q.guildByTrainer.get(req.user.id);
  const att = q.attById.get(Number(req.params.id));
  if (!att || !guild || att.guild_id !== guild.id) return res.status(404).json({ error: "not_found" });
  if (att.leave_status !== "pending") return res.status(409).json({ error: "Нет заявки на уход" });
  const approve = !!(req.body && req.body.approve);
  q.decideLeave.run(approve ? "approved" : "rejected", att.id);
  notifyChild(att.child_id, "leave_decision");
  res.json({ attendance: q.attById.get(att.id) });
});

// Задать расписание гильдии (одно на всех детей).
app.put("/api/guild/member/:childId/schedule", auth, requireRole("trainer"), (req, res) => {
  const guild = q.guildByTrainer.get(req.user.id);
  const child = q.byId.get(Number(req.params.childId));
  if (!guild || !child || child.guild_id !== guild.id || child.role !== "child") {
    return res.status(404).json({ error: "not_found" });
  }
  const schedule = (req.body && req.body.schedule) || {};
  if (typeof schedule !== "object") return res.status(400).json({ error: "bad_schedule" });
  applyGuildSchedule(guild.id, schedule);
  notifyGuild(guild.id, "schedule");
  res.json({ ok: true, schedule });
});

app.put("/api/guild/schedule", auth, requireRole("trainer"), (req, res) => {
  const guild = q.guildByTrainer.get(req.user.id);
  if (!guild) return res.status(404).json({ error: "not_found" });
  const schedule = (req.body && req.body.schedule) || {};
  if (typeof schedule !== "object") return res.status(400).json({ error: "bad_schedule" });
  applyGuildSchedule(guild.id, schedule);
  notifyGuild(guild.id, "schedule");
  res.json({ ok: true, schedule });
});

app.delete("/api/guild/member/:childId", auth, requireRole("trainer"), (req, res) => {
  const guild = q.guildByTrainer.get(req.user.id);
  const child = q.byId.get(Number(req.params.childId));
  if (!guild || !child || child.guild_id !== guild.id || child.role !== "child") {
    return res.status(404).json({ error: "not_found" });
  }
  db.prepare("UPDATE users SET guild_id = NULL WHERE id = ?").run(child.id);
  notifyGuild(guild.id, "member_removed");
  res.json({ ok: true });
});

app.post("/api/guild/member/:childId/transfer", auth, requireRole("trainer"), (req, res) => {
  const guild = q.guildByTrainer.get(req.user.id);
  const child = q.byId.get(Number(req.params.childId));
  const code = String(req.body && req.body.guildCode || "").trim().toUpperCase();
  const target = q.guildByCode.get(code);
  if (!guild || !child || child.guild_id !== guild.id || child.role !== "child") {
    return res.status(404).json({ error: "not_found" });
  }
  if (!target) return res.status(404).json({ error: "Гильдия не найдена" });
  db.prepare("UPDATE users SET guild_id = ?, schedule_json = ? WHERE id = ?").run(
    target.id,
    target.schedule_json || "{}",
    child.id
  );
  notifyGuild(guild.id, "member_transfer");
  notifyGuild(target.id, "member_transfer");
  res.json({ ok: true });
});

app.post("/api/account/password", auth, (req, res) => {
  const oldPassword = String(req.body && req.body.oldPassword || "");
  const newPassword = String(req.body && req.body.newPassword || "");
  if (!Number(req.user.password_set)) {
    return res.status(400).json({ error: "Пароль не задан — войди по коду на телефон" });
  }
  if (!bcrypt.compareSync(oldPassword, req.user.password_hash)) {
    return res.status(401).json({ error: "Неверный текущий пароль" });
  }
  const err = validCreds(req.user.username, newPassword);
  if (err) return res.status(400).json({ error: err });
  q.setPassword.run(bcrypt.hashSync(newPassword, 10), req.user.id);
  const user = q.byId.get(req.user.id);
  res.json({ ok: true, ...sessionPayload(user) });
});

// Привязка телефона к аккаунту (WhatsApp OTP).
app.post("/api/account/phone/send", auth, authRateLimit, async (req, res) => {
  if (req.user.phone) {
    return res.status(400).json({ success: false, message: "Телефон уже привязан" });
  }
  const phone = normalizePhone(req.body && req.body.phone);
  if (!phoneLooksValid(phone)) {
    return res.status(422).json({ success: false, message: "Неверный формат номера телефона" });
  }
  const taken = q.byPhone.get(phone);
  if (taken) {
    return res.status(422).json({ success: false, message: "Этот номер уже занят" });
  }
  try {
    const result = await sendOtp(phone, { purpose: "bind" });
    return res.status(otpHttpStatus(result)).json(publicOtpResult(result));
  } catch {
    return res.status(502).json({ success: false, message: "Не удалось отправить код" });
  }
});

app.post("/api/account/phone/confirm", auth, authRateLimit, async (req, res) => {
  if (req.user.phone) {
    return res.status(400).json({ success: false, message: "Телефон уже привязан" });
  }
  const phone = normalizePhone(req.body && req.body.phone);
  const code = String((req.body && req.body.code) || "");
  if (!phoneLooksValid(phone)) {
    return res.status(422).json({ success: false, message: "Неверный формат номера телефона" });
  }
  try {
    const result = await verifyOtp(phone, code, "bind");
    if (!(result && result.success)) {
      return res.status(otpHttpStatus(result)).json(publicOtpResult(result));
    }
    const taken = q.byPhone.get(phone);
    if (taken) {
      return res.status(422).json({ success: false, message: "Этот номер уже занят" });
    }
    q.setPhone.run(phone, req.user.id);
    const user = q.byId.get(req.user.id);
    return res.json({ success: true, message: "Телефон привязан", ...sessionPayload(user) });
  } catch {
    return res.status(502).json({ success: false, message: "Не удалось проверить код" });
  }
});

app.post("/api/account/logout-all", auth, (req, res) => {
  q.bumpTokenRev.run(req.user.id);
  res.json({ ok: true });
});

app.delete("/api/account", auth, (req, res) => {
  const pw = String(req.body && req.body.password || "");
  if (!bcrypt.compareSync(pw, req.user.password_hash)) {
    return res.status(401).json({ error: "Неверный пароль" });
  }
  if (req.user.role === "trainer") {
    const guild = q.guildByTrainer.get(req.user.id);
    if (guild) {
      q.clearGuildForChildren.run(guild.id);
      q.deleteGuildById.run(guild.id);
    }
  } else {
    q.deleteAttendanceByChild.run(req.user.id);
  }
  q.deleteUserById.run(req.user.id);
  res.json({ ok: true });
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`LevelUp API on http://127.0.0.1:${PORT} (db: ${DB_PATH})`);
});
