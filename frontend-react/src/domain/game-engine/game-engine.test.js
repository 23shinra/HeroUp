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
  mapPlayerToOpponent,
  pickNewerState,
  pickRankedOpponent,
  rankedEloDelta,
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

  it("pickNewerState prefers server token balance when merging", () => {
    const a = defaultState();
    a.hero.level = 5;
    a.hero.tokens = 300;
    a.updatedAt = 100;
    const b = defaultState();
    b.hero.level = 3;
    b.hero.tokens = 290;
    b.updatedAt = 200;
    const picked = pickNewerState(a, b);
    expect(picked.hero.level).toBe(5);
    expect(picked.hero.tokens).toBe(290);
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
    expect(String(o1.sprite)).toContain("/stages/");
    expect(String(stageOpponent(1).sprite)).not.toEqual(String(stageOpponent(2).sprite));
    expect(currentStage([1, 2, 3])).toBe(4);
    expect(currentStage(Array.from({ length: CAMPAIGN_LEVELS }, (_, i) => i + 1))).toBe(CAMPAIGN_LEVELS + 1);
    expect(isMilestoneStage(5)).toBe(true);
    expect(isMilestoneStage(6)).toBe(false);
    expect(stageNodePos(1)).toEqual({ x: 51.8, y: 91.5 });
    expect(stageNodePos(20)).toEqual({ x: 50.0, y: 15.0 });
    expect(stageNodePos(10).y).toBeGreaterThan(50);
    expect(stageNodePos(11).y).toBeLessThan(52);
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

  it("matches ranked opponents inside level, power, and Elo windows", () => {
    const hero = { ...baseHero(), trophies: 20 };
    const power = heroPower(hero);
    const close = { name: "Равный", level: 6, power: Math.round(power * 1.08), trophies: 45 };
    const overpowered = { name: "Слишком сильный", level: 8, power: power * 2, trophies: 400 };
    expect(pickRankedOpponent(hero, [overpowered, close], () => 0)).toBe(close);

    const fallback = pickRankedOpponent(hero, [overpowered], () => 0.5);
    expect(fallback.isBot).toBe(true);
    expect(Math.abs(fallback.level - hero.level)).toBeLessThanOrEqual(1);
  });

  it("keeps leaderboard trophies when mapping an opponent", () => {
    const opp = mapPlayerToOpponent({
      name: "Игрок",
      level: 4,
      trophies: 27,
      sport: "boxing",
      stats: { str: 8, spd: 9, end: 7, int: 6, team: 5 },
    }, () => 0);
    expect(opp.trophies).toBe(27);
  });

  it("keeps equal ranked fighters near a 50 percent win rate", () => {
    const hero = {
      ...baseHero(),
      level: 10,
      stats: { str: 20, spd: 20, end: 20, int: 20, team: 20 },
    };
    const opp = { name: "Равный", level: 10, stats: { ...hero.stats } };
    for (const disc of DISCIPLINES) {
      const rng = seededRandom("balance-matrix");
      let wins = 0;
      for (let i = 0; i < 800; i++) {
        if (simulateBattle(hero, opp, disc, rng, "ranked").win) wins++;
      }
      const rate = (wins / 800) * 100;
      expect(rate).toBeGreaterThanOrEqual(45);
      expect(rate).toBeLessThanOrEqual(55);
    }
  });

  it("makes discipline an advantage without deciding a specialist matchup", () => {
    const hero = {
      ...baseHero(),
      level: 13,
      stats: { str: 47, spd: 36, end: 5, int: 5, team: 5 },
      loadout: ["jab", "hook"],
      ownedSkills: ["jab", "hook"],
    };
    const opp = {
      name: "Сбалансированный",
      level: 11,
      stats: { str: 24, spd: 31, end: 24, int: 24, team: 31 },
    };
    const rates = DISCIPLINES.map((disc) => {
      const rng = seededRandom("specialist-matrix");
      let wins = 0;
      for (let i = 0; i < 800; i++) {
        if (simulateBattle(hero, opp, disc, rng, "ranked").win) wins++;
      }
      return (wins / 800) * 100;
    });
    expect(Math.max(...rates) - Math.min(...rates)).toBeLessThanOrEqual(15);
    expect(Math.min(...rates)).toBeGreaterThan(5);
    expect(Math.max(...rates)).toBeLessThan(95);
  });

  it("does not multiply ranked combo damage by a separate crit skill", () => {
    const hero = {
      ...baseHero(),
      level: 12,
      loadout: ["jab"],
      ownedSkills: ["jab", "hook"],
    };
    const withHook = { ...hero, loadout: ["jab", "hook"] };
    const opp = { name: "Цель", level: 12, stats: { ...hero.stats } };
    const disc = DISCIPLINES[1];
    const firstHit = (result) => result.log.find((line) => line.actor === "p" && line.dmg);
    expect(firstHit(simulateBattle(hero, opp, disc, () => 0, "ranked")).dmg)
      .toBe(firstHit(simulateBattle(withHook, opp, disc, () => 0, "ranked")).dmg);
  });

  it("estimates ranked chance from the same discipline rules", () => {
    const hero = {
      ...baseHero(),
      level: 10,
      stats: { str: 20, spd: 20, end: 20, int: 20, team: 20 },
    };
    const opp = { name: "Равный", level: 10, stats: { ...hero.stats }, power: heroPower(hero) };
    const chance = estimateWinChance(hero, opp, DISCIPLINES[0], "ranked");
    expect(chance).toBeGreaterThanOrEqual(45);
    expect(chance).toBeLessThanOrEqual(60);
  });

  it("uses symmetric bounded Elo changes", () => {
    expect(rankedEloDelta(20, 20, true)).toBe(12);
    expect(rankedEloDelta(20, 20, false)).toBe(-12);
    expect(rankedEloDelta(0, 400, true)).toBe(12);
    expect(rankedEloDelta(400, 0, false)).toBe(-12);
  });
});
