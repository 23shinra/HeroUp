import { GAME } from "@domain/game-data";
import { assetUrl, skillMeta, sportMeta } from "@domain/game-engine";

export const BATTLE_FRAMES = 7;
export const BATTLE_SHEET_MS = {
  attack: 560,
  skill: 720,
  ultimate: 900,
  passive: 640,
};

/** Resolve absolute URL for a battle sheet path. */
export function battleSheetUrl(path) {
  return assetUrl(path);
}

export function sportAttackSheets(sportId) {
  const sport = sportMeta(sportId);
  const sheets = sport?.battleAttacks || [];
  return sheets.map((p) => battleSheetUrl(p)).filter(Boolean);
}

export function skillBattleSheet(skillId) {
  const sk = skillMeta(skillId);
  if (!sk?.battleSheet) return null;
  return battleSheetUrl(sk.battleSheet);
}

/** Pick attack variant alternating, avoiding immediate repeat when possible. */
export function pickAttackVariant(variants, lastIdx = -1, rng = Math.random) {
  if (!variants?.length) return { idx: 0, sheet: null };
  if (variants.length === 1) return { idx: 0, sheet: variants[0] };
  let idx = Math.floor(rng() * variants.length);
  if (idx === lastIdx) idx = (idx + 1) % variants.length;
  return { idx, sheet: variants[idx] };
}

export function durationForAnim(kind) {
  if (kind === "ultimate") return BATTLE_SHEET_MS.ultimate;
  if (kind === "passive") return BATTLE_SHEET_MS.passive;
  if (kind === "skill") return BATTLE_SHEET_MS.skill;
  return BATTLE_SHEET_MS.attack;
}

export function contactFrameOffset(frames = BATTLE_FRAMES) {
  // Impact around frame 5 of 7 (0-based index 4)
  return Math.min(frames - 1, Math.max(1, Math.floor(frames * 0.57)));
}

/** List every skill battle sheet declared in GAME for tests. */
export function allSkillBattleSheets() {
  const out = [];
  for (const sportId of Object.keys(GAME.sportSkills || {})) {
    for (const sk of GAME.sportSkills[sportId]) {
      out.push({ sportId, skillId: sk.id, sheet: sk.battleSheet || null });
    }
  }
  return out;
}

export function allSportAttackSheets() {
  return (GAME.sports || []).map((s) => ({
    sportId: s.id,
    attacks: s.battleAttacks || [],
  }));
}
