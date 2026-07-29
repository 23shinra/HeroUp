/** Камерные упражнения: награды и счётчики повторов (чистая логика). */

export const EXERCISE_TYPES = {
  squat: {
    id: "squat",
    name: "Приседания",
    tip: "Поставь телефон вертикально, встань боком или лицом так, чтобы было видно всё тело. Приседай до параллели бёдер с полом.",
  },
  pushup: {
    id: "pushup",
    name: "Отжимания",
    tip: "Поставь телефон сбоку. В кадре должны быть плечи, локти и бёдра. Опускайся грудью вниз и выжимай вверх.",
  },
};

export const EXERCISE_XP_PER_REP = 2;
export const EXERCISE_DAILY_XP_CAP = 60;
export const EXERCISE_MAX_REPS = 50;

export function isExerciseType(type) {
  return Boolean(EXERCISE_TYPES[type]);
}

export function newExerciseSessionId() {
  const rand = Math.random().toString(36).slice(2, 10);
  return `ex_${Date.now().toString(36)}_${rand}`;
}

/** Предварительный расчёт награды на клиенте (сервер — источник истины). */
export function computeExerciseXp(reps, { usedXpToday = 0 } = {}) {
  const safeReps = Math.max(0, Math.min(EXERCISE_MAX_REPS, Math.floor(Number(reps) || 0)));
  const remaining = Math.max(0, EXERCISE_DAILY_XP_CAP - Math.max(0, Number(usedXpToday) || 0));
  const maxByCap = Math.floor(remaining / EXERCISE_XP_PER_REP);
  const acceptedReps = Math.min(safeReps, maxByCap);
  const xp = acceptedReps * EXERCISE_XP_PER_REP;
  return {
    reps: safeReps,
    acceptedReps,
    xp,
    remainingAfter: Math.max(0, remaining - xp),
    capped: acceptedReps < safeReps,
    dailyCap: EXERCISE_DAILY_XP_CAP,
    xpPerRep: EXERCISE_XP_PER_REP,
  };
}

export function angleDeg(a, b, c) {
  if (!a || !b || !c) return null;
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const ab = Math.hypot(abx, aby);
  const cb = Math.hypot(cbx, cby);
  if (ab < 1e-6 || cb < 1e-6) return null;
  const cos = Math.max(-1, Math.min(1, dot / (ab * cb)));
  return (Math.acos(cos) * 180) / Math.PI;
}

export function landmarkOk(lm, minVis = 0.5) {
  if (!lm) return false;
  const vis = lm.visibility != null ? lm.visibility : 1;
  return vis >= minVis && Number.isFinite(lm.x) && Number.isFinite(lm.y);
}

/** MediaPipe Pose landmark indices. */
export const POSE = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
};

export function pickSide(landmarks, leftIdx, rightIdx, minVis = 0.5) {
  const L = landmarks[leftIdx];
  const R = landmarks[rightIdx];
  const lOk = landmarkOk(L, minVis);
  const rOk = landmarkOk(R, minVis);
  if (lOk && rOk) {
    const lv = L.visibility != null ? L.visibility : 1;
    const rv = R.visibility != null ? R.visibility : 1;
    return lv >= rv ? "left" : "right";
  }
  if (lOk) return "left";
  if (rOk) return "right";
  return null;
}

/**
 * Проверка: в кадре достаточно ключевых точек тела.
 * @returns {{ ok: boolean, reason?: string }}
 */
export function bodyInFrame(landmarks, minVis = 0.4) {
  if (!landmarks || landmarks.length < 29) return { ok: false, reason: "no_pose" };
  const shoulders = [landmarks[POSE.LEFT_SHOULDER], landmarks[POSE.RIGHT_SHOULDER]].filter((p) => landmarkOk(p, minVis));
  const hips = [landmarks[POSE.LEFT_HIP], landmarks[POSE.RIGHT_HIP]].filter((p) => landmarkOk(p, minVis));
  const knees = [landmarks[POSE.LEFT_KNEE], landmarks[POSE.RIGHT_KNEE]].filter((p) => landmarkOk(p, minVis));
  const ankles = [landmarks[POSE.LEFT_ANKLE], landmarks[POSE.RIGHT_ANKLE]].filter((p) => landmarkOk(p, minVis));
  if (!shoulders.length) return { ok: false, reason: "torso" };
  if (!hips.length) return { ok: false, reason: "torso" };
  if (!knees.length) return { ok: false, reason: "legs" };
  // Ankles are nice to have but not required — often cut off on phone cameras.
  const core = shoulders.length + hips.length + knees.length + ankles.length;
  if (core < 4) return { ok: false, reason: "partial" };
  return { ok: true };
}

function createPhaseCounter({
  downEnter,
  downExit,
  upEnter,
  minDownMs = 120,
  minUpMs = 120,
  minCycleMs = 450,
  getMetric,
}) {
  return {
    phase: "up",
    reps: 0,
    metric: null,
    downSince: 0,
    upSince: 0,
    lastRepAt: 0,
    ready: false,
    step(landmarks, now = Date.now()) {
      const frame = bodyInFrame(landmarks);
      this.ready = frame.ok;
      if (!frame.ok) {
        this.metric = null;
        return { reps: this.reps, phase: this.phase, ready: false, reason: frame.reason, metric: null };
      }
      const metric = getMetric(landmarks);
      this.metric = metric;
      if (metric == null) {
        return { reps: this.reps, phase: this.phase, ready: false, reason: "metric", metric: null };
      }

      if (this.phase === "up") {
        if (metric <= downEnter) {
          if (!this.downSince) this.downSince = now;
          if (now - this.downSince >= minDownMs) {
            this.phase = "down";
            this.upSince = 0;
          }
        } else {
          this.downSince = 0;
        }
      } else if (this.phase === "down") {
        if (metric >= upEnter) {
          if (!this.upSince) this.upSince = now;
          if (now - this.upSince >= minUpMs) {
            if (now - this.lastRepAt >= minCycleMs) {
              this.reps += 1;
              this.lastRepAt = now;
            }
            this.phase = "up";
            this.downSince = 0;
          }
        } else if (metric > downExit) {
          // ещё не достаточно высоко — ждём
        } else {
          this.upSince = 0;
        }
      }

      return {
        reps: this.reps,
        phase: this.phase,
        ready: true,
        reason: null,
        metric,
      };
    },
    reset() {
      this.phase = "up";
      this.reps = 0;
      this.metric = null;
      this.downSince = 0;
      this.upSince = 0;
      this.lastRepAt = 0;
      this.ready = false;
    },
  };
}

function squatKneeAngle(landmarks) {
  const side = pickSide(landmarks, POSE.LEFT_HIP, POSE.RIGHT_HIP, 0.35)
    || pickSide(landmarks, POSE.LEFT_KNEE, POSE.RIGHT_KNEE, 0.35);
  if (!side) return null;
  const hip = landmarks[side === "left" ? POSE.LEFT_HIP : POSE.RIGHT_HIP];
  const knee = landmarks[side === "left" ? POSE.LEFT_KNEE : POSE.RIGHT_KNEE];
  const ankle = landmarks[side === "left" ? POSE.LEFT_ANKLE : POSE.RIGHT_ANKLE];
  if (!landmarkOk(hip, 0.35) || !landmarkOk(knee, 0.35)) return null;
  if (!landmarkOk(ankle, 0.3)) {
    // Approximate ankle from knee direction if not visible.
    const fakeAnkle = { x: knee.x, y: knee.y + (knee.y - hip.y) * 0.8 };
    return angleDeg(hip, knee, fakeAnkle);
  }
  return angleDeg(hip, knee, ankle);
}

function pushupElbowAngle(landmarks) {
  const side = pickSide(landmarks, POSE.LEFT_ELBOW, POSE.RIGHT_ELBOW, 0.3)
    || pickSide(landmarks, POSE.LEFT_SHOULDER, POSE.RIGHT_SHOULDER, 0.3);
  if (!side) return null;
  const shoulder = landmarks[side === "left" ? POSE.LEFT_SHOULDER : POSE.RIGHT_SHOULDER];
  const elbow = landmarks[side === "left" ? POSE.LEFT_ELBOW : POSE.RIGHT_ELBOW];
  const wrist = landmarks[side === "left" ? POSE.LEFT_WRIST : POSE.RIGHT_WRIST];
  if (!landmarkOk(shoulder, 0.3) || !landmarkOk(elbow, 0.3)) return null;
  if (!landmarkOk(wrist, 0.25)) {
    const fakeWrist = { x: elbow.x + (elbow.x - shoulder.x) * 0.8, y: elbow.y + (elbow.y - shoulder.y) * 0.8 };
    return angleDeg(shoulder, elbow, fakeWrist);
  }
  return angleDeg(shoulder, elbow, wrist);
}

export function createSquatCounter() {
  // Угол в колене: стоя ~160–180, в приседе ~70–100.
  return createPhaseCounter({
    downEnter: 110,
    downExit: 120,
    upEnter: 150,
    minDownMs: 140,
    minUpMs: 120,
    minCycleMs: 500,
    getMetric: squatKneeAngle,
  });
}

export function createPushupCounter() {
  // Угол в локте: верх ~150–180, низ ~70–100.
  return createPhaseCounter({
    downEnter: 100,
    downExit: 115,
    upEnter: 145,
    minDownMs: 120,
    minUpMs: 120,
    minCycleMs: 450,
    getMetric: pushupElbowAngle,
  });
}

export function createExerciseCounter(type) {
  if (type === "squat") return createSquatCounter();
  if (type === "pushup") return createPushupCounter();
  throw new Error("unknown_exercise");
}
