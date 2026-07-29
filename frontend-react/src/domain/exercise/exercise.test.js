import { describe, expect, it } from "vitest";
import {
  angleDeg,
  bodyInFrame,
  computeExerciseXp,
  createPushupCounter,
  createSquatCounter,
  EXERCISE_DAILY_XP_CAP,
  EXERCISE_XP_PER_REP,
  POSE,
} from "./index.js";

function lm(x, y, visibility = 0.9) {
  return { x, y, z: 0, visibility };
}

function standingPose() {
  const pts = Array.from({ length: 33 }, () => lm(0.5, 0.5, 0.2));
  pts[POSE.NOSE] = lm(0.5, 0.12);
  pts[POSE.LEFT_SHOULDER] = lm(0.42, 0.28);
  pts[POSE.RIGHT_SHOULDER] = lm(0.58, 0.28);
  pts[POSE.LEFT_ELBOW] = lm(0.38, 0.4);
  pts[POSE.RIGHT_ELBOW] = lm(0.62, 0.4);
  pts[POSE.LEFT_WRIST] = lm(0.36, 0.52);
  pts[POSE.RIGHT_WRIST] = lm(0.64, 0.52);
  pts[POSE.LEFT_HIP] = lm(0.44, 0.52);
  pts[POSE.RIGHT_HIP] = lm(0.56, 0.52);
  pts[POSE.LEFT_KNEE] = lm(0.44, 0.72);
  pts[POSE.RIGHT_KNEE] = lm(0.56, 0.72);
  pts[POSE.LEFT_ANKLE] = lm(0.44, 0.92);
  pts[POSE.RIGHT_ANKLE] = lm(0.56, 0.92);
  return pts;
}

function squatDownPose() {
  const pts = standingPose();
  // Глубокий присед: бедро почти над пяткой, колено впереди.
  pts[POSE.LEFT_HIP] = lm(0.44, 0.7);
  pts[POSE.RIGHT_HIP] = lm(0.56, 0.7);
  pts[POSE.LEFT_KNEE] = lm(0.32, 0.72);
  pts[POSE.RIGHT_KNEE] = lm(0.68, 0.72);
  pts[POSE.LEFT_ANKLE] = lm(0.44, 0.92);
  pts[POSE.RIGHT_ANKLE] = lm(0.56, 0.92);
  return pts;
}

function pushupUpPose() {
  const pts = standingPose();
  // Горизонтальный упор: плечи ≈ запястья по Y, локти почти прямые.
  pts[POSE.LEFT_SHOULDER] = lm(0.35, 0.4);
  pts[POSE.RIGHT_SHOULDER] = lm(0.35, 0.55);
  pts[POSE.LEFT_ELBOW] = lm(0.5, 0.4);
  pts[POSE.RIGHT_ELBOW] = lm(0.5, 0.55);
  pts[POSE.LEFT_WRIST] = lm(0.65, 0.4);
  pts[POSE.RIGHT_WRIST] = lm(0.65, 0.55);
  pts[POSE.LEFT_HIP] = lm(0.55, 0.42);
  pts[POSE.RIGHT_HIP] = lm(0.55, 0.57);
  pts[POSE.LEFT_KNEE] = lm(0.7, 0.42);
  pts[POSE.RIGHT_KNEE] = lm(0.7, 0.57);
  pts[POSE.LEFT_ANKLE] = lm(0.85, 0.42);
  pts[POSE.RIGHT_ANKLE] = lm(0.85, 0.57);
  return pts;
}

function pushupDownPose() {
  const pts = pushupUpPose();
  pts[POSE.LEFT_ELBOW] = lm(0.45, 0.28);
  pts[POSE.RIGHT_ELBOW] = lm(0.45, 0.68);
  pts[POSE.LEFT_SHOULDER] = lm(0.4, 0.4);
  pts[POSE.RIGHT_SHOULDER] = lm(0.4, 0.55);
  pts[POSE.LEFT_WRIST] = lm(0.55, 0.4);
  pts[POSE.RIGHT_WRIST] = lm(0.55, 0.55);
  return pts;
}

describe("exercise rewards", () => {
  it("awards 2 XP per rep within daily cap", () => {
    const r = computeExerciseXp(10, { usedXpToday: 0 });
    expect(r.acceptedReps).toBe(10);
    expect(r.xp).toBe(20);
    expect(r.xpPerRep).toBe(EXERCISE_XP_PER_REP);
  });

  it("caps by remaining daily XP", () => {
    const r = computeExerciseXp(40, { usedXpToday: 50 });
    expect(r.acceptedReps).toBe(5);
    expect(r.xp).toBe(10);
    expect(r.capped).toBe(true);
    expect(r.remainingAfter).toBe(0);
  });

  it("returns zero when daily cap exhausted", () => {
    const r = computeExerciseXp(12, { usedXpToday: EXERCISE_DAILY_XP_CAP });
    expect(r.acceptedReps).toBe(0);
    expect(r.xp).toBe(0);
  });
});

describe("geometry helpers", () => {
  it("computes joint angle", () => {
    const a = { x: 0, y: 0 };
    const b = { x: 0, y: 1 };
    const c = { x: 1, y: 1 };
    expect(angleDeg(a, b, c)).toBeCloseTo(90, 5);
  });

  it("requires core body in frame but tolerates missing ankles", () => {
    expect(bodyInFrame(standingPose()).ok).toBe(true);
    // Missing ankles but shoulders+hips+knees visible = still ok
    const noAnkles = standingPose();
    noAnkles[POSE.LEFT_ANKLE].visibility = 0.1;
    noAnkles[POSE.RIGHT_ANKLE].visibility = 0.1;
    expect(bodyInFrame(noAnkles).ok).toBe(true);
    // Missing knees = not ok
    const noKnees = standingPose();
    noKnees[POSE.LEFT_KNEE].visibility = 0.1;
    noKnees[POSE.RIGHT_KNEE].visibility = 0.1;
    expect(bodyInFrame(noKnees).ok).toBe(false);
  });
});

describe("squat counter FSM", () => {
  it("counts a full down-up cycle and ignores noise", () => {
    const c = createSquatCounter();
    let t = 1_000;
    // standing
    c.step(standingPose(), t); t += 200;
    c.step(standingPose(), t); t += 200;
    // hold deep squat
    c.step(squatDownPose(), t); t += 200;
    c.step(squatDownPose(), t); t += 200;
    expect(c.step(squatDownPose(), t).phase).toBe("down");
    t += 200;
    // return up and hold
    c.step(standingPose(), t); t += 200;
    const up = c.step(standingPose(), t);
    expect(up.reps).toBe(1);
    expect(up.phase).toBe("up");

    // Слишком быстрый «дребезг» не должен дать второй повтор.
    t += 50;
    c.step(squatDownPose(), t);
    t += 50;
    const noisy = c.step(standingPose(), t);
    expect(noisy.reps).toBe(1);
  });

  it("does not count when body is incomplete", () => {
    const c = createSquatCounter();
    const bad = standingPose();
    bad[POSE.LEFT_KNEE].visibility = 0.1;
    bad[POSE.RIGHT_KNEE].visibility = 0.1;
    const r = c.step(bad, 1000);
    expect(r.ready).toBe(false);
    expect(r.reps).toBe(0);
  });
});

describe("pushup counter FSM", () => {
  it("counts a push-up cycle", () => {
    const c = createPushupCounter();
    let t = 5_000;
    c.step(pushupUpPose(), t); t += 200;
    c.step(pushupUpPose(), t); t += 200;
    c.step(pushupDownPose(), t); t += 200;
    c.step(pushupDownPose(), t); t += 200;
    expect(c.step(pushupDownPose(), t).phase).toBe("down");
    t += 200;
    c.step(pushupUpPose(), t); t += 200;
    const done = c.step(pushupUpPose(), t);
    expect(done.reps).toBe(1);
  });
});
