/** Боксы скиллов: редкости, каталог и ролл (зеркало клиентского domain/loot). */

const SKILL_RARITIES = {
  common: { id: "common", name: "Обычный", color: "#9CA3AF", weight: 48 },
  uncommon: { id: "uncommon", name: "Необычный", color: "#3DD16F", weight: 28 },
  rare: { id: "rare", name: "Редкий", color: "#2E5EFF", weight: 14 },
  epic: { id: "epic", name: "Эпический", color: "#B07CFF", weight: 7 },
  legendary: { id: "legendary", name: "Легендарный", color: "#FFC93C", weight: 3 },
};

const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary"];

const SKILL_BOX_COST = 10;
const SKILL_DUPLICATE_TOKENS = 3;

/**
 * Каталог скиллов.
 * box: true — только из бокса; без box — открываются за уровень.
 */
const SPORT_SKILLS = {
  wrestling: [
    { id: "grip", name: "Мёртвый захват", rarity: "common", req: 5 },
    { id: "throw", name: "Бросок прогибом", rarity: "uncommon", req: 10 },
    { id: "bridge", name: "Борцовский мост", rarity: "rare", req: 15 },
    { id: "takedown", name: "Подсечка", rarity: "epic", req: 20 },
    { id: "suplex", name: "Коронный суплекс", rarity: "legendary", req: 25 },
    { id: "clinch", name: "Клинч", rarity: "common", box: true },
    { id: "sprawl", name: "Спроул", rarity: "common", box: true },
    { id: "wrist_lock", name: "Залом кисти", rarity: "common", box: true },
    { id: "hip_toss", name: "Через бедро", rarity: "uncommon", box: true },
    { id: "ankle_pick", name: "Зацепом за ногу", rarity: "uncommon", box: true },
    { id: "iron_neck", name: "Железная шея", rarity: "uncommon", box: true },
    { id: "cradle", name: "Колыбель", rarity: "rare", box: true },
    { id: "gut_wrench", name: "Скрутка корпуса", rarity: "rare", box: true },
    { id: "firemans", name: "Мельница", rarity: "epic", box: true },
    { id: "amplitude", name: "Амплитуда", rarity: "epic", box: true },
    { id: "olympic_throw", name: "Олимпийский бросок", rarity: "legendary", box: true },
    { id: "god_suplex", name: "Божественный суплекс", rarity: "legendary", box: true },
  ],
  boxing: [
    { id: "jab", name: "Двойной джеб", rarity: "common", req: 5 },
    { id: "hook", name: "Хук с разворота", rarity: "uncommon", req: 10 },
    { id: "uppercut", name: "Апперкот", rarity: "rare", req: 15 },
    { id: "footwork", name: "Работа ног", rarity: "epic", req: 20 },
    { id: "knockout", name: "Нокаутирующий", rarity: "legendary", req: 25 },
    { id: "slip", name: "Уклон", rarity: "common", box: true },
    { id: "feint", name: "Финт", rarity: "common", box: true },
    { id: "parry", name: "Парирование", rarity: "common", box: true },
    { id: "body_shot", name: "Удар в корпус", rarity: "uncommon", box: true },
    { id: "weave", name: "Нырок", rarity: "uncommon", box: true },
    { id: "peak_a_boo", name: "Пик-а-бу", rarity: "uncommon", box: true },
    { id: "liver_shot", name: "В печень", rarity: "rare", box: true },
    { id: "one_two", name: "Раз-два", rarity: "rare", box: true },
    { id: "rope_a_dope", name: "Верёвочный трюк", rarity: "epic", box: true },
    { id: "check_hook", name: "Чек-хук", rarity: "epic", box: true },
    { id: "haymaker", name: "Коронный хук", rarity: "legendary", box: true },
    { id: "phantom", name: "Фантомный удар", rarity: "legendary", box: true },
  ],
  robotics: [
    { id: "servo", name: "Сервопривод", rarity: "common", req: 5 },
    { id: "armor_plate", name: "Бронеплиты", rarity: "uncommon", req: 10 },
    { id: "autosight", name: "Автоприцел", rarity: "rare", req: 15 },
    { id: "stabilizer", name: "Стабилизаторы", rarity: "epic", req: 20 },
    { id: "overload", name: "Перегрузка", rarity: "legendary", req: 25 },
    { id: "coolant", name: "Охлаждение", rarity: "common", box: true },
    { id: "microburst", name: "Микровсплеск", rarity: "common", box: true },
    { id: "foil_skin", name: "Фольгощит", rarity: "common", box: true },
    { id: "pulse_lock", name: "Импульс-лок", rarity: "uncommon", box: true },
    { id: "gyro", name: "Гироскоп", rarity: "uncommon", box: true },
    { id: "nanoshield", name: "Нанощит", rarity: "uncommon", box: true },
    { id: "laser_grid", name: "Лазерная сетка", rarity: "rare", box: true },
    { id: "emp_burst", name: "ЭМИ-импульс", rarity: "rare", box: true },
    { id: "drone_swarm", name: "Рой дронов", rarity: "epic", box: true },
    { id: "plasma_edge", name: "Плазменный край", rarity: "epic", box: true },
    { id: "singularity", name: "Сингулярность", rarity: "legendary", box: true },
    { id: "zero_day", name: "Zero-Day", rarity: "legendary", box: true },
  ],
};

function sportSkills(sportId) {
  return SPORT_SKILLS[sportId] || [];
}

function boxSkills(sportIdOrList) {
  const list = Array.isArray(sportIdOrList) ? sportIdOrList : sportSkills(sportIdOrList);
  return list.filter((sk) => sk && sk.box);
}

function skillRarityId(skill) {
  if (skill && skill.rarity && SKILL_RARITIES[skill.rarity]) return skill.rarity;
  return "common";
}

function pickWeightedRarity(rng = Math.random, onlyIds = null) {
  const ids = Array.isArray(onlyIds) && onlyIds.length ? onlyIds : RARITY_ORDER;
  const total = ids.reduce((s, id) => s + ((SKILL_RARITIES[id] && SKILL_RARITIES[id].weight) || 0), 0);
  let roll = rng() * total;
  for (const id of ids) {
    roll -= (SKILL_RARITIES[id] && SKILL_RARITIES[id].weight) || 0;
    if (roll <= 0) return id;
  }
  return ids[0] || "common";
}

function rollSkillBox({ skills, ownedSkills = [], rng = Math.random } = {}) {
  const list = Array.isArray(skills) ? skills : [];
  if (!list.length) {
    return { rarity: "common", skillId: null, skill: null, duplicate: false, tokensRefund: SKILL_BOX_COST };
  }
  const owned = new Set(ownedSkills);
  const fresh = list.filter((sk) => sk && sk.id && !owned.has(sk.id));
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

function seedOwnedSkills(hero) {
  const level = Math.max(1, Number(hero && hero.level) || 1);
  const catalog = sportSkills(hero && hero.sport);
  const owned = new Set(Array.isArray(hero && hero.ownedSkills) ? hero.ownedSkills : []);
  for (const sk of catalog) {
    if (sk && sk.box) continue;
    if (level >= (sk.req || 1)) owned.add(sk.id);
  }
  return [...owned];
}

module.exports = {
  SKILL_RARITIES,
  RARITY_ORDER,
  SKILL_BOX_COST,
  SKILL_DUPLICATE_TOKENS,
  sportSkills,
  boxSkills,
  rollSkillBox,
  seedOwnedSkills,
  skillRarityId,
};
