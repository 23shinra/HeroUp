// Игровые данные прототипа LevelUp.
// Всё, что влияет на баланс, вынесено сюда, чтобы легко настраивать.

export const GAME = {
  // Базовая настройка прокачки
  xpPerTraining: 60,
  trainingWindowMin: 120, // окно (мин), в течение которого можно забрать опыт после начала тренировки
  coinsPerTraining: 25,
  coinsPerWin: 40,
  coinsPerLoss: 12,

  // Виды спорта. У каждого — приоритетные характеристики,
  // которые растут быстрее при отметке тренировки.
  sports: [
    {
      id: "wrestling",
      name: "Борьба",
      icon: "wrestling",
      avatar: "wrestler",
      sprite: "./assets/wrestler.png?v=7",
      winSprite: "./assets/wrestler-win.webp?v=2",
      loseSprite: "./assets/wrestler-lose.webp?v=2",
      trainingSprite: "./assets/wrestler-training.webp?v=4",
      trainingSheet: "./assets/wrestler-punch-sheet.webp?v=2",
      trainingFrames: 7,
      trainingDurationMs: 680,
      battleAttacks: [
        "./assets/battle/wrestling-attack1.webp?v=2",
        "./assets/battle/wrestling-attack2.webp?v=2",
      ],
      battleFrames: 7,
      primary: ["str", "end"],
    },
    {
      id: "boxing",
      name: "Бокс",
      icon: "boxing",
      avatar: "boxer",
      sprite: "./assets/boxer.png?v=7",
      winSprite: "./assets/boxer-win.webp?v=2",
      loseSprite: "./assets/boxer-lose.webp?v=2",
      trainingSprite: "./assets/boxer-training.webp?v=4",
      trainingSheet: "./assets/boxer-punch-sheet.webp?v=2",
      trainingFrames: 7,
      trainingDurationMs: 680,
      battleAttacks: [
        "./assets/battle/boxing-attack1.webp?v=2",
        "./assets/battle/boxing-attack2.webp?v=2",
      ],
      battleFrames: 7,
      primary: ["str", "spd"],
    },
    {
      id: "robotics",
      name: "Робототехника",
      icon: "robotics",
      avatar: "roboticist",
      sprite: "./assets/roboticist.png?v=3",
      winSprite: "./assets/roboticist-win.webp?v=3",
      loseSprite: "./assets/roboticist-lose.webp?v=3",
      trainingSprite: "./assets/roboticist-training.webp?v=3",
      battleAttacks: [
        "./assets/battle/robotics-attack1.webp?v=2",
        "./assets/battle/robotics-attack2.webp?v=2",
      ],
      battleFrames: 7,
      primary: ["int", "team"],
    },
  ],

  // Характеристики
  stats: [
    { id: "str", name: "Сила", icon: "strength", color: "#FF7A00" },
    { id: "spd", name: "Скорость", icon: "speed", color: "#2E5EFF" },
    { id: "end", name: "Выносливость", icon: "endurance", color: "#3DD16F" },
    { id: "int", name: "Интеллект", icon: "intellect", color: "#8B5CF6" },
    { id: "team", name: "Командная работа", icon: "team", color: "#FFC93C" },
  ],

  // Классы открываются на 5 уровне. Дают бонус характеристике и суперспособность.
  classes: [
    { id: "athlete", name: "Атлет", icon: "dumbbell", stat: "str", bonus: 8, power: "Богатырский удар (+15% к силе в бою)", mult: { str: 1.15 } },
    { id: "sprinter", name: "Спринтер", icon: "run", stat: "spd", bonus: 8, power: "Рывок (первый ход всегда ваш)", mult: { spd: 1.15 } },
    { id: "guardian", name: "Страж", icon: "endurance", stat: "end", bonus: 8, power: "Несокрушимость (+15% выносливости)", mult: { end: 1.15 } },
    { id: "strategist", name: "Стратег", icon: "crosshair", stat: "int", bonus: 8, power: "Точный расчёт (+15% интеллекта)", mult: { int: 1.15 } },
    { id: "captain", name: "Капитан", icon: "badge", stat: "team", bonus: 8, power: "Дух команды (+15% ко всем в клане)", mult: { team: 1.15 } },
  ],

  // Супер-скиллы секций. Открываются по 1 каждые 5 уровней.
  // В бой можно взять только 3. effect читается боевой симуляцией.
  sportSkills: {
    wrestling: [
      { id: "grip",        name: "Мёртвый захват", icon: "endurance", req: 5,  desc: "Снижает урон соперника на 15%.",           effect: { dmgReduction: 0.15 }, battleSheet: "./assets/battle/grip.webp?v=2" },
      { id: "throw",       name: "Бросок прогибом", icon: "combo",     req: 10, desc: "25% шанс броска: удвоенный урон.",          effect: { comboChance: 0.25 }, battleSheet: "./assets/battle/throw.webp?v=2" },
      { id: "bridge",      name: "Борцовский мост", icon: "wall",      req: 15, desc: "+25% к запасу здоровья.",                   effect: { hpBonus: 0.25 }, battleSheet: "./assets/battle/bridge.webp?v=2" },
      { id: "takedown",    name: "Подсечка",        icon: "wind",      req: 20, desc: "20% шанс, что соперник пропустит удар.",    effect: { stunChance: 0.20 }, battleSheet: "./assets/battle/takedown.webp?v=2" },
      { id: "suplex",      name: "Коронный суплекс",icon: "sparkles",  req: 25, desc: "Раз в бой сокрушительный приём (×2.6).",   effect: { ultimate: 2.6 }, battleSheet: "./assets/battle/suplex.webp?v=2" },
    ],
    boxing: [
      { id: "jab",         name: "Двойной джеб",    icon: "combo",     req: 5,  desc: "22% шанс на двойной удар.",                effect: { comboChance: 0.22 }, battleSheet: "./assets/battle/jab.webp?v=2" },
      { id: "hook",        name: "Хук с разворота", icon: "strength",  req: 10, desc: "Критические удары бьют сильнее (×2.3).",   effect: { critMult: 2.3 }, battleSheet: "./assets/battle/hook.webp?v=2" },
      { id: "uppercut",    name: "Апперкот",        icon: "bolt",      req: 15, desc: "Первый удар в бою усилен на +60%.",        effect: { firstStrike: 1.6 }, battleSheet: "./assets/battle/uppercut.webp?v=2" },
      { id: "footwork",    name: "Работа ног",      icon: "speed",     req: 20, desc: "20% шанс уклониться от удара.",            effect: { dodgeChance: 0.20 }, battleSheet: "./assets/battle/footwork.webp?v=2" },
      { id: "knockout",    name: "Нокаутирующий",   icon: "flame",     req: 25, desc: "Раз в бой нокаутирующий удар (×2.7).",     effect: { ultimate: 2.7 }, battleSheet: "./assets/battle/knockout.webp?v=2" },
    ],
    robotics: [
      { id: "servo",       name: "Сервопривод",     icon: "combo",     req: 5,  desc: "23% шанс серво-комбо: удвоенный удар.",     effect: { comboChance: 0.23 }, battleSheet: "./assets/battle/servo.webp?v=2" },
      { id: "armor_plate", name: "Бронеплиты",      icon: "wall",      req: 10, desc: "Снижает урон соперника на 16%.",           effect: { dmgReduction: 0.16 }, battleSheet: "./assets/battle/armor_plate.webp?v=2" },
      { id: "autosight",   name: "Автоприцел",      icon: "crosshair", req: 15, desc: "Критические удары бьют сильнее (×2.4).",   effect: { critMult: 2.4 }, battleSheet: "./assets/battle/autosight.webp?v=2" },
      { id: "stabilizer",  name: "Стабилизаторы",   icon: "wind",      req: 20, desc: "20% шанс уклониться от удара.",            effect: { dodgeChance: 0.20 }, battleSheet: "./assets/battle/stabilizer.webp?v=2" },
      { id: "overload",    name: "Перегрузка",      icon: "bolt",      req: 25, desc: "Раз в бой перегрузка систем (×2.7).",      effect: { ultimate: 2.7 }, battleSheet: "./assets/battle/overload.webp?v=2" },
    ],
  },

  // Дерево навыков (устар.). req — уровень.
  abilities: [
    { id: "warmup", name: "Разминка", icon: "flame", req: 2, desc: "+5% к получаемому опыту." },
    { id: "focus", name: "Концентрация", icon: "target", req: 3, desc: "+3 к интеллекту." },
    { id: "second_wind", name: "Второе дыхание", icon: "wind", req: 4, desc: "+4 к выносливости." },
    { id: "combo", name: "Комбо-удар", icon: "combo", req: 6, desc: "Шанс двойного урона в бою." },
    { id: "leader", name: "Лидерство", icon: "megaphone", req: 7, desc: "+4 к командной работе." },
    { id: "iron_will", name: "Железная воля", icon: "wall", req: 9, desc: "Не проигрывает при равных силах." },
    { id: "ultimate", name: "Ультимейт", icon: "sparkles", req: 12, desc: "Раз в бой мощный супер-удар." },
  ],

  // Ежедневные задания
  questPool: [
    { id: "checkin", name: "Отметить тренировку", target: 1, type: "training", reward: 30, icon: "check" },
    { id: "battle1", name: "Провести 1 бой", target: 1, type: "battle", reward: 25, icon: "swords" },
    { id: "win1", name: "Победить в бою", target: 1, type: "win", reward: 40, icon: "trophy" },
    { id: "train2", name: "2 тренировки за день", target: 2, type: "training", reward: 60, icon: "flame" },
    { id: "battle2", name: "Провести 2 боя", target: 2, type: "battle", reward: 45, icon: "swords" },
  ],

  // Магазин косметики. НЕ влияет на бой — только внешний вид.
  // Всё покупается за монеты, которые зарабатываются тренировками и боями.
  shop: [
    { id: "fx_stars", name: "Эффект «Звёзды»", icon: "sparkles", color: "#FFC93C", type: "fx", price: 120 },
    { id: "fx_lightning", name: "Эффект «Молнии»", icon: "bolt", color: "#2E5EFF", type: "fx", price: 120 },
    { id: "fx_fire", name: "Эффект «Огонь»", icon: "flame", color: "#FF7A00", type: "fx", price: 160 },
    { id: "fx_ice", name: "Эффект «Иней»", icon: "wind", color: "#22D3EE", type: "fx", price: 160 },
  ],

  // Стадии эволюции питомца по числу тренировок (для уже экипированных).
  petStages: [
    { min: 0, label: "Малыш", scale: 1.0 },
    { min: 10, label: "Подросток", scale: 1.18 },
    { min: 30, label: "Взрослый", scale: 1.35 },
    { min: 60, label: "Легендарный", scale: 1.5 },
  ],

  // Бесплатный сезонный путь наград. Очки сезона копятся за тренировки и победы.
  season: {
    id: "s1",
    name: "Сезон 1: Старт",
    // pointsPerTraining/pointsPerWin — сколько очков сезона даётся за действие
    pointsPerTraining: 2,
    pointsPerWin: 1,
    tiers: [
      { need: 2, reward: { coins: 30 } },
      { need: 5, reward: { coins: 50 } },
      { need: 9, reward: { item: "fx_fire" } },
      { need: 14, reward: { coins: 90 } },
      { need: 20, reward: { item: "fx_ice" } },
      { need: 28, reward: { coins: 160 } },
      { need: 38, reward: { item: "fx_lightning" } },
    ],
  },

  // Тематические события с множителем опыта (по датам YYYY-MM-DD включительно).
  events: [
    // { id: "box_week", name: "Неделя бокса", from: "2026-07-10", to: "2026-07-14", xpMult: 2, icon: "boxing" },
  ],
  // Постоянный бонус выходного дня (сб/вс) — двойной опыт за тренировку.
  weekendBonus: { xpMult: 2, name: "Выходные: двойной опыт", icon: "sparkles" },

  streakRewards: [
    { days: 3, coins: 30, name: "На волне" },
    { days: 7, coins: 80, name: "Несгибаемый" },
    { days: 14, coins: 180, name: "Железная дисциплина" },
    { days: 30, coins: 400, name: "Легенда дисциплины" },
  ],

  // Кланы = спортивные секции
  // Достижения. metric сверяется со стейтом, за выполнение — опыт (xp).
  achievements: [
    { id: "first_train", name: "Первые шаги", icon: "dumbbell", desc: "Отметь первую тренировку", metric: "trainings", goal: 1, xp: 40 },
    { id: "week_train", name: "Неделя в строю", icon: "calendar", desc: "Всего 7 тренировок", metric: "trainings", goal: 7, xp: 120 },
    { id: "train30", name: "Железная дисциплина", icon: "strength", desc: "Всего 30 тренировок", metric: "trainings", goal: 30, xp: 300 },
    { id: "first_win", name: "Первая победа", icon: "swords", desc: "Выиграй бой на арене", metric: "wins", goal: 1, xp: 60 },
    { id: "win10", name: "Боец арены", icon: "trophy", desc: "Одержи 10 побед", metric: "wins", goal: 10, xp: 220 },
    { id: "lvl5", name: "Новичок вырос", icon: "star", desc: "Достигни 5 уровня", metric: "level", goal: 5, xp: 100 },
    { id: "lvl10", name: "Ветеран", icon: "crown", desc: "Достигни 10 уровня", metric: "level", goal: 10, xp: 260 },
  ],

  clans: [
    { id: "tigers", name: "Тигры", icon: "paw", color: "#FF7A00", members: 128, sport: "Единоборства" },
    { id: "sharks", name: "Акулы", icon: "fish", color: "#2E5EFF", members: 96, sport: "Плавание" },
    { id: "eagles", name: "Орлы", icon: "bird", color: "#FFC93C", members: 154, sport: "Футбол" },
    { id: "dragons", name: "Драконы", icon: "dragon", color: "#3DD16F", members: 73, sport: "Гимнастика" },
  ],

  // Лиги сезона (по Эло-очкам сверх базы 1000)
  leagues: [
    { name: "Бронза", min: 0, icon: "elo", color: "#CD7F32" },
    { name: "Серебро", min: 5, icon: "elo", color: "#C0C0C0" },
    { name: "Золото", min: 12, icon: "elo", color: "#FFC93C" },
    { name: "Платина", min: 22, icon: "elo", color: "#22D3EE" },
    { name: "Легенда", min: 35, icon: "elo", color: "#FF5500" },
  ],

  // Имена ботов-соперников для PvP
  botNames: ["Макс", "Лея", "Ник", "Соня", "Гоша", "Кира", "Тим", "Даша", "Рома", "Аня", "Лев", "Ева"],
  botAvatars: ["robot", "skull", "alien", "ninja", "wolf", "dragon"],
};

/** XP, необходимый для достижения следующего уровня. */
export function xpToNext(level) {
  return 100 + (level - 1) * 60;
}

export const STAT_POINTS_PER_LEVEL = 5;
export const CAMPAIGN_LEVELS = 20;
export const CLASS_FEATURE_ENABLED = false;
