import { describe, expect, it } from "vitest";
import {
  ACCOUNT_KEY,
  STORAGE_KEY,
  bindAccountSession,
  defaultState,
  deepMerge,
  getBoundAccount,
  hydrateState,
  loadState,
  localStateOwnsAccount,
  normAccount,
  saveState,
  setBoundAccount,
} from "./index.js";

describe("state", () => {
  it("defaultState matches production hero shape", () => {
    const s = defaultState();
    expect(s.hero.level).toBe(1);
    expect(s.hero.stats).toEqual({ str: 5, spd: 5, end: 5, int: 5, team: 5 });
    expect(s.hero.statPoints).toBe(5);
    expect(s.stats).toEqual({ trainings: 0, wins: 0, losses: 0 });
    expect(s.auth.role).toBe("child");
  });

  it("load/save round-trips sporthero.save.v2", () => {
    const s = defaultState();
    s.created = true;
    s.hero.name = "Test Hero";
    s.hero.level = 3;
    const returned = saveState(s);
    expect(returned).toBe(s);
    expect(returned.hero.name).toBe("Test Hero");
    const loaded = loadState();
    expect(loaded.hero.name).toBe("Test Hero");
    expect(loaded.hero.level).toBe(3);
    expect(localStorage.getItem(STORAGE_KEY)).toBeTruthy();
  });

  it("normAccount lowercases and trims", () => {
    expect(normAccount("  Alice  ")).toBe("alice");
    expect(normAccount("")).toBe("");
  });

  it("setBoundAccount stores normalized username", () => {
    setBoundAccount("Bob");
    expect(getBoundAccount()).toBe("bob");
    expect(localStorage.getItem(ACCOUNT_KEY)).toBe("bob");
  });

  it("bindAccountSession clears save on account mismatch", () => {
    const s = defaultState();
    s.created = true;
    s.auth.username = "alice";
    saveState(s);
    setBoundAccount("alice");

    const ok = bindAccountSession("bob");
    expect(ok).toBe(false);
    expect(loadState().created).toBe(false);
    expect(getBoundAccount()).toBe("bob");
  });

  it("localStateOwnsAccount checks username match", () => {
    const s = defaultState();
    s.created = true;
    s.auth.username = "alice";
    expect(localStateOwnsAccount(s, "alice")).toBe(true);
    expect(localStateOwnsAccount(s, "bob")).toBe(false);
  });

  it("hydrateState fills missing fields from defaults", () => {
    const partial = { hero: { name: "Kid", level: 2 } };
    const merged = hydrateState(partial);
    expect(merged.hero.name).toBe("Kid");
    expect(merged.hero.level).toBe(2);
    expect(merged.hero.stats.str).toBe(5);
    expect(merged.quests.list).toEqual([]);
  });

  it("deepMerge preserves arrays from override", () => {
    const base = { items: [1, 2] };
    expect(deepMerge(base, { items: [3] }).items).toEqual([3]);
  });
});
