// Pure functions — no Firebase, no DOM dependencies
// Used by app modules and unit tests

// ─── УРОВНИ НАВЫКОВ ──────────────────────────────────────────────────────────
// Поле 'hours' используется для навыков типа minutes/seconds (порог в часах).
// Поле 'reps'  используется для навыков типа reps.

var TREE_LEVELS = [
  { level: 0, name: 'Спящее семя',      hours: 0,     desc: 'Пора проснуться' },
  { level: 1, name: 'Семя',             hours: 10,    desc: 'Зерно посажено' },
  { level: 2, name: 'Росток',           hours: 30,    desc: 'Пробился сквозь землю' },
  { level: 3, name: 'Саженец',          hours: 60,    desc: 'Корни уходят вглубь' },
  { level: 4, name: 'Молодое дерево',   hours: 100,   desc: 'Ствол окреп, ветви расправились' },
  { level: 5, name: 'Дерево',           hours: 300,   desc: 'Регулярная практика' },
  { level: 6, name: 'Зрелое дерево',    hours: 600,   desc: 'Корни в подземных водах' },
  { level: 7, name: 'Священное дерево', hours: 1000,  desc: 'Птицы сами прилетают' },
  { level: 8, name: 'Мировое дерево',   hours: 5000,  desc: 'Ветви касаются неба' },
  { level: 9, name: 'Иггдрасиль',       hours: 10000, desc: 'Соединяешь миры' },
];

var MOUNTAIN_LEVELS = [
  { level: 0, name: 'Без корня',            hours: 0,     desc: 'Ноги еще не знают стойки' },
  { level: 1, name: 'Первый корешок',       hours: 10,    desc: 'Первые часы под нагрузкой' },
  { level: 2, name: 'Корни в земле',        hours: 30,    desc: 'Закалка продолжается' },
  { level: 3, name: 'Корни твердеют',       hours: 60,    desc: 'Стойка начинает держать' },
  { level: 4, name: 'Укоренение',           hours: 100,   desc: 'Напряжение ушло' },
  { level: 5, name: 'Корни взывают к горе', hours: 300,   desc: 'Твердость в ногах' },
  { level: 6, name: 'Гора услышала',        hours: 600,   desc: 'Легкость и твердость слились' },
  { level: 7, name: 'Гора признала тебя',   hours: 1000,  desc: 'Ноги превращаются в опору' },
  { level: 8, name: 'Срастись со склоном',  hours: 5000,  desc: 'Ничто не сдвинет с места' },
  { level: 9, name: 'Стать горой',          hours: 10000, desc: 'Ты и есть гора' },
];

var PUSHUP_LEVELS = [
  { level: 0, name: 'Ватные руки',      reps: 0,       desc: 'Руки еще не знают отжиманий' },
  { level: 1, name: 'Деревянные руки',  reps: 100,     desc: 'Первые повторения' },
  { level: 2, name: 'Каменные руки',    reps: 500,     desc: 'Руки начинают твердеть' },
  { level: 3, name: 'Бронзовые руки',   reps: 1000,    desc: 'Закалка идет полным ходом' },
  { level: 4, name: 'Железные руки',    reps: 5000,    desc: 'Руки превращаются в оружие' },
  { level: 5, name: 'Стальные руки',    reps: 10000,   desc: 'Ничто не сломит' },
  { level: 6, name: 'Мифриловые руки',  reps: 50000,   desc: 'Легкость и мощь слились' },
  { level: 7, name: 'Алмазные руки',    reps: 100000,  desc: 'Тверже любого металла' },
  { level: 8, name: 'Адамантовые руки', reps: 500000,  desc: 'За пределами человеческого' },
  { level: 9, name: 'Руки титана',      reps: 1000000, desc: 'Легенда' },
];

var TITAN_LEGS_LEVELS = [
  { level: 0, name: 'Ватные ноги',      reps: 0,       desc: 'Ноги еще не знают приседаний' },
  { level: 1, name: 'Деревянные ноги',  reps: 100,     desc: 'Первые повторения' },
  { level: 2, name: 'Каменные ноги',    reps: 500,     desc: 'Ноги начинают твердеть' },
  { level: 3, name: 'Бронзовые ноги',   reps: 1000,    desc: 'Закалка идет полным ходом' },
  { level: 4, name: 'Железные ноги',    reps: 5000,    desc: 'Ноги становятся опорой' },
  { level: 5, name: 'Стальные ноги',    reps: 10000,   desc: 'Ничто не сдвинет' },
  { level: 6, name: 'Мифриловые ноги',  reps: 50000,   desc: 'Легкость и мощь слились' },
  { level: 7, name: 'Алмазные ноги',    reps: 100000,  desc: 'Тверже любого металла' },
  { level: 8, name: 'Адамантовые ноги', reps: 500000,  desc: 'За пределами человеческого' },
  { level: 9, name: 'Ноги титана',      reps: 1000000, desc: 'Легенда' },
];

var PULLUP_LEVELS = [
  { level: 0, name: 'Прикован к земле',      reps: 0,      desc: 'Земля не отпускает' },
  { level: 1, name: 'Первый шаг',            reps: 50,     desc: 'Начало пути вверх' },
  { level: 2, name: 'Подножие горы',         reps: 200,    desc: 'Путь только начинается' },
  { level: 3, name: 'Середина склона',       reps: 500,    desc: 'Полпути позади' },
  { level: 4, name: 'Вершина горы',          reps: 2000,   desc: 'Земля осталась внизу' },
  { level: 5, name: 'Выше горизонта',        reps: 5000,   desc: 'Видно край земли' },
  { level: 6, name: 'Между мирами',          reps: 20000,  desc: 'Ни земля, ни небо' },
  { level: 7, name: 'Парить в облаках',      reps: 50000,  desc: 'Облака под ногами' },
  { level: 8, name: 'Прикоснуться к звезде', reps: 200000, desc: 'Рука дотянулась до света' },
  { level: 9, name: 'Девятое небо',          reps: 500000, desc: 'Высшая из высот' },
];

var FORMS_LEVELS = [
  { level: 0, name: 'Незнакомец',      reps: 0,      desc: 'Форма еще не знает тебя' },
  { level: 1, name: 'Ученик',          reps: 100,    desc: 'Первые шаги по пути' },
  { level: 2, name: 'Практикующий',    reps: 500,    desc: 'Тело начинает запоминать' },
  { level: 3, name: 'Последователь',   reps: 1000,   desc: 'Форма входит в привычку' },
  { level: 4, name: 'Боец',            reps: 3000,   desc: 'Движения становятся точнее' },
  { level: 5, name: 'Воин',            reps: 6000,   desc: 'Форма течет без усилий' },
  { level: 6, name: 'Мастер форм',     reps: 10000,  desc: 'Тело и форма — одно' },
  { level: 7, name: 'Страж традиции',  reps: 25000,  desc: 'Передаешь через движение' },
  { level: 8, name: 'Хранитель пути',  reps: 50000,  desc: 'Форма живет в тебе' },
  { level: 9, name: 'Живая форма',     reps: 100000, desc: 'Ты и есть форма' },
];

var LOTUS_LEVELS = [
  { level: 0, name: 'Беспокойный ум',       hours: 0,     desc: 'Мысли кружатся, как листья на ветру' },
  { level: 1, name: 'Первый вдох',           hours: 10,    desc: 'Тело начинает успокаиваться' },
  { level: 2, name: 'Тихая вода',            hours: 30,    desc: 'Рябь уходит с поверхности' },
  { level: 3, name: 'Ясное озеро',           hours: 60,    desc: 'Вода не спешит' },
  { level: 4, name: 'Глубина',               hours: 100,   desc: 'Свет проходит насквозь' },
  { level: 5, name: 'Семя на дне',           hours: 300,   desc: 'Ничто не тревожит' },
  { level: 6, name: 'Росток тянется к небу', hours: 600,   desc: 'Мысли проходят, как облака' },
  { level: 7, name: 'Бутон над водой',       hours: 1000,  desc: 'Отражает все, не удерживая ничего' },
  { level: 8, name: 'Лепестки встрепенулись',hours: 5000,  desc: 'Тишина вокруг' },
  { level: 9, name: 'Лотос раскрылся',       hours: 10000, desc: 'Пробуждение ото сна' },
];


var DUMMY1_LEVELS = [
  { level: 0, name: 'Незнакомец',        reps: 0,     desc: 'Стоит и молчит' },
  { level: 1, name: 'Первый стук',       reps: 50,    desc: 'Три руки и нога' },
  { level: 2, name: 'Синяки и шишки',    reps: 200,   desc: 'Тело помнит каждый удар' },
  { level: 3, name: 'Нахожу углы',       reps: 500,   desc: 'Обходишь, а не давишь' },
  { level: 4, name: 'Слышу ритм',        reps: 1000,  desc: 'Форма начинает дышать' },
  { level: 5, name: 'Уступаю и веду',    reps: 3000,  desc: 'Мягкость сильнее силы' },
  { level: 6, name: 'Танец по кругу',    reps: 6000,  desc: 'Движение стало потоком' },
  { level: 7, name: 'Манекен раскрылся', reps: 10000, desc: 'Знаешь каждую руку' },
  { level: 8, name: 'Молчаливый брат',   reps: 25000, desc: 'Манекен — продолжение тебя' },
  { level: 9, name: 'Одно целое',        reps: 50000, desc: 'Нет тебя, нет манекена' },
];


// Ши Сан Сы: слова уровней — как у форм (slt/ck), пороги — как у манекена.
var SHISANSI_LEVELS = [
  { level: 0, name: 'Незнакомец',      reps: 0,     desc: 'Форма еще не знает тебя' },
  { level: 1, name: 'Ученик',          reps: 50,    desc: 'Первые шаги по пути' },
  { level: 2, name: 'Практикующий',    reps: 200,   desc: 'Тело начинает запоминать' },
  { level: 3, name: 'Последователь',   reps: 500,   desc: 'Форма входит в привычку' },
  { level: 4, name: 'Боец',            reps: 1000,  desc: 'Движения становятся точнее' },
  { level: 5, name: 'Воин',            reps: 3000,  desc: 'Форма течет без усилий' },
  { level: 6, name: 'Мастер форм',     reps: 6000,  desc: 'Тело и форма — одно' },
  { level: 7, name: 'Страж традиции',  reps: 10000, desc: 'Передаешь через движение' },
  { level: 8, name: 'Хранитель пути',  reps: 25000, desc: 'Форма живет в тебе' },
  { level: 9, name: 'Живая форма',     reps: 50000, desc: 'Ты и есть форма' },
];


var SNAKE1_LEVELS = [
  { level: 0, name: 'Яйцо в траве',         reps: 0,     desc: 'Свернулась и ждет' },
  { level: 1, name: 'Первый изгиб',         reps: 50,    desc: 'Тело учится течь' },
  { level: 2, name: 'Сбрасываю кожу',       reps: 200,   desc: 'Старое уходит, новое приходит' },
  { level: 3, name: 'Бесшумный ход',        reps: 500,   desc: 'Скольжу, не тревожа траву' },
  { level: 4, name: 'Чешуя блестит',        reps: 1000,  desc: 'Форма отражает свет' },
  { level: 5, name: 'Стойка кобры',         reps: 2000,  desc: 'Собрана и готова' },
  { level: 6, name: 'Молниеносный бросок',  reps: 4000,  desc: 'Удар раньше мысли' },
  { level: 7, name: 'Кольцо вокруг жертвы', reps: 6000,  desc: 'Контроль без усилия' },
  { level: 8, name: 'Белая змея',           reps: 8000,  desc: 'Госпожа Бай Сучжэнь' },
  { level: 9, name: 'Змея-дракон',          reps: 10000, desc: 'Золотая чешуя' },
];


var FOREST_GUMP_LEVELS = [
  { level: 0, name: 'Пора в путь',          km: 0,     desc: 'Главное начать' },
  { level: 1, name: 'Беги, Форрест, беги!',  km: 50,    desc: 'Первые километры позади' },
  { level: 2, name: 'Ради Дженни',          km: 200,   desc: 'Есть причина' },
  { level: 3, name: 'Через Алабаму',        km: 500,   desc: 'В большой путь' },
  { level: 4, name: 'Просто бегу',          km: 1000,  desc: 'Бег стал привычкой' },
  { level: 5, name: 'У океана',             km: 2000,  desc: 'Добежал до воды' },
  { level: 6, name: 'На Восток',            km: 5000,  desc: 'Развернулся и снова' },
  { level: 7, name: 'Толпа за спиной',      km: 10000, desc: 'Тебя не догонят' },
  { level: 8, name: 'Туда и обратно',       km: 20000, desc: 'Бег не остановить' },
  { level: 9, name: 'Форрест',              km: 30000, desc: 'Рожденный бежать' },
];


// ─── РЕЕСТР СЕКЦИЙ ────────────────────────────────────────────────────────────
// Единственное место для регистрации секции.
// Добавить новую секцию = добавить запись сюда.
//
// label       — отображаемое название
// defaultPlan — путь к дефолтному плану для онбординга
// defaultTests — путь к дефолтным тестам для онбординга (null если нет)

var SECTION_META = {
  strength: {
    label:        'Силовые',
    defaultPlan:  'plans/strength_default.json',
    defaultTests: 'plans/tests_strength_default.json',
  },
  wingchun: {
    label:        'Вин Чун',
    defaultPlan:  'plans/wingchun_default.json',
    defaultTests: 'plans/tests_wingchun_default.json',
  },
  qigong: {
    label:        'Цигун',
    defaultPlan:  'plans/qigong_default.json',
    defaultTests: 'plans/tests_qigong_default.json',
  },
  cardio: {
    label:        'Кардио',
    defaultPlan:  'plans/cardio_default.json',
    defaultTests: 'plans/tests_cardio_default.json',
  },
  // Пример добавления новой секции:
  // brain: {
  //   label:        'Мозг',
  //   defaultPlan:  'plans/brain_default.json',
  //   defaultTests: 'plans/tests_brain_default.json',
  // },
};

// Список ключей секций — дериватив, не правится вручную
var SECTIONS = Object.keys(SECTION_META);


// ─── РЕЕСТР НАВЫКОВ ───────────────────────────────────────────────────────────
// section     — должен совпадать с ключом в SECTION_META
// valueType   — 'minutes' | 'seconds' | 'reps'
// levels      — ссылка на массив уровней (объявлены выше)
// source      — откуда суммируем значения для трекера
// tracker     — документ в users/{uid}/tracker/
// trackerField — поле в документе tracker
// icon        — HTML: <svg>, <span> или <img src="images/*.png">
// bgColor     — подложка под иконку (.sk-icon style="background:…"). Для <svg> (71%
//               контейнера) и <span> — виден по краям. Для <img> скрыт картинкой
//               (width:100% object-fit:cover) и виден только как fallback при
//               ошибке загрузки — не удалять, задаёт аварийный цвет.

var SKILLS = [
  {
    id: 'tree',
    name: 'Дерево',
    section: 'qigong',
    color: '#1D9E75',
    bgColor: '#EEEDFE',
    icon: '<img src="images/tree.png" alt="">',
    valueType: 'minutes',
    source: { collection: 'qigong', field: 'Дерево' },
    tracker: 'tree',
    trackerField: 'totalMinutes',
    levels: TREE_LEVELS,
  },
  {
    id: 'mountain',
    name: 'Стойка горы',
    section: 'wingchun',
    color: '#534AB7',
    bgColor: '#EEEDFE',
    icon: '<svg viewBox="0 0 30 30" fill="none"><path d="M3 25 L15 5 L27 25 Z" fill="#7F77DD"/><path d="M8 25 L15 13 L22 25 Z" fill="#534AB7"/><path d="M12 9 L15 5 L18 9 L15 12 Z" fill="white"/></svg>',
    valueType: 'seconds',
    source: { collection: 'wingchun', fields: ['Всадник у стены', 'Стульчик у стены', 'Мабу'] },
    tracker: 'iron_legs',
    trackerField: 'totalSeconds',
    levels: MOUNTAIN_LEVELS,
  },
  {
    id: 'pushups',
    name: 'Руки титана',
    section: 'strength',
    color: '#7A1F34',
    bgColor: '#F5E5E9',
    icon: '<img src="images/pushups.png" alt="">',
    valueType: 'reps',
    source: { collection: 'strength', field: 'Отжимания' },
    tracker: 'pushups',
    trackerField: 'totalReps',
    levels: PUSHUP_LEVELS,
  },
  {
    id: 'squats',
    name: 'Ноги титана',
    section: 'strength',
    color: '#A87817',
    bgColor: '#F8EFD5',
    icon: '<img src="images/squats.png" alt="">',
    valueType: 'reps',
    source: { collection: 'strength', fields: ['Приседания', 'Приседания сумо'] },
    tracker: 'squats',
    trackerField: 'totalReps',
    levels: TITAN_LEGS_LEVELS,
  },
  {
    id: 'pullups',
    name: 'Восхождение к небесам',
    section: 'strength',
    color: '#378ADD',
    bgColor: '#E6F1FB',
    icon: '<img src="images/pullups.png" alt="">',
    valueType: 'reps',
    source: { collection: 'strength', field: 'Подтягивания' },
    tracker: 'pullups',
    trackerField: 'totalReps',
    levels: PULLUP_LEVELS,
  },
  {
    id: 'slt',
    name: 'Сиу Ним Тау',
    section: 'wingchun',
    color: '#534AB7',
    bgColor: '#EEEDFE',
    icon: '<span style="font-family:serif;color:#534AB7;line-height:1">小</span>',
    valueType: 'reps',
    source: { collection: 'wingchun', field: 'Сиу Ним Тау' },
    tracker: 'slt',
    trackerField: 'totalReps',
    levels: FORMS_LEVELS,
  },
  {
    id: 'ck',
    name: 'Чам Кью',
    section: 'wingchun',
    color: '#534AB7',
    bgColor: '#EEEDFE',
    icon: '<span style="font-family:serif;color:#534AB7;line-height:1">桥</span>',
    valueType: 'reps',
    source: { collection: 'wingchun', field: 'Чам Кью' },
    tracker: 'ck',
    trackerField: 'totalReps',
    levels: FORMS_LEVELS,
  },
  {
    id: 'shisansi',
    name: 'Ши Сан Сы',
    section: 'wingchun',
    color: '#534AB7',
    bgColor: '#EEEDFE',
    icon: '<span style="font-family:serif;color:#534AB7;line-height:1">十三</span>',
    valueType: 'reps',
    source: { collection: 'wingchun', field: 'Ши Сан Сы' },
    tracker: 'shisansi',
    trackerField: 'totalReps',
    levels: SHISANSI_LEVELS,
  },
  {
    id: 'dummy1',
    name: 'Манекен №1',
    section: 'wingchun',
    color: '#534AB7',
    bgColor: '#EEEDFE',
    icon: '<span style="font-family:serif;color:#534AB7;line-height:1">樁<sup style="font-family:sans-serif">1</sup></span>',
    valueType: 'reps',
    source: { collection: 'wingchun', field: 'Манекен-1' },
    tracker: 'dummy1',
    trackerField: 'totalReps',
    levels: DUMMY1_LEVELS,
  },
  {
    id: 'snake1',
    name: 'Змея №1',
    section: 'wingchun',
    color: '#0F7C3A',
    bgColor: '#DDF0E2',
    icon: '<img src="images/snake1.png" alt="">',
    valueType: 'reps',
    source: { collection: 'wingchun', field: 'Змея-1' },
    tracker: 'snake1',
    trackerField: 'totalReps',
    levels: SNAKE1_LEVELS,
  },
  {
    id: 'lotus',
    name: 'Лотос',
    section: 'qigong',
    color: '#B06FC4',
    bgColor: '#F3E8FA',
    icon: '<img src="images/lotus.png" alt="">',
    valueType: 'minutes',
    source: { collection: 'qigong', field: 'Медитация' },
    tracker: 'lotus',
    trackerField: 'totalMinutes',
    levels: LOTUS_LEVELS,
  },
  {
    id: 'forest_gump',
    name: 'Форрест Гамп',
    section: 'cardio',
    color: '#1D9E75',
    bgColor: '#E1F5EE',
    icon: '<img src="images/forest_gump.png" alt="">',
    valueType: 'km',
    source: { collection: 'cardio', field: 'Бег' },
    tracker: 'forest_gump',
    trackerField: 'totalKm',
    levels: FOREST_GUMP_LEVELS,
  },
];

var STANCE_EXERCISES = ['Всадник у стены', 'Стульчик', 'Мабу'];


// ─── УНИВЕРСАЛЬНЫЕ ФУНКЦИИ УРОВНЕЙ ────────────────────────────────────────────
// Работают с любым навыком из SKILLS.
// Не нужно добавлять новую тройку функций при добавлении навыка.

function _skillValue(skill, totalValue) {
  if (skill.valueType === 'minutes') return totalValue / 60;   // -> часы
  if (skill.valueType === 'seconds') return totalValue / 3600; // -> часы
  return totalValue;                                            // reps — как есть
}

function _levelThreshold(levelEntry) {
  // Уровни с полем 'km'   используют его; 'reps' — повторения; иначе 'hours'
  if (levelEntry.km   !== undefined) return levelEntry.km;
  if (levelEntry.reps !== undefined) return levelEntry.reps;
  return levelEntry.hours;
}

function getSkillLevel(skill, totalValue) {
  var val = _skillValue(skill, totalValue);
  var levels = skill.levels;
  var current = levels[0];
  for (var i = 0; i < levels.length; i++) {
    if (val >= _levelThreshold(levels[i])) current = levels[i];
    else break;
  }
  return current;
}

function getSkillNextLevel(skill, totalValue) {
  var val = _skillValue(skill, totalValue);
  var levels = skill.levels;
  for (var i = 0; i < levels.length; i++) {
    if (val < _levelThreshold(levels[i])) return levels[i];
  }
  return null;
}

function getSkillProgress(skill, totalValue) {
  var val = _skillValue(skill, totalValue);
  var current = getSkillLevel(skill, totalValue);
  var next = getSkillNextLevel(skill, totalValue);
  if (!next) return 100;
  var range = _levelThreshold(next) - _levelThreshold(current);
  var done = val - _levelThreshold(current);
  return Math.round(done / range * 100);
}


// ─── HTML ESCAPE ──────────────────────────────────────────────────────────────
// Используется везде, где пользовательский текст (имя упражнения, название теста,
// название плана, единицы измерения) вставляется в innerHTML. Защита от XSS при
// Excel-импорте: юзер может назвать упражнение `<img src=x onerror=alert(1)>`.
// Null/undefined → пустая строка. Числа и прочее приводятся к строке.
function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


// ─── LOOKUP HELPERS ───────────────────────────────────────────────────────────

function getSkillById(id) {
  return SKILLS.find(function(s) { return s.id === id; }) || null;
}

function getSkillsBySection(section) {
  return SKILLS.filter(function(s) { return s.section === section; });
}

function getSectionMeta(section) {
  return SECTION_META[section] || null;
}


// ─── ИМЕНОВАННЫЕ ОБЁРТКИ (обратная совместимость) ─────────────────────────────
// Остальной код приложения продолжает работать без изменений.

function getTreeLevel(m)    { return getSkillLevel(getSkillById('tree'), m); }
function getTreeNextLevel(m){ return getSkillNextLevel(getSkillById('tree'), m); }
function getTreeProgress(m) { return getSkillProgress(getSkillById('tree'), m); }

function getMountainLevel(s)    { return getSkillLevel(getSkillById('mountain'), s); }
function getMountainNextLevel(s){ return getSkillNextLevel(getSkillById('mountain'), s); }
function getMountainProgress(s) { return getSkillProgress(getSkillById('mountain'), s); }

function getPushupLevel(r)    { return getSkillLevel(getSkillById('pushups'), r); }
function getPushupNextLevel(r){ return getSkillNextLevel(getSkillById('pushups'), r); }
function getPushupProgress(r) { return getSkillProgress(getSkillById('pushups'), r); }

function getPullupLevel(r)    { return getSkillLevel(getSkillById('pullups'), r); }
function getPullupNextLevel(r){ return getSkillNextLevel(getSkillById('pullups'), r); }
function getPullupProgress(r) { return getSkillProgress(getSkillById('pullups'), r); }

function getFormsLevel(r)    { return getSkillLevel(getSkillById('slt'), r); }
function getFormsNextLevel(r){ return getSkillNextLevel(getSkillById('slt'), r); }
function getFormsProgress(r) { return getSkillProgress(getSkillById('slt'), r); }

function getLotusLevel(m)    { return getSkillLevel(getSkillById('lotus'), m); }
function getLotusNextLevel(m){ return getSkillNextLevel(getSkillById('lotus'), m); }
function getLotusProgress(m) { return getSkillProgress(getSkillById('lotus'), m); }

function getForestGumpLevel(km)    { return getSkillLevel(getSkillById('forest_gump'), km); }
function getForestGumpNextLevel(km){ return getSkillNextLevel(getSkillById('forest_gump'), km); }
function getForestGumpProgress(km) { return getSkillProgress(getSkillById('forest_gump'), km); }


// ─── УТИЛИТЫ ДАТ ─────────────────────────────────────────────────────────────

function dateKey(date) {
  return date.getFullYear() + '-' +
    String(date.getMonth() + 1).padStart(2, '0') + '-' +
    String(date.getDate()).padStart(2, '0');
}

function getWeekDates(offset) {
  var now = new Date();
  var mon = new Date(now);
  mon.setDate(now.getDate() - (now.getDay() || 7) + 1 + offset * 7);
  var dates = [];
  for (var i = 0; i < 7; i++) {
    var d = new Date(mon);
    d.setDate(mon.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function getWeekLabel(offset) {
  var dates = getWeekDates(offset);
  var f = function(d) { return d.getDate() + '.' + String(d.getMonth() + 1).padStart(2, '0'); };
  return f(dates[0]) + ' — ' + f(dates[6]);
}

function getDayPlanIndex(date) {
  var dow = date.getDay();
  return dow === 0 ? 6 : dow - 1;
}

// Склонение русских существительных по числу.
// forms = [форма для 1, для 2-4, для 5+]. Пример: pluralize(3, ['день', 'дня', 'дней']) → 'дня'.
function pluralize(n, forms) {
  var n10 = Math.abs(n) % 10;
  var n100 = Math.abs(n) % 100;
  if (n100 >= 11 && n100 <= 14) return forms[2];
  if (n10 === 1) return forms[0];
  if (n10 >= 2 && n10 <= 4) return forms[1];
  return forms[2];
}


// ─── Node.js export (для юнит-тестов) ────────────────────────────────────────
if (typeof module !== 'undefined') {
  module.exports = {
    // Реестры
    SECTION_META, SECTIONS,
    SKILLS, getSkillById, getSkillsBySection, getSectionMeta,
    // Универсальные функции уровней
    getSkillLevel, getSkillNextLevel, getSkillProgress,
    // Именованные обёртки (обратная совместимость)
    getTreeLevel, getTreeNextLevel, getTreeProgress,
    getMountainLevel, getMountainNextLevel, getMountainProgress,
    getPushupLevel, getPushupNextLevel, getPushupProgress,
    getPullupLevel, getPullupNextLevel, getPullupProgress,
    getFormsLevel, getFormsNextLevel, getFormsProgress,
    getLotusLevel, getLotusNextLevel, getLotusProgress,
    getForestGumpLevel, getForestGumpNextLevel, getForestGumpProgress,
    // Массивы уровней (для тестов)
    TREE_LEVELS, MOUNTAIN_LEVELS, PUSHUP_LEVELS, TITAN_LEGS_LEVELS, PULLUP_LEVELS, FORMS_LEVELS, LOTUS_LEVELS, FOREST_GUMP_LEVELS, DUMMY1_LEVELS, SHISANSI_LEVELS, SNAKE1_LEVELS,
    // Утилиты
    STANCE_EXERCISES,
    dateKey, getWeekDates, getWeekLabel, getDayPlanIndex, pluralize,
    escapeHtml,
  };
}
