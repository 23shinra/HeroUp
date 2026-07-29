import {
  bindAccountSession,
  clearLocalAccountData,
  resetState,
} from "../state/index.js";

const API_BASE = "/api";
const TOKEN_KEY = "sporthero.token";
const OUTBOX_KEY = "sporthero.outbox.v1";

function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || null; } catch (e) { return null; }
}
function setToken(t) {
  try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch (e) {}
}

function isOnline() {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

function readOutbox() {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function writeOutbox(items) {
  try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(items || [])); } catch (e) {}
  notifyOutboxChange();
}

function outboxCount() { return readOutbox().length; }

function notifyOutboxChange() {
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("sporthero-sync", {
        detail: { pending: outboxCount(), flushing, online: isOnline() },
      }));
    }
  } catch (e) {}
}

function requestBackgroundSync() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.ready.then((reg) => {
    if (reg.sync && typeof reg.sync.register === "function") {
      return reg.sync.register("sporthero-sync");
    }
  }).catch(() => {});
}

function enqueue(job) {
  let items = readOutbox();
  // Полный стейт — оставляем только последнюю версию.
  if (job.type === "saveState") {
    items = items.filter((x) => x.type !== "saveState");
  }
  // Одна заявка на дату/тип.
  if (job.type === "attendance" || job.type === "attendanceLeave") {
    const date = job.payload && job.payload.date;
    items = items.filter((x) => !(x.type === job.type && x.payload && x.payload.date === date));
  }
  // Камерная сессия — уникальна по sessionId.
  if (job.type === "exerciseSession") {
    const sid = job.payload && job.payload.sessionId;
    items = items.filter((x) => !(x.type === "exerciseSession" && x.payload && x.payload.sessionId === sid));
  }
  // Снимок payload, чтобы дальнейшие мутации S не портили очередь.
  let payload = job.payload;
  try { payload = JSON.parse(JSON.stringify(job.payload)); } catch (e) {}
  items.push({
    id: job.id || (Date.now() + "-" + Math.random().toString(36).slice(2, 8)),
    type: job.type,
    payload,
    createdAt: Date.now(),
  });
  writeOutbox(items);
  requestBackgroundSync();
}

/** Сразу положить актуальный прогресс в очередь (без ожидания сети). */
function parkSaveState(state) {
  if (!getToken() || !state) return false;
  enqueue({ type: "saveState", payload: state });
  return true;
}

let flushing = false;
function isFlushing() { return flushing; }

async function request(path, opts = {}) {
  const headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
  const tok = getToken();
  if (tok) headers.Authorization = "Bearer " + tok;
  let res;
  try {
    res = await fetch(API_BASE + path, {
      method: opts.method || "GET",
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch (e) {
    const err = new Error("Нет сети");
    err.status = 0;
    err.offline = true;
    throw err;
  }
  let data = null;
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) {
    const err = new Error((data && data.error) || ("Ошибка сервера (" + res.status + ")"));
    err.status = res.status;
    throw err;
  }
  return data;
}

async function register(payload) {
  const d = await request("/register", { method: "POST", body: payload });
  // Новый аккаунт: не тащим чужой outbox/сейв с устройства.
  writeOutbox([]);
  bindAccountSession(d.username || (payload && payload.username));
  setToken(d.token);
  return d;
}
async function login(username, password) {
  const d = await request("/login", { method: "POST", body: { username, password } });
  const nextUser = d.username || username;
  // Смена аккаунта / чужой сейв на устройстве — сброс; outbox не должен
  // уехать на сервер от предыдущего героя.
  writeOutbox([]);
  bindAccountSession(nextUser);
  setToken(d.token);
  return d;
}
async function getState() { return request("/state"); }
async function saveState(state) { return request("/state", { method: "PUT", body: { state } }); }
function logout() {
  setToken(null);
  writeOutbox([]);
  clearLocalAccountData();
}

// Ребёнок
async function requestAttendance(date) { return request("/attendance", { method: "POST", body: { date } }); }
async function requestLeaveAttendance(date) { return request("/attendance/leave", { method: "POST", body: { date } }); }
async function myAttendance() { return request("/attendance/mine"); }
async function guildRoster() { return request("/guild/roster"); }
async function claimGuildChest() { return request("/guild/chest/claim", { method: "POST", body: {} }); }
async function exerciseDaily() { return request("/exercise/daily"); }
async function completeExerciseSession(payload) {
  return request("/exercise/session", { method: "POST", body: payload });
}
async function progressSummary(period = "week") {
  return request("/progress/summary?period=" + encodeURIComponent(period));
}
async function pushVapidKey() { return request("/push/vapid-public-key"); }
async function pushSubscribe(subscription, timezone) {
  return request("/push/subscribe", { method: "POST", body: { subscription, timezone } });
}
async function pushUnsubscribe(endpoint) {
  return request("/push/unsubscribe", { method: "POST", body: { endpoint } });
}
async function leaderboard() { return request("/leaderboard"); }

// Тренер
async function guildInfo() { return request("/guild/info"); }
async function guildMembers() { return request("/guild/members"); }
async function guildAttendance() { return request("/guild/attendance"); }
async function decideAttendance(id, approve, extra) { return request("/attendance/" + id + "/decision", { method: "POST", body: Object.assign({ approve }, extra || {}) }); }
async function decideLeaveAttendance(id, approve) { return request("/attendance/" + id + "/leave-decision", { method: "POST", body: { approve } }); }
async function setMemberSchedule(childId, schedule) { return request("/guild/member/" + childId + "/schedule", { method: "PUT", body: { schedule } }); }
async function setGuildSchedule(schedule) { return request("/guild/schedule", { method: "PUT", body: { schedule } }); }
async function removeGuildMember(childId) { return request("/guild/member/" + childId, { method: "DELETE" }); }
async function transferGuildMember(childId, guildCode) { return request("/guild/member/" + childId + "/transfer", { method: "POST", body: { guildCode } }); }
async function guildPreview(code) { return request("/guild/preview?code=" + encodeURIComponent(code)); }
async function setGuildSport(sport) { return request("/guild/sport", { method: "PUT", body: { sport } }); }
async function changePassword(oldPassword, newPassword) { return request("/account/password", { method: "POST", body: { oldPassword, newPassword } }); }
async function logoutAll() { return request("/account/logout-all", { method: "POST" }); }
async function deleteAccount(password) { return request("/account", { method: "DELETE", body: { password } }); }

/** Сохранить прогресс: сразу в outbox, затем попытка отправки. */
async function saveStateQueued(state) {
  if (!getToken()) return { skipped: true };
  parkSaveState(state);
  if (!isOnline()) return { queued: true };
  try {
    await saveState(state);
    writeOutbox(readOutbox().filter((x) => x.type !== "saveState"));
    return { ok: true };
  } catch (e) {
    if (e && e.status === 401) throw e;
    // Уже в outbox через parkSaveState
    return { queued: true, error: e };
  }
}

/** Заявка на тренировку с постановкой в очередь при офлайне. */
async function requestAttendanceQueued(date) {
  if (!getToken()) throw Object.assign(new Error("Нужен вход"), { status: 401 });
  if (!isOnline()) {
    enqueue({ type: "attendance", payload: { date } });
    return { queued: true, attendance: { date, status: "pending", leave_status: null, offlineQueued: true } };
  }
  try {
    const d = await requestAttendance(date);
    writeOutbox(readOutbox().filter((x) => !(x.type === "attendance" && x.payload && x.payload.date === date)));
    return Object.assign({ queued: false }, d);
  } catch (e) {
    if (e && e.status === 401) throw e;
    if (e && e.status >= 400 && e.status < 500 && e.status !== 0) throw e;
    enqueue({ type: "attendance", payload: { date } });
    return { queued: true, attendance: { date, status: "pending", leave_status: null, offlineQueued: true }, error: e };
  }
}

async function requestLeaveAttendanceQueued(date) {
  if (!getToken()) throw Object.assign(new Error("Нужен вход"), { status: 401 });
  if (!isOnline()) {
    enqueue({ type: "attendanceLeave", payload: { date } });
    return { queued: true, attendance: { date, status: "approved", leave_status: "pending", offlineQueued: true } };
  }
  try {
    const d = await requestLeaveAttendance(date);
    writeOutbox(readOutbox().filter((x) => !(x.type === "attendanceLeave" && x.payload && x.payload.date === date)));
    return Object.assign({ queued: false }, d);
  } catch (e) {
    if (e && e.status === 401) throw e;
    if (e && e.status >= 400 && e.status < 500 && e.status !== 0) throw e;
    enqueue({ type: "attendanceLeave", payload: { date } });
    return { queued: true, attendance: { date, status: "approved", leave_status: "pending", offlineQueued: true }, error: e };
  }
}

/** Завершение камерной тренировки с очередью при офлайне (XP только с сервера). */
async function completeExerciseSessionQueued(payload) {
  if (!getToken()) throw Object.assign(new Error("Нужен вход"), { status: 401 });
  const body = {
    sessionId: payload.sessionId,
    exerciseType: payload.exerciseType || payload.type,
    reps: Math.max(0, Math.floor(Number(payload.reps) || 0)),
  };
  if (!isOnline()) {
    enqueue({ type: "exerciseSession", payload: body });
    return { queued: true, ...body, xpAwarded: 0, acceptedReps: 0 };
  }
  try {
    const d = await completeExerciseSession(body);
    writeOutbox(readOutbox().filter((x) => !(
      x.type === "exerciseSession" && x.payload && x.payload.sessionId === body.sessionId
    )));
    return Object.assign({ queued: false }, d);
  } catch (e) {
    if (e && e.status === 401) throw e;
    if (e && e.status >= 400 && e.status < 500 && e.status !== 0) throw e;
    enqueue({ type: "exerciseSession", payload: body });
    return { queued: true, ...body, xpAwarded: 0, acceptedReps: 0, error: e };
  }
}

async function flushOutbox() {
  if (flushing || !getToken()) return { flushed: 0, remaining: outboxCount() };
  if (!isOnline()) return { flushed: 0, remaining: outboxCount(), offline: true };
  flushing = true;
  notifyOutboxChange();
  let flushed = 0;
  try {
    let items = readOutbox();
    while (items.length) {
      const job = items[0];
      try {
        if (job.type === "saveState") {
          await saveState(job.payload);
        } else if (job.type === "attendance") {
          await requestAttendance(job.payload.date);
        } else if (job.type === "attendanceLeave") {
          await requestLeaveAttendance(job.payload.date);
        } else if (job.type === "exerciseSession") {
          const d = await completeExerciseSession(job.payload);
          if (d && d.state && typeof window !== "undefined") {
            try {
              window.dispatchEvent(new CustomEvent("sporthero-state-patch", { detail: d.state }));
            } catch (_) { /* ignore */ }
          }
        } else {
          items.shift();
          writeOutbox(items);
          continue;
        }
        items.shift();
        writeOutbox(items);
        flushed++;
      } catch (e) {
        if (e && e.status === 401) {
          logout();
          try {
            window.dispatchEvent(new CustomEvent("sporthero-session-expired"));
          } catch (_) { /* ignore */ }
          break;
        }
        // Временная ошибка / нет сети — останавливаемся, повторим позже.
        if (!e || !e.status || e.status === 0 || e.status >= 500) break;
        // saveState с античитом: не дропаем — иначе офлайн-прогресс пропадёт.
        // Остальные 4xx (дубликат заявки и т.п.) можно снять.
        if (job.type === "saveState") break;
        items.shift();
        writeOutbox(items);
      }
      items = readOutbox();
    }
  } finally {
    flushing = false;
    notifyOutboxChange();
  }
  return { flushed, remaining: outboxCount() };
}

let watchersBound = false;
function startSyncWatchers() {
  if (watchersBound || typeof window === "undefined") return;
  watchersBound = true;
  window.addEventListener("online", () => {
    notifyOutboxChange();
    flushOutbox().catch(() => {});
  });
  window.addEventListener("offline", () => notifyOutboxChange());
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data && event.data.type === "sporthero-flush") {
        flushOutbox().catch(() => {});
      }
    });
  }
  notifyOutboxChange();
}

export const SHApi = {
  getToken, setToken, register, login, getState, saveState, logout,
  requestAttendance, requestLeaveAttendance, myAttendance, guildRoster, claimGuildChest, progressSummary, leaderboard,
  exerciseDaily, completeExerciseSession, completeExerciseSessionQueued,
  guildInfo, guildMembers, guildAttendance, decideAttendance, decideLeaveAttendance, setMemberSchedule,
  setGuildSchedule, removeGuildMember, transferGuildMember,
  guildPreview, setGuildSport, changePassword, logoutAll, deleteAccount,
  pushVapidKey, pushSubscribe, pushUnsubscribe,
  hasToken: () => !!getToken(),
  // Offline sync
  isOnline, outboxCount, isFlushing, enqueue, flushOutbox,
  saveStateQueued, requestAttendanceQueued, requestLeaveAttendanceQueued,
  parkSaveState, startSyncWatchers, requestBackgroundSync,
};

export { OUTBOX_KEY, TOKEN_KEY };
