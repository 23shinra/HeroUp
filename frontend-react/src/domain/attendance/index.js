import { GAME } from "../game-data/index.js";
import { todayKey } from "../../lib/format.js";

export const WEEK_DAYS = [
  { i: 1, name: "Пн" }, { i: 2, name: "Вт" }, { i: 3, name: "Ср" },
  { i: 4, name: "Чт" }, { i: 5, name: "Пт" }, { i: 6, name: "Сб" }, { i: 0, name: "Вс" },
];

export const PRAISE_PRESETS = [
  "Молодец!", "Отличная работа!", "Так держать!", "Супер старание!", "Гордимся тобой!",
];

export function addMinutes(hm, min) {
  const [h, m] = (hm || "18:00").split(":").map(Number);
  const t = ((h * 60 + m + min) % 1440 + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

export function normSlot(v) {
  if (!v) return null;
  if (typeof v === "string") return { from: v, to: addMinutes(v, GAME.trainingWindowMin) };
  const from = v.from || "18:00";
  return { from, to: v.to || addMinutes(from, GAME.trainingWindowMin) };
}

export function slotLabel(v) {
  const s = normSlot(v);
  return s ? `${s.from}–${s.to}` : "";
}

export function toMin(hm) {
  const [h, m] = (hm || "0:0").split(":").map(Number);
  return h * 60 + m;
}

export function trainingSchedule(hero) {
  return hero?.schedule || {};
}

export function windowForDate(date, schedule) {
  const slot = normSlot((schedule || trainingSchedule({}))[String(date.getDay())]);
  if (!slot) return null;
  const [h, m] = slot.from.split(":").map(Number);
  const start = new Date(date);
  start.setHours(h, m, 0, 0);
  const [eh, em] = slot.to.split(":").map(Number);
  const end = new Date(date);
  end.setHours(eh, em, 0, 0);
  if (end <= start) end.setTime(start.getTime() + GAME.trainingWindowMin * 60000);
  return { start, end };
}

export function checkinStatus(hero) {
  const sched = trainingSchedule(hero);
  const hasSchedule = Object.keys(sched).length > 0;
  const now = new Date();
  const claimedToday = hero?.lastCheckIn === todayKey();

  let active = false;
  let msLeft = 0;
  const todayW = windowForDate(now, sched);
  if (todayW && now >= todayW.start && now < todayW.end) {
    active = true;
    msLeft = todayW.end - now;
  }

  let next = null;
  for (let d = 0; d <= 7; d++) {
    const day = new Date(now);
    day.setDate(now.getDate() + d);
    const w = windowForDate(day, sched);
    if (w && w.start > now) {
      next = w.start;
      break;
    }
  }

  return { hasSchedule, active, claimedToday, msLeft, next, canClaim: active && !claimedToday };
}

export function fmtClock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${pad(m)}:${pad(ss)}`;
}

export function fmtDur(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d} дн ${h} ч`;
  if (h > 0) return `${h} ч ${m} мин`;
  return fmtClock(ms);
}

export function weekDates(base = new Date()) {
  const d = new Date(base);
  const day = d.getDay() || 7;
  const mon = new Date(d);
  mon.setDate(d.getDate() - (day - 1));
  const out = [];
  for (let i = 0; i < 7; i++) {
    const x = new Date(mon);
    x.setDate(mon.getDate() + i);
    out.push(x.toISOString().slice(0, 10));
  }
  return out;
}

export function weeklyGoal(hero, myAttendance) {
  const sched = trainingSchedule(hero);
  const target = WEEK_DAYS.filter((d) => sched[d.i] != null).length;
  const wd = new Set(weekDates());
  const done = (myAttendance || []).filter((a) => a.status === "approved" && wd.has(a.date)).length;
  return { target, done };
}

export function attendanceForToday(myAttendance) {
  return (myAttendance || []).find((a) => a.date === todayKey());
}

export function computeStreak(dates) {
  const set = new Set(dates);
  if (!set.size) return 0;
  const sorted = [...set].sort();
  let cur = new Date(`${sorted[sorted.length - 1]}T00:00:00`);
  let streak = 1;
  while (true) {
    const prev = new Date(cur.getTime() - 864e5);
    const key = prev.toISOString().slice(0, 10);
    if (set.has(key)) {
      streak++;
      cur = prev;
    } else break;
  }
  return streak;
}

export function activeEvent() {
  const today = todayKey();
  const ev = (GAME.events || []).find((e) => e.from <= today && today <= e.to);
  if (ev) return ev;
  const dow = new Date().getDay();
  if ((dow === 0 || dow === 6) && GAME.weekendBonus) return GAME.weekendBonus;
  return null;
}

export function xpMultiplier() {
  const e = activeEvent();
  return e?.xpMult ? e.xpMult : 1;
}

export function inviteJoinUrl(code) {
  if (typeof window === "undefined") return `/auth?join=${encodeURIComponent(code)}`;
  return `${window.location.origin}/auth?join=${encodeURIComponent(code)}`;
}

export function guildQrSrc(code) {
  if (!code) return "";
  return `/api/guild/qr?code=${encodeURIComponent(code)}&t=${Date.now()}`;
}

function grantStreakMilestones(hero) {
  const claimed = hero.streakMilestonesClaimed || [];
  let out = null;
  (GAME.streakRewards || []).forEach((m) => {
    if (hero.streak >= m.days && !claimed.includes(m.days)) {
      claimed.push(m.days);
      hero.coins = (hero.coins || 0) + m.coins;
      out = m;
    }
  });
  hero.streakMilestonesClaimed = claimed;
  return out;
}

/**
 * Applies trainer-approved attendance rewards not yet credited locally.
 * Returns { S, applied } where applied is null if nothing new.
 */
export function processApprovedAttendance(S, list, addXpPure) {
  const hero = { ...S.hero };
  const stats = { ...(S.stats || {}) };
  const appliedIds = [...(hero.appliedAttendance || [])];
  const approved = (list || []).filter((a) => a.status === "approved");
  const fresh = approved
    .filter((a) => !appliedIds.includes(a.id))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  if (!fresh.length) return { S, applied: null };

  let totalXp = 0;
  let leveled = 0;
  let coins = 0;
  let praise = null;
  let mvp = false;

  fresh.forEach((a) => {
    const gain = Math.round(GAME.xpPerTraining * xpMultiplier());
    const r = addXpPure(hero, gain);
    totalXp += r.amount;
    leveled += r.leveled;
    coins += GAME.coinsPerTraining;
    hero.coins = (hero.coins || 0) + GAME.coinsPerTraining;
    hero.seasonPoints = (hero.seasonPoints || 0) + ((GAME.season && GAME.season.pointsPerTraining) || 0);
    stats.trainings = (stats.trainings || 0) + 1;
    appliedIds.push(a.id);
    if (a.praise) praise = a.praise;
    if (a.mvp) mvp = true;
  });

  hero.appliedAttendance = appliedIds;
  hero.streak = computeStreak(approved.map((a) => a.date));
  const latest = approved.map((a) => a.date).sort().pop();
  if (latest) hero.lastCheckIn = latest;

  const season = GAME.season;
  if (season && hero.seasonId !== season.id) {
    hero.seasonId = season.id;
    hero.seasonPoints = hero.seasonPoints || 0;
    hero.seasonClaimed = hero.seasonClaimed || [];
  }

  const milestone = grantStreakMilestones(hero);

  const quests = S.quests?.date === todayKey()
    ? { ...S.quests, list: (S.quests.list || []).map((q) => {
      if (q.type === "training" && !q.claimed) {
        return { ...q, progress: Math.min(q.target, (q.progress || 0) + fresh.length) };
      }
      return q;
    }) }
    : S.quests;

  return {
    S: { ...S, hero, stats, quests },
    applied: { count: fresh.length, xp: totalXp, leveled, coins, milestone, praise, mvp },
  };
}
