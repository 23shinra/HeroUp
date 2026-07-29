import { beforeEach, describe, expect, it } from "vitest";
import { defaultState } from "../state/index.js";
import { OUTBOX_KEY, SHApi } from "./index.js";

describe("sync / SHApi outbox", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("dedupes saveState jobs to the latest payload only", () => {
    SHApi.setToken("test-token");
    const stateA = defaultState();
    stateA.hero.level = 2;
    const stateB = defaultState();
    stateB.hero.level = 5;

    SHApi.enqueue({ type: "saveState", payload: stateA });
    SHApi.enqueue({ type: "saveState", payload: stateB });

    const outbox = JSON.parse(localStorage.getItem(OUTBOX_KEY));
    expect(outbox).toHaveLength(1);
    expect(outbox[0].type).toBe("saveState");
    expect(outbox[0].payload.hero.level).toBe(5);
    expect(SHApi.outboxCount()).toBe(1);
  });

  it("dedupes attendance by date and type", () => {
    SHApi.setToken("test-token");
    SHApi.enqueue({ type: "attendance", payload: { date: "2026-07-24" } });
    SHApi.enqueue({ type: "attendance", payload: { date: "2026-07-24" } });
    SHApi.enqueue({ type: "attendance", payload: { date: "2026-07-25" } });
    SHApi.enqueue({ type: "attendanceLeave", payload: { date: "2026-07-24" } });

    const outbox = JSON.parse(localStorage.getItem(OUTBOX_KEY));
    expect(outbox).toHaveLength(3);
    expect(outbox.filter((j) => j.type === "attendance" && j.payload.date === "2026-07-24")).toHaveLength(1);
    expect(outbox.some((j) => j.type === "attendanceLeave")).toBe(true);
  });

  it("queues saveState offline via parkSaveState when token present", () => {
    SHApi.setToken("test-token");
    const state = defaultState();
    state.hero.coins = 999;

    const parked = SHApi.parkSaveState(state);
    expect(parked).toBe(true);
    expect(SHApi.outboxCount()).toBe(1);

    SHApi.setToken(null);
    expect(SHApi.parkSaveState(state)).toBe(false);
  });
});
