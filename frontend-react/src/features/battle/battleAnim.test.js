import { describe, expect, it, vi } from "vitest";
import { GAME } from "@domain/game-data";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  allSkillBattleSheets,
  allSportAttackSheets,
  battleSheetUrl,
  pickAttackVariant,
  skillBattleSheet,
  sportAttackSheets,
} from "./battleAnim.js";
import { BattlePlaybackEngine } from "./engine/BattlePlaybackEngine.js";

const assetsRoot = resolve(process.cwd(), "public");

function diskPathFromGamePath(p) {
  // "./assets/battle/foo.webp?v=1" -> public/assets/battle/foo.webp
  const clean = String(p).replace(/^\.\//, "").replace(/\?.*$/, "");
  return resolve(assetsRoot, clean);
}

describe("battleAnim sheets", () => {
  it("every sport has exactly 2 attack sheets on disk", () => {
    const sports = allSportAttackSheets();
    expect(sports.length).toBe(3);
    for (const s of sports) {
      expect(s.attacks.length).toBe(2);
      for (const path of s.attacks) {
        expect(existsSync(diskPathFromGamePath(path))).toBe(true);
      }
      expect(sportAttackSheets(s.sportId).length).toBe(2);
    }
  });

  it("every sport skill has a unique battleSheet on disk", () => {
    const sheets = allSkillBattleSheets();
    expect(sheets.length).toBeGreaterThanOrEqual(15);
    const ids = new Set();
    for (const row of sheets) {
      expect(row.sheet).toBeTruthy();
      expect(ids.has(row.skillId)).toBe(false);
      ids.add(row.skillId);
      expect(existsSync(diskPathFromGamePath(row.sheet))).toBe(true);
      expect(skillBattleSheet(row.skillId)).toBe(battleSheetUrl(row.sheet));
    }
  });

  it("GAME.sports battleAttacks align with sport ids", () => {
    for (const sport of GAME.sports) {
      expect(Array.isArray(sport.battleAttacks)).toBe(true);
      expect(sport.battleAttacks.length).toBe(2);
      expect(sport.battleFrames || 7).toBe(7);
    }
  });

  it("pickAttackVariant avoids immediate repeats", () => {
    const variants = ["/a.webp", "/b.webp"];
    const a = pickAttackVariant(variants, 0, () => 0); // would pick 0, but last is 0 -> flips to 1
    expect(a.idx).toBe(1);
    const b = pickAttackVariant(variants, 1, () => 0.9); // floor(0.9*2)=1, last 1 -> flips to 0
    expect(b.idx).toBe(0);
  });
});

describe("BattlePlaybackEngine", () => {
  it("plays through log and fires onComplete", () => {
    vi.useFakeTimers();
    const log = [{ t: "hit1" }, { t: "hit2" }, { t: "hit3" }];
    const steps = [];
    let completed = false;
    const engine = new BattlePlaybackEngine({
      log,
      baseMs: 100,
      onStep: (i, line) => steps.push({ i, t: line.t }),
      onComplete: () => { completed = true; },
    });
    engine.start();
    expect(steps).toEqual([{ i: 0, t: "hit1" }]);
    vi.advanceTimersByTime(100);
    expect(steps.length).toBe(2);
    vi.advanceTimersByTime(100);
    expect(steps.length).toBe(3);
    vi.advanceTimersByTime(100);
    expect(completed).toBe(true);
    expect(engine.running).toBe(false);
    vi.useRealTimers();
  });

  it("skip fires all remaining steps synchronously", () => {
    vi.useFakeTimers();
    const log = [{ t: "a" }, { t: "b" }, { t: "c" }, { t: "d" }];
    const steps = [];
    let phase = "";
    const engine = new BattlePlaybackEngine({
      log,
      baseMs: 200,
      onStep: (i, line) => steps.push(line.t),
      onPhase: (p) => { phase = p; },
    });
    engine.start();
    expect(steps).toEqual(["a"]);
    engine.skip();
    expect(steps).toEqual(["a", "b", "c", "d"]);
    expect(phase).toBe("complete");
    expect(engine.running).toBe(false);
    vi.useRealTimers();
  });

  it("speed 2x halves the delay", () => {
    vi.useFakeTimers();
    const log = [{ t: "x" }, { t: "y" }];
    const steps = [];
    const engine = new BattlePlaybackEngine({
      log,
      baseMs: 200,
      onStep: (i, line) => steps.push(line.t),
    });
    engine.speed = 2;
    engine.start();
    vi.advanceTimersByTime(99);
    expect(steps.length).toBe(1);
    vi.advanceTimersByTime(1);
    expect(steps.length).toBe(2);
    vi.useRealTimers();
  });

  it("destroy stops and nullifies callbacks", () => {
    const engine = new BattlePlaybackEngine({ log: [{ t: "a" }] });
    engine.destroy();
    expect(engine.onStep).toBe(null);
    expect(engine.running).toBe(false);
  });
});
