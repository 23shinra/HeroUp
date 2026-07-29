import { describe, expect, it } from "vitest";
import {
  addMinutes,
  checkinStatus,
  computeStreak,
  fmtClock,
  fmtDur,
  normSlot,
  processApprovedAttendance,
  windowForDate,
} from "./index.js";
import { addXpPure } from "../game-engine/index.js";

describe("attendance", () => {
  it("normSlot string expands to window", () => {
    const s = normSlot("18:00");
    expect(s.from).toBe("18:00");
    expect(s.to).toBe("20:00");
  });

  it("fmtClock and fmtDur format countdown", () => {
    expect(fmtClock(65000)).toBe("01:05");
    expect(fmtDur(90000000)).toMatch(/дн/);
  });

  it("computeStreak counts consecutive days", () => {
    expect(computeStreak(["2026-07-25", "2026-07-26", "2026-07-27"])).toBe(3);
    expect(computeStreak(["2026-07-25", "2026-07-27"])).toBe(1);
  });

  it("processApprovedAttendance credits once per id", () => {
    const S = {
      hero: { level: 1, xp: 0, coins: 0, appliedAttendance: [], seasonPoints: 0 },
      stats: { trainings: 0 },
      quests: { date: "2026-07-27", list: [{ type: "training", target: 1, progress: 0, claimed: false }] },
    };
    const list = [{ id: 1, date: "2026-07-27", status: "approved" }];
    const r1 = processApprovedAttendance(S, list, addXpPure);
    expect(r1.applied?.count).toBe(1);
    expect(r1.S.stats.trainings).toBe(1);
    const r2 = processApprovedAttendance(r1.S, list, addXpPure);
    expect(r2.applied).toBeNull();
  });

  it("checkinStatus detects active window", () => {
    const now = new Date();
    const day = now.getDay();
    const hm = `${String(now.getHours()).padStart(2, "0")}:${String(Math.max(0, now.getMinutes() - 5)).padStart(2, "0")}`;
    const hero = { schedule: { [day]: { from: hm, to: addMinutes(hm, 120) } } };
    const st = checkinStatus(hero);
    expect(st.hasSchedule).toBe(true);
    const w = windowForDate(now, hero.schedule);
    expect(w).not.toBeNull();
  });
});
