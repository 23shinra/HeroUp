import { describe, expect, it } from "vitest";
import { defaultState } from "../state/index.js";
import {
  CAMPAIGN_LEVELS,
  DISCIPLINES,
  addXpPure,
  assetUrl,
  currentStage,
  estimateWinChance,
  heroPower,
  isMilestoneStage,
  pickNewerState,
  seededRandom,
  simulateBattle,
  stageNodePos,
  stageOpponent,
  stateSyncScore,
  summarizeBattleLog,
  slimBattleLog,
} from "./index.js";

describe("game-engine", () => {
  const baseHero = () => ({
    ...defaultState().hero,
    name: "Герой",
    level: 5,
    xp: 0,
    stats: { str: 10, spd: 10, end: 10, int: 10, team: 10 },
    loadout: [],
    class: null,
  });

  it("addXpPure levels up without mutating input", () => {
    const hero = { ...baseHero(), xp: 95, level: 1, statPoints: 5 };
    const { hero: next, leveled } = addXpPure(hero, 10);
    expect(leveled).toBe(1);
    expect(next.level).toBe(2);
    expect(next.xp).toBe(5);
    expect(next.statPoints).toBe(10);
    expect(hero.level).toBe(1);
  });

  it("stateSyncScore ranks higher progress ahead of updatedAt tie-break", () => {
    const low = defaultState();
    low.hero.level = 2;
    low.updatedAt = 999;

    const high = defaultState();
    high.hero.level = 5;
    high.updatedAt = 1;

    expect(stateSyncScore(high)).toBeGreaterThan(stateSyncScore(low));
    expect(pickNewerState(low, high)).toBe(high);
    expect(pickNewerState(high, low)).toBe(high);
  });

  it("pickNewerState uses updatedAt when sync scores tie", () => {
    const a = defaultState();
    a.hero.level = 3;
    a.updatedAt = 100;
    const b = defaultState();
    b.hero.level = 3;
    b.updatedAt = 200;
    expect(pickNewerState(a, b)).toBe(b);
  });

  it("simulateBattle is deterministic with seeded rng", () => {
    const hero = baseHero();
    const opp = stageOpponent(3);
    const disc = DISCIPLINES[0];
    const rng = seededRandom("battle-test-seed");

    const r1 = simulateBattle(hero, opp, disc, rng);
    const r2 = simulateBattle(hero, opp, disc, seededRandom("battle-test-seed"));

    expect(r1.win).toBe(r2.win);
    expect(r1.log.length).toBe(r2.log.length);
    expect(r1.pHP).toBe(r2.pHP);
    expect(r1.eHP).toBe(r2.eHP);
    expect(typeof r1.win).toBe("boolean");
    expect(r1.log.length).toBeGreaterThan(0);
  });

  it("summarizeBattleLog aggregates damage and procs", () => {
    const log = [
      { side: "e", dmg: 12, fx: "combo" },
      { side: "p", dmg: 8 },
      { side: "e", dmg: 5, fx: "crit" },
    ];
    const summary = summarizeBattleLog(log);
    expect(summary.dmgDealt).toBe(17);
    expect(summary.dmgTaken).toBe(8);
    expect(summary.procs.combo).toBe(1);
  });

  it("slimBattleLog drops arena-only fields", () => {
    const slim = slimBattleLog([
      { t: "Удар", side: "e", dmg: 9, actor: "p", anim: "attack", pHP: 90, eHP: 80, crit: true, fx: "crit", skillId: "jab" },
    ]);
    expect(slim).toEqual([{
      t: "Удар",
      side: "e",
      actor: "p",
      pHP: 90,
      eHP: 80,
      dmg: 9,
      fx: "crit",
      crit: true,
      skillId: "jab",
    }]);
    expect(slim[0].anim).toBeUndefined();
  });

  it("stageOpponent and campaign helpers are stable", () => {
    const o1 = stageOpponent(4);
    const o2 = stageOpponent(4);
    expect(o1).toEqual(o2);
    expect(o1.stage).toBe(4);
    expect(currentStage([1, 2, 3])).toBe(4);
    expect(currentStage(Array.from({ length: CAMPAIGN_LEVELS }, (_, i) => i + 1))).toBe(CAMPAIGN_LEVELS + 1);
    expect(isMilestoneStage(5)).toBe(true);
    expect(isMilestoneStage(6)).toBe(false);
    expect(stageNodePos(1)).toEqual({ x: 47.0, y: 96.8 });
    expect(stageNodePos(20)).toEqual({ x: 50.0, y: 4.2 });
    expect(stageNodePos(10).y).toBeGreaterThan(50);
    expect(stageNodePos(11).y).toBeLessThan(50);
    expect(stageNodePos(1).y).toBeGreaterThan(stageNodePos(10).y);
    expect(stageNodePos(10).y).toBeGreaterThan(stageNodePos(20).y);
  });

  it("assetUrl maps ./assets to /assets", () => {
    expect(assetUrl("./assets/boxer.png?v=7")).toBe("/assets/boxer.png?v=7");
    expect(assetUrl("/assets/icon.svg")).toBe("/assets/icon.svg");
  });

  it("heroPower and estimateWinChance use hero stats", () => {
    const hero = baseHero();
    const opp = stageOpponent(5);
    expect(heroPower(hero)).toBeGreaterThan(0);
    const chance = estimateWinChance(hero, opp);
    expect(chance).toBeGreaterThanOrEqual(3);
    expect(chance).toBeLessThanOrEqual(97);
  });

  it("simulateBattle emits skillId for loadout procs and passive intros", () => {
    const hero = {
      ...baseHero(),
      level: 25,
      loadout: ["jab", "uppercut", "knockout", "footwork"],
      sport: "boxing",
    };
    const r = simulateBattle(hero, stageOpponent(3), DISCIPLINES[0], seededRandom("skill-log"));
    const skillLines = r.log.filter((l) => l.skillId);
    expect(r.log.length).toBeGreaterThan(0);
    const known = new Set(["jab", "uppercut", "knockout", "footwork"]);
    for (const line of skillLines) {
      expect(known.has(line.skillId)).toBe(true);
      expect(line.anim).toBeTruthy();
    }
  });

  it("simulateBattle adds passive activation lines for guard/hp skills", () => {
    const hero = {
      ...baseHero(),
      level: 20,
      loadout: ["grip", "bridge"],
      sport: "wrestling",
    };
    const r = simulateBattle(hero, stageOpponent(2), DISCIPLINES[0], () => 0.5);
    const passives = r.log.filter((l) => l.fx === "passive");
    expect(passives.length).toBeGreaterThanOrEqual(2);
    expect(passives.every((l) => l.skillId && l.actor === "p")).toBe(true);
  });
});
