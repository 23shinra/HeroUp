import { describe, expect, it } from "vitest";
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
    expect(sheets.length).toBe(15);
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
