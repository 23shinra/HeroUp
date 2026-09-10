import { describe, expect, it } from "vitest";
import {
  SKILL_BOX_COST,
  SKILL_DUPLICATE_TOKENS,
  pickWeightedRarity,
  rarityFromReq,
  rollSkillBox,
  seedOwnedSkills,
  skillRarityId,
} from "./index.js";

describe("loot rarities", () => {
  it("maps req to rarity", () => {
    expect(rarityFromReq(5)).toBe("common");
    expect(rarityFromReq(10)).toBe("uncommon");
    expect(rarityFromReq(15)).toBe("rare");
    expect(rarityFromReq(20)).toBe("epic");
    expect(rarityFromReq(25)).toBe("legendary");
  });

  it("prefers explicit rarity on skill", () => {
    expect(skillRarityId({ req: 5, rarity: "epic" })).toBe("epic");
  });

  it("seeds owned skills by level and skips box-only skills", () => {
    const owned = seedOwnedSkills(
      { level: 12, sport: "boxing", ownedSkills: [] },
      () => [
        { id: "jab", req: 5 },
        { id: "hook", req: 10 },
        { id: "uppercut", req: 15 },
        { id: "slip", box: true, rarity: "common" },
      ],
    );
    expect(owned).toEqual(["jab", "hook"]);
  });
});

describe("skill box roll", () => {
  it("returns a skill from the catalog", () => {
    const skills = [
      { id: "a", req: 5, rarity: "common" },
      { id: "b", req: 25, rarity: "legendary" },
    ];
    const r = rollSkillBox({ skills, ownedSkills: [], rng: () => 0.01 });
    expect(r.skillId).toBeTruthy();
    expect(r.duplicate).toBe(false);
    expect(r.tokensRefund).toBe(0);
  });

  it("refunds tokens on duplicate", () => {
    const skills = [{ id: "jab", req: 5, rarity: "common" }];
    const r = rollSkillBox({ skills, ownedSkills: ["jab"], rng: () => 0.5 });
    expect(r.duplicate).toBe(true);
    expect(r.tokensRefund).toBe(SKILL_DUPLICATE_TOKENS);
  });

  it("prefers unowned skills when any remain", () => {
    const skills = [
      { id: "owned", rarity: "common" },
      { id: "fresh", rarity: "common" },
    ];
    const r = rollSkillBox({ skills, ownedSkills: ["owned"], rng: () => 0.01 });
    expect(r.skillId).toBe("fresh");
    expect(r.duplicate).toBe(false);
  });

  it("box cost is positive", () => {
    expect(SKILL_BOX_COST).toBeGreaterThan(0);
  });

  it("weighted rarity always returns known id", () => {
    for (let i = 0; i < 20; i++) {
      expect(["common", "uncommon", "rare", "epic", "legendary"]).toContain(pickWeightedRarity(() => i / 20));
    }
  });
});
