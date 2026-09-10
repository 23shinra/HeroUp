import { GAME, xpToNext } from "../game-data/index.js";
import { icon } from "../icons/index.js";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const STAT_POINTS_PER_LEVEL = 5;

export const DISCIPLINES = [
  { id: "wrestling", name: "Борьба", icon: "wrestling", stat: "str", statName: "Сила", tagline: "решает сила" },
  { id: "boxing", name: "Бокс", icon: "boxing", stat: "spd", statName: "Скорость", tagline: "решает скорость" },
  { id: "robotics", name: "Робототехника", icon: "robotics", stat: "int", statName: "Интеллект", tagline: "решает интеллект" },
];

export const CAMPAIGN_LEVELS = 20;

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function pickDiscipline() {
  return pick(DISCIPLINES);
}

export const STAGE_ENEMIES = [
  { name: "Хулиган со двора", avatar: "skull", sprite: "./assets/stages/stage-01-hooligan.webp?v=1" },
  { name: "Пацан с района", avatar: "user", sprite: "./assets/stages/stage-02-punk.webp?v=1" },
  { name: "Школьный задира", avatar: "flame", sprite: "./assets/stages/stage-03-bully.webp?v=1" },
  { name: "Уличный боец", avatar: "swords", sprite: "./assets/stages/stage-04-street.webp?v=1" },
  { name: "Боксёр из подвала", avatar: "boxing", sprite: "./assets/stages/stage-05-basement-boxer.webp?v=1" },
  { name: "Тренировочный партнёр", avatar: "dumbbell", sprite: "./assets/stages/stage-06-partner.webp?v=1" },
  { name: "Любитель клуба", avatar: "boxer", sprite: "./assets/stages/stage-07-amateur.webp?v=1" },
  { name: "Районный чемпион", avatar: "medal", sprite: "./assets/stages/stage-08-district-champ.webp?v=1" },
  { name: "Городской чемпион", avatar: "trophy", sprite: "./assets/stages/stage-09-city-champ.webp?v=1" },
  { name: "Кандидат в мастера", avatar: "badge", sprite: "./assets/stages/stage-10-candidate.webp?v=1" },
  { name: "Мастер спорта", avatar: "star", sprite: "./assets/stages/stage-11-master.webp?v=1" },
  { name: "Профи-дебютант", avatar: "bolt", sprite: "./assets/stages/stage-12-pro.webp?v=1" },
  { name: "Контендер", avatar: "target", sprite: "./assets/stages/stage-13-contender.webp?v=1" },
  { name: "Чемпион Казахстана", avatar: "flag", sprite: "./assets/stages/stage-14-kz-champ.webp?v=1" },
  { name: "Чемпион Азии", avatar: "crown", sprite: "./assets/stages/stage-15-asia-champ.webp?v=1" },
  { name: "Геннадий Головкин", avatar: "boxing", sprite: "./assets/stages/stage-16-legend-gg.webp?v=1" },
  { name: "Александр Карелин", avatar: "wrestling", sprite: "./assets/stages/stage-17-legend-wrestler.webp?v=1" },
  { name: "Мохаммед Али", avatar: "sparkles", sprite: "./assets/stages/stage-18-legend-ali.webp?v=1" },
  { name: "Майк Тайсон", avatar: "flame", sprite: "./assets/stages/stage-19-legend-iron.webp?v=1" },
  { name: "Легенда всех времён", avatar: "crown", sprite: "./assets/stages/stage-20-ultimate.webp?v=1" },
];

/** Координаты этапов в % карты (x,y). Калибровано под map-city 900×1350. */
export const STAGE_ROAD = [
  [51.8, 91.5],
  [51.6, 87.4],
  [48.0, 83.4],
  [43.2, 79.4],
  [41.4, 75.3],
  [44.6, 71.3],
  [52.0, 67.3],
  [56.4, 63.3],
  [53.6, 59.3],
  [44.9, 55.3],
  [41.5, 51.2],
  [48.0, 47.2],
  [55.0, 43.0],
  [58.0, 38.6],
  [57.5, 34.4],
  [54.5, 30.4],
  [52.5, 26.4],
  [51.5, 22.4],
  [50.5, 18.6],
  [50.0, 15.0],
];

export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Ключ ISO-недели (год-неделя), напр. "2026-W27". Неделя начинается с понедельника. */
export function weekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t - yearStart) / 864e5 + 1) / 7);
  return t.getUTCFullYear() + "-W" + String(week).padStart(2, "0");
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Детерминированный ГПСЧ по строке-семени — чтобы состав секции был стабилен. */
export function seededRandom(seedStr) {
  let s = 0;
  for (let i = 0; i < seedStr.length; i++) s = (s * 31 + seedStr.charCodeAt(i)) >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Map production-relative asset paths to web-root paths. */
export function assetUrl(path) {
  if (!path) return "";
  return String(path).replace(/^\.\/assets/, "/assets");
}

export function statMeta(id) { return GAME.stats.find((s) => s.id === id); }
export function sportMeta(id) { return GAME.sports.find((s) => s.id === id); }

export function sportSpriteSrc(sport, { training = false } = {}) {
  if (!sport) return "";
  const raw = training && sport.trainingSprite ? sport.trainingSprite : sport.sprite;
  if (!raw) return "";
  const url = assetUrl(raw);
  return url.includes("?") ? url : `${url}?v=5`;
}

export function classMeta(id) { return GAME.classes.find((c) => c.id === id); }

export function personAvatarIcon(entity, size = 24) {
  const sportById = entity && entity.sport ? sportMeta(entity.sport) : null;
  const rawAvatar = entity && entity.avatar ? String(entity.avatar).toLowerCase() : "";
  const sportByAvatar = !sportById && rawAvatar
    ? GAME.sports.find((s) => String(s.avatar).toLowerCase() === rawAvatar)
    : null;
  const sportByAlias = !sportById && !sportByAvatar && rawAvatar
    ? (rawAvatar.includes("box")
        ? sportMeta("boxing")
        : (rawAvatar.includes("wrest")
            ? sportMeta("wrestling")
            : (rawAvatar.includes("robot") ? sportMeta("robotics") : null)))
    : null;
  const sport = sportById || sportByAvatar || sportByAlias;
  if (sport && sport.sprite) {
    const src = sportSpriteSrc(sport);
    return `<img class="item__photo" src="${src}" alt="${sport.name}" />`;
  }
  const fallback = entity && entity.avatar ? entity.avatar : "user";
  return icon(fallback, size);
}

export function effectiveStats(hero) {
  const st = { ...hero.stats };
  const cls = classMeta(hero.class);
  if (cls && cls.mult) for (const k in cls.mult) st[k] = Math.round(st[k] * cls.mult[k]);
  return st;
}

export function sportSkills(sportId) { return (GAME.sportSkills && GAME.sportSkills[sportId]) || []; }

export function skillMeta(id) {
  for (const sid in GAME.sportSkills) {
    const f = GAME.sportSkills[sid].find((s) => s.id === id);
    if (f) return f;
  }
  return null;
}

export function battleFx(h) {
  const fx = {
    comboChance: 0,
    critMult: 2,
    firstStrike: 1,
    dodgeChance: 0,
    stunChance: 0,
    dmgReduction: 0,
    hpBonus: 0,
    ultimate: 0,
    comboSkillId: null,
    critSkillId: null,
    firstStrikeSkillId: null,
    dodgeSkillId: null,
    stunSkillId: null,
    ultimateSkillId: null,
    passiveSkills: [],
  };
  (h.loadout || []).forEach((id) => {
    const sk = skillMeta(id);
    if (!sk) return;
    const owned = Array.isArray(h.ownedSkills) ? h.ownedSkills : null;
    // Prefer ownership; fall back to level gate for unsynced old saves.
    if (owned && owned.length) {
      if (!owned.includes(id)) return;
    } else if (h.level < sk.req) {
      return;
    }
    const e = sk.effect || {};
    if (e.comboChance) {
      fx.comboChance += e.comboChance;
      fx.comboSkillId = id;
    }
    if (e.critMult) {
      if (e.critMult > fx.critMult) {
        fx.critMult = e.critMult;
        fx.critSkillId = id;
      }
    }
    if (e.firstStrike) {
      if (e.firstStrike > fx.firstStrike) {
        fx.firstStrike = e.firstStrike;
        fx.firstStrikeSkillId = id;
      }
    }
    if (e.dodgeChance) {
      fx.dodgeChance += e.dodgeChance;
      fx.dodgeSkillId = id;
    }
    if (e.stunChance) {
      fx.stunChance += e.stunChance;
      fx.stunSkillId = id;
    }
    if (e.dmgReduction) {
      fx.dmgReduction += e.dmgReduction;
      fx.passiveSkills.push({ id, kind: "guard" });
    }
    if (e.hpBonus) {
      fx.hpBonus += e.hpBonus;
      fx.passiveSkills.push({ id, kind: "vitality" });
    }
    if (e.ultimate) {
      if (e.ultimate > fx.ultimate) {
        fx.ultimate = e.ultimate;
        fx.ultimateSkillId = id;
      }
    }
    // Passive crit boost also gets an intro flash
    if (e.critMult && !e.comboChance && !e.firstStrike && !e.ultimate) {
      fx.passiveSkills.push({ id, kind: "focus" });
    }
  });
  return fx;
}

export function powerOf(stats, level) {
  return Math.round(stats.str * 1.2 + stats.spd * 1.0 + stats.end * 0.9 + stats.int * 0.9 + stats.team * 0.8 + level * 6);
}

export function heroPower(hero) {
  return powerOf(effectiveStats(hero), hero.level);
}

export function leagueOf(trophies) {
  let cur = GAME.leagues[0];
  for (const l of GAME.leagues) if (trophies >= l.min) cur = l;
  return cur;
}

/** Отображаемый Эло (база 1000 + очки за бои). */
export function eloOf(trophies) {
  return 1000 + Math.max(0, Number(trophies) || 0);
}

export function rankedEloDelta(playerTrophies, opponentTrophies, won, kFactor = 24) {
  const playerElo = eloOf(playerTrophies);
  const opponentElo = eloOf(opponentTrophies);
  const expected = 1 / (1 + 10 ** ((opponentElo - playerElo) / 400));
  const raw = Math.round(kFactor * ((won ? 1 : 0) - expected));
  return won ? clamp(raw, 1, 12) : clamp(raw, -12, -1);
}

/** Насколько «далеко» ушёл прогресс — бои, уровни, статы, монеты, квесты и т.д. */
export function stateSyncScore(st) {
  if (!st || !st.hero) return 0;
  const h = st.hero;
  const stats = st.stats || {};
  const heroStats = h.stats || {};
  const battles = Array.isArray(st.battles) ? st.battles.length : 0;
  const stages = (h.stagesCleared && h.stagesCleared.length) || 0;
  const loadout = (h.loadout && h.loadout.length) || 0;
  const ach = (h.achievementsClaimed && h.achievementsClaimed.length) || 0;
  const seasonClaimed = (h.seasonClaimed && h.seasonClaimed.length) || 0;
  const cosmetics = (h.cosmetics && h.cosmetics.owned && h.cosmetics.owned.length) || 0;
  const questDone = (st.quests && Array.isArray(st.quests.list))
    ? st.quests.list.filter((q) => q && q.claimed).length
    : 0;
  const statSum = ["str", "spd", "end", "int", "team"]
    .reduce((a, id) => a + (Number(heroStats[id]) || 0), 0);
  const spentStatPoints = Math.max(0, ((Number(h.level) || 1) * 5) - (Number(h.statPoints) || 0));
  return (Number(h.level) || 1) * 1000000
    + (Number(h.xp) || 0) * 100
    + (Number(stats.wins) || 0) * 10000
    + (Number(stats.losses) || 0) * 1000
    + (Number(stats.trainings) || 0) * 5000
    + battles * 300
    + stages * 500
    + (Number(h.trophies) || 0) * 10
    + (Number(h.coins) || 0)
    + (Number(h.tokens) || 0)
    + (Number(h.seasonPoints) || 0) * 5
    + statSum * 50
    + spentStatPoints * 80
    + loadout * 40
    + ach * 120
    + seasonClaimed * 90
    + cosmetics * 60
    + questDone * 70
    + (h.class ? 500 : 0)
    + (Number(st.updatedAt) || 0) / 1e13;
}

export function pickNewerState(local, remote) {
  if (!local || !local.hero) return remote;
  if (!remote || !remote.hero) return local;
  const ls = stateSyncScore(local);
  const rs = stateSyncScore(remote);
  const base = ls !== rs
    ? (ls > rs ? local : remote)
    : ((Number(local.updatedAt) || 0) >= (Number(remote.updatedAt) || 0) ? local : remote);
  // Кошелёк токенов — всегда с сервера (траты на кейс не должны «откатываться»).
  if (remote.hero && Object.prototype.hasOwnProperty.call(remote.hero, "tokens")) {
    const tokens = Math.max(0, Math.floor(Number(remote.hero.tokens) || 0));
    if ((Number(base.hero.tokens) || 0) !== tokens) {
      return { ...base, hero: { ...base.hero, tokens } };
    }
  }
  return base;
}

export function addXpPure(hero, amount) {
  const h = {
    ...hero,
    stats: hero.stats ? { ...hero.stats } : {},
  };
  h.xp = (h.xp || 0) + amount;
  let leveled = 0;
  while (h.xp >= xpToNext(h.level)) {
    h.xp -= xpToNext(h.level);
    h.level++;
    leveled++;
  }
  if (leveled) {
    h.statPoints = (h.statPoints || 0) + leveled * STAT_POINTS_PER_LEVEL;
  }
  return { hero: h, amount, leveled };
}

function makeRngHelpers(rng = Math.random) {
  const rnd = (min, max) => rng() * (max - min) + min;
  const ri = (min, max) => Math.floor(rnd(min, max + 1));
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  return { rnd, ri, pick };
}

export function makeOpponent(hero, rng = Math.random) {
  const { rnd, ri, pick } = makeRngHelpers(rng);
  const lvl = clamp(hero.level + ri(-1, 1), 1, hero.level + 1);
  const base = hero.stats;
  const factor = rnd(0.85, 1.08);
  const stats = {};
  GAME.stats.forEach((s) => { stats[s.id] = Math.max(3, Math.round(base[s.id] * factor + ri(-2, 2))); });
  const oppSport = pick(GAME.sports);
  return {
    name: pick(GAME.botNames),
    avatar: pick(GAME.botAvatars),
    sport: oppSport.id,
    sprite: oppSport.sprite,
    level: lvl,
    stats,
    power: powerOf(stats, lvl),
    trophies: Math.max(0, (Number(hero.trophies) || 0) + ri(-25, 25)),
    isBot: true,
  };
}

export function mapPlayerToOpponent(p, rng = Math.random) {
  const { pick } = makeRngHelpers(rng);
  const sport = sportMeta(p.sport) || pick(GAME.sports);
  const st = p.stats || {};
  const stats = {};
  GAME.stats.forEach((s) => { stats[s.id] = Math.max(3, Number(st[s.id]) || 5); });
  const lvl = Math.max(1, Number(p.level) || 1);
  return {
    name: p.name || "Соперник",
    avatar: p.avatar || sport.avatar || "user",
    sport: sport.id,
    sprite: sport.sprite,
    level: lvl,
    stats,
    power: powerOf(stats, lvl),
    trophies: Math.max(0, Number(p.trophies) || 0),
  };
}

export function pickRankedOpponent(hero, candidates, rng = Math.random) {
  const pool = Array.isArray(candidates) ? candidates.filter(Boolean) : [];
  if (!pool.length) return makeOpponent(hero, rng);

  const playerPower = Math.max(1, heroPower(hero));
  const playerTrophies = Math.max(0, Number(hero.trophies) || 0);
  const ranked = pool.map((opp) => {
    const levelDiff = Math.abs((Number(opp.level) || 1) - (Number(hero.level) || 1));
    const powerDiff = Math.abs((Number(opp.power) || 0) - playerPower) / playerPower;
    const trophyDiff = Math.abs((Number(opp.trophies) || 0) - playerTrophies);
    const score = levelDiff * 3 + powerDiff * 12 + trophyDiff / 50;
    return { opp, levelDiff, powerDiff, trophyDiff, score };
  });

  const tiers = [
    (x) => x.levelDiff <= 2 && x.powerDiff <= 0.15 && x.trophyDiff <= 100,
    (x) => x.levelDiff <= 3 && x.powerDiff <= 0.25 && x.trophyDiff <= 250,
  ];
  const matches = tiers.map((accept) => ranked.filter(accept)).find((items) => items.length);
  if (!matches) return makeOpponent(hero, rng);

  const finalists = matches.sort((a, b) => a.score - b.score).slice(0, 5);
  const idx = Math.min(finalists.length - 1, Math.floor(rng() * finalists.length));
  return finalists[idx].opp;
}

export function simulateBattle(hero, opp, disc, rng = Math.random, ruleset = "standard") {
  const { rnd } = makeRngHelpers(rng);
  const ps = effectiveStats(hero);
  const es = opp.stats;
  const fx = battleFx(hero);
  const decid = disc ? disc.stat : null;
  const ranked = ruleset === "ranked";

  let pHP = ranked
    ? Math.round((150 + ps.end * 3 + hero.level * 9) * (1 + Math.min(0.3, fx.hpBonus)))
    : Math.round((100 + ps.end * 6 + hero.level * 8) * (1 + fx.hpBonus));
  let eHP = ranked
    ? Math.round(150 + es.end * 3 + opp.level * 9)
    : 100 + es.end * 6 + opp.level * 8;
  const pMax = pHP;
  const eMax = eHP;
  const log = [];

  // Passive skill intros (visual-only events before punches)
  (fx.passiveSkills || []).forEach((pskill) => {
    const sk = skillMeta(pskill.id);
    if (!sk) return;
    log.push({
      t: `${hero.name} активирует «${sk.name}»`,
      side: "p",
      fx: "passive",
      skillId: pskill.id,
      anim: "skill",
      actor: "p",
      pHP,
      eHP,
    });
  });

  const atk = (s) => {
    if (ranked) return s.str * 0.4 + s.spd * 0.4 + s.int * 0.35 + s.team * 0.1;
    if (decid === "str") return s.str * 1.5 + s.spd * 0.35 + s.int * 0.4;
    if (decid === "spd") return s.spd * 1.5 + s.str * 0.45 + s.int * 0.4;
    if (decid === "int") return s.int * 1.5 + s.spd * 0.35 + s.str * 0.4;
    return s.str + s.spd * 0.7 + s.int * 0.5;
  };
  const def = (s) => {
    if (ranked) {
      const level = s === ps ? hero.level : opp.level;
      return 8 + s.end * 0.25 + s.team * 0.12
        + (s.str + s.spd + s.int) * 0.08 + level * 0.2;
    }
    if (decid === "str") return s.end * 0.7 + s.str * 0.25 + s.team * 0.3;
    if (decid === "spd") return s.spd * 0.5 + s.end * 0.4 + s.team * 0.3;
    if (decid === "int") return s.int * 0.4 + s.end * 0.4 + s.team * 0.35;
    return s.end * 0.6 + s.team * 0.4;
  };
  const disciplineEdge = decid
    ? clamp(((ps[decid] || 0) - (es[decid] || 0)) / Math.max(10, ps[decid] || 0, es[decid] || 0), -1, 1)
    : 0;
  const pDisciplineMult = ranked ? 1 + disciplineEdge * 0.02 : 1;
  const eDisciplineMult = ranked ? 1 - disciplineEdge * 0.02 : 1;
  const rankedDamage = (attacker, defender, level, disciplineMult, reduction = 0) => {
    const base = 10 + (atk(attacker) - def(defender)) * 0.45 + level * 0.4;
    return Math.max(1, base * disciplineMult * (1 - reduction));
  };
  let ultUsed = false;
  let firstStrikeUsed = false;

  let playerFirst = hero.class === "sprinter" ? true : rng() < 0.5;
  let round = 1;

  const MAX_ROUNDS = 40;
  while (pHP > 0 && eHP > 0 && round <= MAX_ROUNDS) {
    const fatigue = 1 + (round - 1) * (ranked ? 0.1 : 0.18);
    const order = playerFirst ? ["p", "e"] : ["e", "p"];
    for (const who of order) {
      if (pHP <= 0 || eHP <= 0) break;
      if (who === "p") {
        let dmg = (ranked
          ? rankedDamage(ps, es, hero.level, pDisciplineMult)
          : (atk(ps) / (def(es) + 8)) * 14) * rnd(0.85, 1.2) * fatigue;
        let crit = false;
        let atkFx = null;
        let skillId = null;
        let anim = "attack";
        if (ranked && fx.ultimate && !ultUsed && round >= 3) {
          dmg *= fx.ultimate;
          ultUsed = true;
          crit = true;
          atkFx = "ultimate";
          skillId = fx.ultimateSkillId;
          anim = "ultimate";
          log.push({
            t: `${hero.name} проводит коронный приём!`,
            crit: true,
            side: "p",
            fx: "ultimate",
            skillId,
            anim,
            actor: "p",
            pHP,
            eHP,
          });
        } else if (!firstStrikeUsed && fx.firstStrike > 1) {
          dmg *= fx.firstStrike;
          firstStrikeUsed = true;
          crit = true;
          atkFx = "firststrike";
          skillId = fx.firstStrikeSkillId;
          anim = "skill";
        } else if (fx.comboChance && rng() < Math.min(0.35, fx.comboChance)) {
          dmg *= ranked ? 1.65 : fx.critMult;
          crit = true;
          atkFx = "combo";
          skillId = fx.comboSkillId;
          anim = "skill";
        } else if (ranked && fx.critSkillId && rng() < 0.12) {
          dmg *= fx.critMult;
          crit = true;
          atkFx = "crit";
          skillId = fx.critSkillId;
          anim = "skill";
        } else if (!ranked && fx.ultimate && !ultUsed && round >= 3) {
          dmg *= fx.ultimate;
          ultUsed = true;
          crit = true;
          atkFx = "ultimate";
          skillId = fx.ultimateSkillId;
          anim = "ultimate";
          log.push({
            t: `${hero.name} проводит коронный приём!`,
            crit: true,
            side: "p",
            fx: "ultimate",
            skillId,
            anim,
            actor: "p",
            pHP,
            eHP,
          });
        }
        dmg = Math.max(1, Math.round(dmg));
        eHP = Math.max(0, eHP - dmg);
        const ko = eHP <= 0;
        const lineFx = ko ? "ko" : (atkFx || (crit ? "crit" : null));
        // Crit from critMult-only skills (hook/autosight) on normal crit path
        if (!skillId && crit && atkFx === "combo" && fx.critSkillId) skillId = fx.critSkillId;
        if (!skillId && crit && lineFx === "crit" && fx.critSkillId) {
          skillId = fx.critSkillId;
          anim = "skill";
        }
        log.push({
          t: `${ko ? "НОКАУТ! " : crit ? "КРИТ! " : ""}${hero.name} наносит ${dmg} урона`,
          crit: crit || ko,
          side: "e",
          dmg,
          fx: lineFx,
          skillId: skillId || undefined,
          anim: skillId ? anim : "attack",
          actor: "p",
          pHP,
          eHP,
        });
      } else {
        if (fx.stunChance && rng() < Math.min(ranked ? 0.3 : 1, fx.stunChance)) {
          log.push({
            t: `${opp.name} оглушён и пропускает удар!`,
            crit: false,
            side: "e",
            fx: "stun",
            skillId: fx.stunSkillId || undefined,
            anim: "skill",
            actor: "p",
            pHP,
            eHP,
          });
          continue;
        }
        if (fx.dodgeChance && rng() < Math.min(ranked ? 0.3 : 1, fx.dodgeChance)) {
          log.push({
            t: `${hero.name} уклоняется от удара!`,
            crit: false,
            side: "p",
            fx: "dodge",
            skillId: fx.dodgeSkillId || undefined,
            anim: "skill",
            actor: "p",
            pHP,
            eHP,
          });
          continue;
        }
        let dmg = Math.max(1, Math.round((ranked
          ? rankedDamage(es, ps, opp.level, eDisciplineMult, Math.min(0.3, fx.dmgReduction))
          : (atk(es) / (def(ps) + 8)) * 14 * (1 - fx.dmgReduction)) * rnd(0.85, 1.2) * fatigue));
        pHP = Math.max(0, pHP - dmg);
        const ko = pHP <= 0;
        log.push({
          t: `${ko ? "НОКАУТ! " : ""}${opp.name} наносит ${dmg} урона`,
          crit: ko,
          side: "p",
          dmg,
          fx: ko ? "ko" : null,
          anim: "attack",
          actor: "e",
          pHP,
          eHP,
        });
      }
    }
    round++;
  }

  const win = eHP <= 0 ? true : (pHP <= 0 ? false : pHP > eHP);
  return { log, win, pMax, eMax, pHP, eHP };
}

export function summarizeBattleLog(log) {
  const procs = { combo: 0, firststrike: 0, ultimate: 0, dodge: 0, stun: 0 };
  let dmgDealt = 0;
  let dmgTaken = 0;
  (log || []).forEach((l) => {
    if (l.dmg !== undefined) {
      if (l.side === "e") dmgDealt += l.dmg;
      else if (l.side === "p") dmgTaken += l.dmg;
    }
    if (l.fx && procs[l.fx] !== undefined) procs[l.fx] += 1;
  });
  const skillProcs = procs.combo + procs.firststrike + procs.ultimate + procs.dodge + procs.stun;
  return { dmgDealt, dmgTaken, skillProcs, procs };
}

/** Сжатый лог для истории боёв (без arena-only полей). */
export function slimBattleLog(log) {
  return (log || []).map((l) => {
    const row = {
      t: l.t,
      side: l.side,
      actor: l.actor,
      pHP: l.pHP,
      eHP: l.eHP,
    };
    if (l.dmg != null) row.dmg = l.dmg;
    if (l.fx) row.fx = l.fx;
    if (l.crit) row.crit = true;
    if (l.skillId) row.skillId = l.skillId;
    return row;
  });
}

export function stageOpponent(n) {
  const rng = seededRandom("stage-v1-" + n);
  const level = n;
  const budget = 46 + n * 0.8;
  const weights = GAME.stats.map(() => 0.7 + rng() * 0.7);
  const wsum = weights.reduce((a, b) => a + b, 0);
  const stats = {};
  GAME.stats.forEach((s, i) => { stats[s.id] = Math.max(4, Math.round(budget * weights[i] / wsum)); });
  const enemy = STAGE_ENEMIES[(n - 1) % STAGE_ENEMIES.length];
  const sport = GAME.sports[n % GAME.sports.length];
  return {
    name: enemy.name,
    avatar: enemy.avatar,
    sport: sport.id,
    sprite: enemy.sprite || sport.sprite,
    level,
    stats,
    power: powerOf(stats, level),
    stage: n,
  };
}

export function recommendedLevel(hero, opp) {
  const heroStatPower = powerOf(effectiveStats(hero), 0);
  return Math.max(1, Math.round((opp.power - heroStatPower) / 6) + 1);
}

export function estimateWinChance(hero, opp, disc = null, ruleset = "standard") {
  if (ruleset === "ranked" && disc) {
    const samples = 120;
    const rng = seededRandom("ranked-win-chance-v1");
    let wins = 0;
    for (let i = 0; i < samples; i++) {
      if (simulateBattle(hero, opp, disc, rng, "ranked").win) wins++;
    }
    return clamp(Math.round((wins / samples) * 100), 3, 97);
  }

  const hp = heroPower(hero);
  const activeSkills = (hero.loadout || []).filter((id) => {
    const sk = skillMeta(id);
    if (!sk) return false;
    const owned = Array.isArray(hero.ownedSkills) ? hero.ownedSkills : null;
    if (owned && owned.length) return owned.includes(id);
    return hero.level >= sk.req;
  }).length;
  let base = (hp / (hp + opp.power)) * 100 + activeSkills * 4;
  return clamp(Math.round(base), 3, 97);
}

export function currentStage(stagesCleared = []) {
  const cleared = stagesCleared || [];
  let n = 1;
  while (n <= CAMPAIGN_LEVELS && cleared.includes(n)) n++;
  return n;
}

export function stageNodePos(n) {
  const i = clamp(n, 1, CAMPAIGN_LEVELS) - 1;
  const p = STAGE_ROAD[i] || STAGE_ROAD[0];
  return { x: p[0], y: p[1] };
}

export function isMilestoneStage(n) {
  return n === 5 || n === 10 || n === 15 || n === 20;
}
