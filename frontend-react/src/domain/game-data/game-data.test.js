import { describe, expect, it } from "vitest";
import { GAME, xpToNext } from "./index.js";

describe("game-data", () => {
  it("exports GAME with core tables", () => {
    expect(GAME.sports).toHaveLength(3);
    expect(GAME.stats).toHaveLength(5);
    expect(GAME.classes).toHaveLength(5);
    expect(GAME.botNames.length).toBeGreaterThan(0);
    expect(GAME.sportSkills.wrestling).toHaveLength(5);
  });

  it("xpToNext follows production formula", () => {
    expect(xpToNext(1)).toBe(100);
    expect(xpToNext(2)).toBe(160);
    expect(xpToNext(5)).toBe(340);
  });
});
