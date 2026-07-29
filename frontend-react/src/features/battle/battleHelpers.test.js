import { describe, expect, it } from "vitest";
import { sportMeta } from "@domain/game-engine";
import { arenaOutcomeSprite } from "./battleHelpers.js";

describe("battleHelpers arenaOutcomeSprite", () => {
  it("winner uses side-facing idle sprite", () => {
    const src = arenaOutcomeSprite("boxing", true);
    expect(src).toContain("/assets/boxer");
    expect(src).not.toContain("boxer-win");
  });

  it("loser uses lose pose when available", () => {
    const src = arenaOutcomeSprite("boxing", false);
    expect(src).toContain("/assets/boxer-lose");
  });

  it("falls back to idle when lose sprite missing", () => {
    const sport = sportMeta("boxing");
    const fake = { ...sport, loseSprite: null };
    const src = arenaOutcomeSprite(fake, false);
    expect(src).toContain("/assets/boxer");
  });
});
