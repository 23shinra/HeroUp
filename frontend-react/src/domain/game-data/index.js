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
      sprite: "./assets/wrestler.png?v=8",
      winSprite: "./assets/wrestler-win.webp?v=3",
      loseSprite: "./assets/wrestler-lose.webp?v=3",
      trainingSprite: "./assets/wrestler-training.webp?v=5",
      trainingSheet: "./assets/wrestler-throw-sheet.webp?v=1",
      trainingFrames: 7,
      trainingDurationMs: 1300,
      battleAttacks: [
        "./assets/battle/wrestling-attack1.webp?v=3",
        "./assets/battle/wrestling-attack2.webp?v=3",
      ],
      battleFrames: 7,
      primary: ["str", "end"],
    },
    {
      id: "boxing",
      name: "Бокс",
      icon: "boxing",
      avatar: "boxer",
      sprite: "./assets/boxer.png?v=9",
      winSprite: "./assets/boxer-win.webp?v=4",
      loseSprite: "./assets/boxer-lose.webp?v=4",
      trainingSprite: "./assets/boxer-training.webp?v=7",
      trainingSheet: "./assets/boxer-punch-sheet.webp?v=7",
      trainingFrames: 7,
      trainingDurationMs: 920,
      battleAttacks: [
        "./assets/battle/boxing-attack1.webp?v=4",
        "./assets/battle/boxing-attack2.webp?v=4",
      ],
      battleFrames: 7,
      primary: ["str", "spd"],
    },
    {
      id: "robotics",
      name: "Робототехника",
      icon: "robotics",
      avatar: "roboticist",
      sprite: "./assets/roboticist.png?v=4",
      winSprite: "./assets/roboticist-win.webp?v=4",
      loseSprite: "./assets/roboticist-lose.webp?v=4",
      trainingSprite: "./assets/roboticist-training.webp?v=4",
      trainingSheet: "./assets/roboticist-training-sheet.webp?v=1",
      trainingFrames: 7,
      trainingDurationMs: 1400,
      battleAttacks: [
        "./assets/battle/robotics-attack1.webp?v=4",
        "./assets/battle/robotics-attack2.webp?v=4",
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

  // Супер-скиллы секций.
  // Без box — открываются по уровню (каждые 5 ур.).
  // box: true — только из бокса токенов, не за уровень.
  // В бой можно взять только 3. effect читается боевой симуляцией.
  // rarity: common|uncommon|rare|epic|legendary — цвет и шанс в боксе.
  sportSkills: {
    wrestling: [
      { id: "grip",        name: "Мёртвый захват", icon: "endurance", req: 5,  rarity: "common",    desc: "Снижает урон соперника на 15%.",           effect: { dmgReduction: 0.15 }, battleSheet: "./assets/battle/grip.webp?v=3" },
      { id: "throw",       name: "Бросок прогибом", icon: "combo",     req: 10, rarity: "uncommon",  desc: "25% шанс броска: удвоенный урон.",          effect: { comboChance: 0.25 }, battleSheet: "./assets/battle/throw.webp?v=3" },
      { id: "bridge",      name: "Борцовский мост", icon: "wall",      req: 15, rarity: "rare",      desc: "+25% к запасу здоровья.",                   effect: { hpBonus: 0.25 }, battleSheet: "./assets/battle/bridge.webp?v=3" },
      { id: "takedown",    name: "Подсечка",        icon: "wind",      req: 20, rarity: "epic",      desc: "20% шанс, что соперник пропустит удар.",    effect: { stunChance: 0.20 }, battleSheet: "./assets/battle/takedown.webp?v=3" },
      { id: "suplex",      name: "Коронный суплекс",icon: "sparkles",  req: 25, rarity: "legendary", desc: "Раз в бой сокрушительный приём (×2.6).",   effect: { ultimate: 2.6 }, battleSheet: "./assets/battle/suplex.webp?v=3" },
      { id: "clinch",      name: "Клинч",           icon: "wall",      box: true, rarity: "common",    desc: "Снижает урон соперника на 10%.",           effect: { dmgReduction: 0.10 }, battleSheet: "./assets/battle/grip.webp?v=3" },
      { id: "sprawl",      name: "Спроул",          icon: "wind",      box: true, rarity: "common",    desc: "11% шанс уклониться от удара.",            effect: { dodgeChance: 0.11 }, battleSheet: "./assets/battle/takedown.webp?v=3" },
      { id: "wrist_lock",  name: "Залом кисти",     icon: "target",    box: true, rarity: "common",    desc: "10% шанс оглушить соперника.",             effect: { stunChance: 0.10 }, battleSheet: "./assets/battle/grip.webp?v=3" },
      { id: "hip_toss",    name: "Через бедро",     icon: "combo",     box: true, rarity: "uncommon",  desc: "18% шанс комбо-броска.",                    effect: { comboChance: 0.18 }, battleSheet: "./assets/battle/throw.webp?v=3" },
      { id: "ankle_pick",  name: "Зацепом за ногу", icon: "speed",     box: true, rarity: "uncommon",  desc: "16% шанс комбо-броска.",                    effect: { comboChance: 0.16 }, battleSheet: "./assets/battle/throw.webp?v=3" },
      { id: "iron_neck",   name: "Железная шея",    icon: "endurance", box: true, rarity: "uncommon",  desc: "+15% к запасу здоровья.",                   effect: { hpBonus: 0.15 }, battleSheet: "./assets/battle/bridge.webp?v=3" },
      { id: "cradle",      name: "Колыбель",        icon: "wall",      box: true, rarity: "rare",      desc: "17% шанс оглушить соперника.",             effect: { stunChance: 0.17 }, battleSheet: "./assets/battle/takedown.webp?v=3" },
      { id: "gut_wrench",  name: "Скрутка корпуса", icon: "strength",  box: true, rarity: "rare",      desc: "Снижает урон соперника на 13%.",           effect: { dmgReduction: 0.13 }, battleSheet: "./assets/battle/grip.webp?v=3" },
      { id: "firemans",    name: "Мельница",        icon: "wind",      box: true, rarity: "epic",      desc: "22% шанс оглушить соперника.",             effect: { stunChance: 0.22 }, battleSheet: "./assets/battle/takedown.webp?v=3" },
      { id: "amplitude",   name: "Амплитуда",       icon: "combo",     box: true, rarity: "epic",      desc: "Критические броски сильнее (×2.45).",      effect: { critMult: 2.45 }, battleSheet: "./assets/battle/suplex.webp?v=3" },
      { id: "olympic_throw", name: "Олимпийский бросок", icon: "flame", box: true, rarity: "legendary", desc: "Раз в бой бросок чемпиона (×2.8).",     effect: { ultimate: 2.8 }, battleSheet: "./assets/battle/suplex.webp?v=3" },
      { id: "god_suplex",  name: "Божественный суплекс", icon: "sparkles", box: true, rarity: "legendary", desc: "Раз в бой легендарный суплекс (×3.0).", effect: { ultimate: 3.0 }, battleSheet: "./assets/battle/suplex.webp?v=3" },
    ],
    boxing: [
      { id: "jab",         name: "Двойной джеб",    icon: "combo",     req: 5,  rarity: "common",    desc: "22% шанс на двойной удар.",                effect: { comboChance: 0.22 }, battleSheet: "./assets/battle/jab.webp?v=4" },
      { id: "hook",        name: "Хук с разворота", icon: "strength",  req: 10, rarity: "uncommon",  desc: "Критические удары бьют сильнее (×2.3).",   effect: { critMult: 2.3 }, battleSheet: "./assets/battle/hook.webp?v=4" },
      { id: "uppercut",    name: "Апперкот",        icon: "bolt",      req: 15, rarity: "rare",      desc: "Первый удар в бою усилен на +60%.",        effect: { firstStrike: 1.6 }, battleSheet: "./assets/battle/uppercut.webp?v=4" },
      { id: "footwork",    name: "Работа ног",      icon: "speed",     req: 20, rarity: "epic",      desc: "20% шанс уклониться от удара.",            effect: { dodgeChance: 0.20 }, battleSheet: "./assets/battle/footwork.webp?v=4" },
      { id: "knockout",    name: "Нокаутирующий",   icon: "flame",     req: 25, rarity: "legendary", desc: "Раз в бой нокаутирующий удар (×2.7).",     effect: { ultimate: 2.7 }, battleSheet: "./assets/battle/knockout.webp?v=4" },
      { id: "slip",        name: "Уклон",           icon: "wind",      box: true, rarity: "common",    desc: "12% шанс уклониться от удара.",            effect: { dodgeChance: 0.12 }, battleSheet: "./assets/battle/footwork.webp?v=4" },
      { id: "feint",       name: "Финт",            icon: "combo",     box: true, rarity: "common",    desc: "14% шанс на двойной удар.",                effect: { comboChance: 0.14 }, battleSheet: "./assets/battle/jab.webp?v=4" },
      { id: "parry",       name: "Парирование",     icon: "wall",      box: true, rarity: "common",    desc: "Снижает урон соперника на 9%.",            effect: { dmgReduction: 0.09 }, battleSheet: "./assets/battle/peak_a_boo.webp?v=2" },
      { id: "body_shot",   name: "Удар в корпус",   icon: "strength",  box: true, rarity: "uncommon",  desc: "Критические удары бьют сильнее (×2.1).",   effect: { critMult: 2.1 }, battleSheet: "./assets/battle/hook.webp?v=4" },
      { id: "weave",       name: "Нырок",           icon: "speed",     box: true, rarity: "uncommon",  desc: "15% шанс уклониться от удара.",            effect: { dodgeChance: 0.15 }, battleSheet: "./assets/battle/footwork.webp?v=4" },
      { id: "peak_a_boo",  name: "Пик-а-бу",        icon: "wall",      box: true, rarity: "uncommon",  desc: "Снижает урон соперника на 12%.",           effect: { dmgReduction: 0.12 }, battleSheet: "./assets/battle/peak_a_boo.webp?v=2" },
      { id: "liver_shot",  name: "В печень",        icon: "bolt",      box: true, rarity: "rare",      desc: "16% шанс оглушить соперника.",             effect: { stunChance: 0.16 }, battleSheet: "./assets/battle/hook.webp?v=4" },
      { id: "one_two",     name: "Раз-два",         icon: "combo",     box: true, rarity: "rare",      desc: "Первый удар в бою усилен на +40%.",        effect: { firstStrike: 1.4 }, battleSheet: "./assets/battle/jab.webp?v=4" },
      { id: "rope_a_dope", name: "Верёвочный трюк", icon: "speed",     box: true, rarity: "epic",      desc: "24% шанс уклониться от удара.",            effect: { dodgeChance: 0.24 }, battleSheet: "./assets/battle/footwork.webp?v=4" },
      { id: "check_hook",  name: "Чек-хук",         icon: "strength",  box: true, rarity: "epic",      desc: "Критические удары бьют сильнее (×2.4).",   effect: { critMult: 2.4 }, battleSheet: "./assets/battle/hook.webp?v=4" },
      { id: "haymaker",    name: "Коронный хук",    icon: "flame",     box: true, rarity: "legendary", desc: "Раз в бой сокрушительный хук (×2.9).",    effect: { ultimate: 2.9 }, battleSheet: "./assets/battle/knockout.webp?v=4" },
      { id: "phantom",     name: "Фантомный удар",  icon: "sparkles",  box: true, rarity: "legendary", desc: "Раз в бой неуловимый удар (×3.1).",       effect: { ultimate: 3.1 }, battleSheet: "./assets/battle/knockout.webp?v=4" },
    ],
    robotics: [
      { id: "servo",       name: "Сервопривод",     icon: "combo",     req: 5,  rarity: "common",    desc: "23% шанс серво-комбо: удвоенный удар.",     effect: { comboChance: 0.23 }, battleSheet: "./assets/battle/servo.webp?v=4" },
      { id: "armor_plate", name: "Бронеплиты",      icon: "wall",      req: 10, rarity: "uncommon",  desc: "Снижает урон соперника на 16%.",           effect: { dmgReduction: 0.16 }, battleSheet: "./assets/battle/armor_plate.webp?v=4" },
      { id: "autosight",   name: "Автоприцел",      icon: "crosshair", req: 15, rarity: "rare",      desc: "Критические удары бьют сильнее (×2.4).",   effect: { critMult: 2.4 }, battleSheet: "./assets/battle/autosight.webp?v=4" },
      { id: "stabilizer",  name: "Стабилизаторы",   icon: "wind",      req: 20, rarity: "epic",      desc: "20% шанс уклониться от удара.",            effect: { dodgeChance: 0.20 }, battleSheet: "./assets/battle/stabilizer.webp?v=4" },
      { id: "overload",    name: "Перегрузка",      icon: "bolt",      req: 25, rarity: "legendary", desc: "Раз в бой перегрузка систем (×2.7).",      effect: { ultimate: 2.7 }, battleSheet: "./assets/battle/overload.webp?v=4" },
      { id: "coolant",     name: "Охлаждение",      icon: "endurance", box: true, rarity: "common",    desc: "+12% к запасу здоровья.",                   effect: { hpBonus: 0.12 }, battleSheet: "./assets/battle/coolant.webp?v=2" },
      { id: "microburst",  name: "Микровсплеск",    icon: "combo",     box: true, rarity: "common",    desc: "13% шанс серво-комбо.",                     effect: { comboChance: 0.13 }, battleSheet: "./assets/battle/servo.webp?v=4" },
      { id: "foil_skin",   name: "Фольгощит",       icon: "wall",      box: true, rarity: "common",    desc: "Снижает урон соперника на 8%.",            effect: { dmgReduction: 0.08 }, battleSheet: "./assets/battle/armor_plate.webp?v=4" },
      { id: "pulse_lock",  name: "Импульс-лок",     icon: "target",    box: true, rarity: "uncommon",  desc: "15% шанс оглушить соперника.",             effect: { stunChance: 0.15 }, battleSheet: "./assets/battle/pulse_lock.webp?v=2" },
      { id: "gyro",        name: "Гироскоп",        icon: "wind",      box: true, rarity: "uncommon",  desc: "14% шанс уклониться от удара.",            effect: { dodgeChance: 0.14 }, battleSheet: "./assets/battle/stabilizer.webp?v=4" },
      { id: "nanoshield",  name: "Нанощит",         icon: "wall",      box: true, rarity: "uncommon",  desc: "Снижает урон соперника на 14%.",           effect: { dmgReduction: 0.14 }, battleSheet: "./assets/battle/armor_plate.webp?v=4" },
      { id: "laser_grid",  name: "Лазерная сетка",  icon: "crosshair", box: true, rarity: "rare",      desc: "Критические удары бьют сильнее (×2.25).",  effect: { critMult: 2.25 }, battleSheet: "./assets/battle/autosight.webp?v=4" },
      { id: "emp_burst",   name: "ЭМИ-импульс",     icon: "bolt",      box: true, rarity: "rare",      desc: "16% шанс оглушить соперника.",             effect: { stunChance: 0.16 }, battleSheet: "./assets/battle/pulse_lock.webp?v=2" },
      { id: "drone_swarm", name: "Рой дронов",      icon: "crosshair", box: true, rarity: "epic",      desc: "Критические удары бьют сильнее (×2.5).",   effect: { critMult: 2.5 }, battleSheet: "./assets/battle/autosight.webp?v=4" },
      { id: "plasma_edge", name: "Плазменный край", icon: "flame",     box: true, rarity: "epic",      desc: "Первый удар усилен на +55%.",              effect: { firstStrike: 1.55 }, battleSheet: "./assets/battle/overload.webp?v=4" },
      { id: "singularity", name: "Сингулярность",   icon: "sparkles",  box: true, rarity: "legendary", desc: "Раз в бой коллапс систем (×2.9).",         effect: { ultimate: 2.9 }, battleSheet: "./assets/battle/overload.webp?v=4" },
      { id: "zero_day",    name: "Zero-Day",        icon: "target",    box: true, rarity: "legendary", desc: "Раз в бой критический взлом (×3.1).",     effect: { ultimate: 3.1 }, battleSheet: "./assets/battle/overload.webp?v=4" },
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
