import { GAME } from "@domain/game-data";
import { sportMeta, assetUrl, sportSpriteSrc } from "@domain/game-engine";

export function sportOutcomeSprite(sportOrId, won) {
  const sport = typeof sportOrId === "string" ? sportMeta(sportOrId) : sportOrId;
  if (!sport) return null;
  if (won && sport.winSprite) return assetUrl(sport.winSprite);
  if (!won && sport.loseSprite) return assetUrl(sport.loseSprite);
  return assetUrl(sport.sprite) || null;
}

/** Arena face-off: winner in side-facing idle; loser uses sit pose. */
export function arenaOutcomeSprite(sportOrId, won) {
  const sport = typeof sportOrId === "string" ? sportMeta(sportOrId) : sportOrId;
  if (!sport) return null;
  if (won) return sportSpriteSrc(sport);
  if (sport.loseSprite) return assetUrl(sport.loseSprite);
  return sportSpriteSrc(sport);
}

export function resolveOppSportId(opp) {
  if (!opp) return null;
  if (opp.sport) return opp.sport;
  const src = String(opp.sprite || "");
  if (src.includes("boxer")) return "boxing";
  if (src.includes("wrestler")) return "wrestling";
  if (src.includes("roboticist")) return "robotics";
  return null;
}

/** Уникальный спрайт этапа/карты — нельзя подменять sport attack sheets. */
export function hasCustomBattleSprite(opp) {
  if (!opp) return false;
  if (opp.stage != null || opp.mapMode) return true;
  const src = String(opp.sprite || "");
  return src.includes("/stages/") || src.includes("stages/");
}

export function equippedFxMeta(hero) {
  const eq = hero?.cosmetics?.equipped;
  return eq?.fx ? GAME.shop.find((i) => i.id === eq.fx) : null;
}

export function turnHudStatus(line) {
  if (line.fx === "ko") return { text: "Нокаут!", cls: "is-ko" };
  if (line.fx === "ultimate") return { text: "Коронный приём", cls: "is-skill" };
  if (line.fx === "combo") return { text: "Комбо!", cls: "is-skill" };
  if (line.fx === "firststrike") return { text: "Первый удар", cls: "is-skill" };
  if (line.fx === "dodge") return { text: "Уклонение", cls: "is-dodge" };
  if (line.fx === "stun") return { text: "Оглушение", cls: "is-stun" };
  if (line.fx === "passive") return { text: "Скилл!", cls: "is-skill" };
  if (line.dmg !== undefined) {
    if (line.side === "e") return { text: line.crit ? "Твой крит!" : "Твой удар", cls: line.crit ? "is-crit" : "is-you" };
    return { text: "Удар соперника", cls: "is-enemy" };
  }
  return { text: "Ход боя", cls: "" };
}

export const BATTLE_FX = {
  crit: { icon: "bolt", label: "КРИТ", variant: "crit", color: "#FFD84D", glow: "rgba(255,140,0,0.9)" },
  ko: { icon: "flame", label: "НОКАУТ", variant: "ko", color: "#FF6B5B", glow: "rgba(255,80,60,0.9)" },
  ultimate: { icon: "swords", label: "Коронный приём", variant: "skill", color: "#B07CFF", glow: "rgba(176,124,255,0.9)" },
  combo: { icon: "bolt", label: "Комбо", variant: "skill", color: "#30D9FF", glow: "rgba(48,217,255,0.9)" },
  firststrike: { icon: "bolt", label: "Первый удар", variant: "skill", color: "#3DD16F", glow: "rgba(61,209,111,0.9)" },
  dodge: { icon: "wind", label: "Уклонение", variant: "skill", color: "#7AE4FF", glow: "rgba(122,228,255,0.9)" },
  stun: { icon: "star", label: "Оглушение", variant: "skill", color: "#FFB54D", glow: "rgba(255,181,77,0.9)" },
  passive: { icon: "sparkles", label: "Скилл", variant: "skill", color: "#3DD16F", glow: "rgba(61,209,111,0.75)" },
};

export const SKILL_FX_SET = new Set(["ultimate", "combo", "firststrike", "dodge", "stun", "passive"]);

export function hasUnresolvedBattle(battlePhase, battleState) {
  if (!battleState?.opp || battleState.rewards) return false;
  if (battleState.pendingAccept) return true;
  if (battlePhase === "arena" || battlePhase === "matchmaking") return true;
  return false;
}
