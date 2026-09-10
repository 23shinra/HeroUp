/** Редкости скиллов, боксы и ролл наград. */

export const SKILL_RARITIES = {
  common: { id: "common", name: "Обычный", color: "#9CA3AF", weight: 48 },
  uncommon: { id: "uncommon", name: "Необычный", color: "#3DD16F", weight: 28 },
  rare: { id: "rare", name: "Редкий", color: "#2E5EFF", weight: 14 },
  epic: { id: "epic", name: "Эпический", color: "#B07CFF", weight: 7 },
  legendary: { id: "legendary", name: "Легендарный", color: "#FFC93C", weight: 3 },
};

export const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary"];

/** Цена открытия одного бокса навыков. */
export const SKILL_BOX_COST = 10;

/** Сколько токенов вернуть, если выпал уже открытый скилл. */
export const SKILL_DUPLICATE_TOKENS = 3;

export function rarityMeta(id) {
  return SKILL_RARITIES[id] || SKILL_RARITIES.common;
}

/** Редкость по уровню-требованию (для старых скиллов без поля rarity). */
export function rarityFromReq(req) {
  const n = Number(req) || 0;
  if (n >= 25) return "legendary";
  if (n >= 20) return "epic";
  if (n >= 15) return "rare";
  if (n >= 10) return "uncommon";
  return "common";
}

export function skillRarityId(skill) {
  if (!skill) return "common";
  if (skill.rarity && SKILL_RARITIES[skill.rarity]) return skill.rarity;
  return rarityFromReq(skill.req);
}

/**
 * Выдать скиллы, уже открытые по уровню (миграция старых сейвов).
 * @returns {string[]} owned skill ids
 */
export function seedOwnedSkills(hero, sportSkillsFn) {
  const level = Math.max(1, Number(hero?.level) || 1);
  const sport = hero?.sport;
  const catalog = typeof sportSkillsFn === "function" ? sportSkillsFn(sport) : [];
  const owned = new Set(Array.isArray(hero?.ownedSkills) ? hero.ownedSkills : []);
  for (const sk of catalog) {
    if (sk?.box) continue;
    if (level >= (sk.req || 1)) owned.add(sk.id);
  }
  return [...owned];
}

/** Скиллы, которые выпадают только из бокса (не за уровень). */
export function boxSkills(list) {
  return (Array.isArray(list) ? list : []).filter((sk) => sk?.box);
}

/**
 * Ролл бокса: редкость → скилл спорта.
 * Уже открытые скиллы в пул не попадают, пока есть новые.
 * @returns {{ rarity, skillId, skill, duplicate, tokensRefund }}
 */
export function rollSkillBox({ skills, ownedSkills = [], rng = Math.random } = {}) {
  const list = Array.isArray(skills) ? skills : [];
  if (!list.length) {
    return { rarity: "common", skillId: null, skill: null, duplicate: false, tokensRefund: SKILL_BOX_COST };
  }

  const owned = new Set(ownedSkills);
  const fresh = list.filter((sk) => sk?.id && !owned.has(sk.id));
  const poolSource = fresh.length ? fresh : list;
  const availableRarities = RARITY_ORDER.filter((id) => poolSource.some((sk) => skillRarityId(sk) === id));
  const rarity = availableRarities.length
    ? pickWeightedRarity(rng, availableRarities)
    : pickWeightedRarity(rng);
  const pool = poolSource.filter((sk) => skillRarityId(sk) === rarity);
  const fallbackPool = pool.length ? pool : poolSource;
  const skill = fallbackPool[Math.floor(rng() * fallbackPool.length)];
  const duplicate = owned.has(skill.id);
  return {
    rarity: skillRarityId(skill),
    skillId: skill.id,
    skill,
    duplicate,
    tokensRefund: duplicate ? SKILL_DUPLICATE_TOKENS : 0,
  };
}

export function pickWeightedRarity(rng = Math.random, onlyIds = null) {
  const ids = Array.isArray(onlyIds) && onlyIds.length ? onlyIds : RARITY_ORDER;
  const total = ids.reduce((s, id) => s + (SKILL_RARITIES[id]?.weight || 0), 0);
  let roll = rng() * total;
  for (const id of ids) {
    roll -= SKILL_RARITIES[id]?.weight || 0;
    if (roll <= 0) return id;
  }
  return ids[0] || "common";
}
