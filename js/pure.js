// Pure functions — no Firebase, no DOM dependencies
// Used by app modules and unit tests

var TREE_LEVELS = [
  { level: 0, name: 'Спящее семя',    hours: 0,     desc: 'Пора проснуться' },
  { level: 1, name: 'Семя',           hours: 10,    desc: 'Зерно посажено' },
  { level: 2, name: 'Росток',         hours: 30,    desc: 'Пробился сквозь землю' },
  { level: 3, name: 'Саженец',        hours: 60,    desc: 'Корни уходят вглубь' },
  { level: 4, name: 'Молодое дерево', hours: 100,   desc: 'Ствол окреп, ветви расправились' },
  { level: 5, name: 'Дерево',         hours: 300,   desc: 'Регулярная практика' },
  { level: 6, name: 'Зрелое дерево',  hours: 600,   desc: 'Корни в подземных водах' },
  { level: 7, name: 'Священное дерево', hours: 1000, desc: 'Птицы сами прилетают' },
  { level: 8, name: 'Мировое дерево', hours: 5000,  desc: 'Ветви касаются неба' },
  { level: 9, name: 'Иггдрасиль',     hours: 10000, desc: 'Соединяешь миры' },
];

var MOUNTAIN_LEVELS = [
  { level: 0, name: 'Ватные ноги',      hours: 0,     desc: 'Ноги еще не знают стойки' },
  { level: 1, name: 'Деревянные ноги',  hours: 10,    desc: 'Первые часы под нагрузкой' },
  { level: 2, name: 'Каменные ноги',    hours: 30,    desc: 'Стойка начинает держать' },
  { level: 3, name: 'Бронзовые ноги',   hours: 60,    desc: 'Закалка идет полным ходом' },
  { level: 4, name: 'Железные ноги',    hours: 100,   desc: 'Ноги превращаются в опору' },
  { level: 5, name: 'Стальные ноги',    hours: 300,   desc: 'Гора начинает узнавать тебя' },
  { level: 6, name: 'Мифриловые ноги',  hours: 600,   desc: 'Легкость и твердость слились' },
  { level: 7, name: 'Алмазные ноги',    hours: 1000,  desc: 'Ничто не сдвинет с места' },
  { level: 8, name: 'Адамантовые ноги', hours: 5000,  desc: 'Ты и есть гора' },
  { level: 9, name: 'Метеоритные ноги', hours: 10000, desc: 'Космос врос в землю' },
];

var STANCE_EXERCISES = ['Всадник у стены', 'Стульчик', 'Мабу'];

function getTreeLevel(totalMinutes) {
  var hours = totalMinutes / 60;
  var current = TREE_LEVELS[0];
  for (var i = 0; i < TREE_LEVELS.length; i++) {
    if (hours >= TREE_LEVELS[i].hours) current = TREE_LEVELS[i];
    else break;
  }
  return current;
}

function getTreeNextLevel(totalMinutes) {
  var hours = totalMinutes / 60;
  for (var i = 0; i < TREE_LEVELS.length; i++) {
    if (hours < TREE_LEVELS[i].hours) return TREE_LEVELS[i];
  }
  return null;
}

function getTreeProgress(totalMinutes) {
  var hours = totalMinutes / 60;
  var current = getTreeLevel(totalMinutes);
  var next = getTreeNextLevel(totalMinutes);
  if (!next) return 100;
  var range = next.hours - current.hours;
  var done = hours - current.hours;
  return Math.round(done / range * 100);
}

function getMountainLevel(totalSeconds) {
  var hours = totalSeconds / 3600;
  var current = MOUNTAIN_LEVELS[0];
  for (var i = 0; i < MOUNTAIN_LEVELS.length; i++) {
    if (hours >= MOUNTAIN_LEVELS[i].hours) current = MOUNTAIN_LEVELS[i];
    else break;
  }
  return current;
}

function getMountainNextLevel(totalSeconds) {
  var hours = totalSeconds / 3600;
  for (var i = 0; i < MOUNTAIN_LEVELS.length; i++) {
    if (hours < MOUNTAIN_LEVELS[i].hours) return MOUNTAIN_LEVELS[i];
  }
  return null;
}

function getMountainProgress(totalSeconds) {
  var hours = totalSeconds / 3600;
  var current = getMountainLevel(totalSeconds);
  var next = getMountainNextLevel(totalSeconds);
  if (!next) return 100;
  var range = next.hours - current.hours;
  var done = hours - current.hours;
  return Math.round(done / range * 100);
}

function dateKey(date) {
  return date.getFullYear() + '-' +
    String(date.getMonth() + 1).padStart(2, '0') + '-' +
    String(date.getDate()).padStart(2, '0');
}

function getWeekDates(offset) {
  var now = new Date();
  var mon = new Date(now);
  mon.setDate(now.getDate() - now.getDay() + 1 + offset * 7);
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

var PULLUP_LEVELS = [
  { level: 0, name: 'Прикован к земле',       reps: 0,      desc: 'Земля не отпускает' },
  { level: 1, name: 'Первый шаг',              reps: 50,     desc: 'Начало пути вверх' },
  { level: 2, name: 'Подножие горы',           reps: 200,    desc: 'Путь только начинается' },
  { level: 3, name: 'Середина склона',         reps: 500,    desc: 'Полпути позади' },
  { level: 4, name: 'Вершина горы',            reps: 2000,   desc: 'Земля осталась внизу' },
  { level: 5, name: 'Выше горизонта',          reps: 5000,   desc: 'Видно край земли' },
  { level: 6, name: 'Между мирами',            reps: 20000,  desc: 'Ни земля, ни небо' },
  { level: 7, name: 'Парить в облаках',        reps: 50000,  desc: 'Облака под ногами' },
  { level: 8, name: 'Прикоснуться к звезде',  reps: 200000, desc: 'Рука дотянулась до света' },
  { level: 9, name: 'Девятое небо',            reps: 500000, desc: 'Высшая из высот' },
];

function getPushupLevel(totalReps) {
  var current = PUSHUP_LEVELS[0];
  for (var i = 0; i < PUSHUP_LEVELS.length; i++) {
    if (totalReps >= PUSHUP_LEVELS[i].reps) current = PUSHUP_LEVELS[i];
    else break;
  }
  return current;
}

function getPushupNextLevel(totalReps) {
  for (var i = 0; i < PUSHUP_LEVELS.length; i++) {
    if (totalReps < PUSHUP_LEVELS[i].reps) return PUSHUP_LEVELS[i];
  }
  return null;
}

function getPushupProgress(totalReps) {
  var current = getPushupLevel(totalReps);
  var next = getPushupNextLevel(totalReps);
  if (!next) return 100;
  var range = next.reps - current.reps;
  var done = totalReps - current.reps;
  return Math.round(done / range * 100);
}

function getPullupLevel(totalReps) {
  var current = PULLUP_LEVELS[0];
  for (var i = 0; i < PULLUP_LEVELS.length; i++) {
    if (totalReps >= PULLUP_LEVELS[i].reps) current = PULLUP_LEVELS[i];
    else break;
  }
  return current;
}

function getPullupNextLevel(totalReps) {
  for (var i = 0; i < PULLUP_LEVELS.length; i++) {
    if (totalReps < PULLUP_LEVELS[i].reps) return PULLUP_LEVELS[i];
  }
  return null;
}

function getPullupProgress(totalReps) {
  var current = getPullupLevel(totalReps);
  var next = getPullupNextLevel(totalReps);
  if (!next) return 100;
  var range = next.reps - current.reps;
  var done = totalReps - current.reps;
  return Math.round(done / range * 100);
}


// --- SKILLS config ---
// Единое место описания всех навыков.
// section — раздел пользователя (strength / wingchun / qigong)
// source.collection — коллекция Firebase откуда суммируем значения
// source.field — имя упражнения в values{}
// tracker — документ в users/uid/tracker/
// trackerField — поле в документе tracker
// valueType — 'minutes' | 'seconds' | 'reps'
// levels — шкала уровней из pure.js

var SKILLS = [
  {
    id: 'tree',
    name: 'Дерево',
    section: 'qigong',
    color: '#1D9E75',
    bgColor: '#EEEDFE',
    valueType: 'minutes',
    source: { collection: 'qigong', field: 'Дерево' },
    tracker: 'tree',
    trackerField: 'totalMinutes',
    levels: null, // заполняется ниже после объявления TREE_LEVELS
  },
  {
    id: 'mountain',
    name: 'Стойка горы',
    section: 'wingchun',
    color: '#7F77DD',
    bgColor: '#EEEDFE',
    valueType: 'seconds',
    source: { collection: 'wingchun', fields: ['Всадник у стены', 'Стульчик', 'Мабу'] },
    sourceExtra: { collection: 'tests', fields: ['Всадник у стены', 'Стульчик у стены', 'Мабу'] },
    tracker: 'iron_legs',
    trackerField: 'totalSeconds',
    levels: null,
  },
  {
    id: 'pushups',
    name: 'Руки титана',
    section: 'strength',
    color: '#D85A30',
    bgColor: '#FAECE7',
    valueType: 'reps',
    source: { collection: 'strength', field: 'Отжимания' },
    sourceExtra: { collection: 'tests', field: 'Отжимания' },
    tracker: 'pushups',
    trackerField: 'totalReps',
    levels: null,
  },
  {
    id: 'pullups',
    name: 'Восхождение к небесам',
    section: 'strength',
    color: '#378ADD',
    bgColor: '#E6F1FB',
    valueType: 'reps',
    source: { collection: 'strength', field: 'Подтягивания' },
    sourceExtra: { collection: 'tests', field: 'Подтягивания' },
    tracker: 'pullups',
    trackerField: 'totalReps',
    levels: null,
  },
  {
    id: 'slt',
    name: 'Сиу Лим Тау',
    section: 'wingchun',
    color: '#7F77DD',
    bgColor: '#EEEDFE',
    valueType: 'reps',
    source: { collection: 'wingchun', field: 'Сиу Лим Тау' },
    tracker: 'slt',
    trackerField: 'totalReps',
    levels: null,
  },
  {
    id: 'ck',
    name: 'Чам Кью',
    section: 'wingchun',
    color: '#534AB7',
    bgColor: '#EEEDFE',
    valueType: 'reps',
    source: { collection: 'wingchun', field: 'Чам Кью' },
    tracker: 'ck',
    trackerField: 'totalReps',
    levels: null,
  },
];

// Привязываем уровни после их объявления
function initSkillLevels() {
  SKILLS[0].levels = TREE_LEVELS;
  SKILLS[1].levels = MOUNTAIN_LEVELS;
  SKILLS[2].levels = PUSHUP_LEVELS;
  SKILLS[3].levels = PULLUP_LEVELS;
  SKILLS[4].levels = FORMS_LEVELS;
  SKILLS[5].levels = FORMS_LEVELS;
}

function getSkillById(id) {
  return SKILLS.find(function(s) { return s.id === id; }) || null;
}

function getSkillsBySection(section) {
  return SKILLS.filter(function(s) { return s.section === section; });
}

// Node.js export for tests
if (typeof module !== 'undefined') {
  module.exports = {
    getTreeLevel, getTreeNextLevel, getTreeProgress,
    getMountainLevel, getMountainNextLevel, getMountainProgress,
    dateKey, getWeekDates, getDayPlanIndex,
    TREE_LEVELS, MOUNTAIN_LEVELS, STANCE_EXERCISES,
    PUSHUP_LEVELS, PULLUP_LEVELS,
    getPushupLevel, getPushupNextLevel, getPushupProgress,
    getPullupLevel, getPullupNextLevel, getPullupProgress,
    FORMS_LEVELS,
    getFormsLevel, getFormsNextLevel, getFormsProgress,
    SKILLS, initSkillLevels, getSkillById, getSkillsBySection,
  };
}

var FORMS_LEVELS = [
  { level: 0, name: 'Незнакомец',      reps: 0,      desc: 'Форма ещё не знает тебя' },
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

function getFormsLevel(totalReps) {
  var current = FORMS_LEVELS[0];
  for (var i = 0; i < FORMS_LEVELS.length; i++) {
    if (totalReps >= FORMS_LEVELS[i].reps) current = FORMS_LEVELS[i];
    else break;
  }
  return current;
}

function getFormsNextLevel(totalReps) {
  for (var i = 0; i < FORMS_LEVELS.length; i++) {
    if (totalReps < FORMS_LEVELS[i].reps) return FORMS_LEVELS[i];
  }
  return null;
}

function getFormsProgress(totalReps) {
  var current = getFormsLevel(totalReps);
  var next = getFormsNextLevel(totalReps);
  if (!next) return 100;
  var range = next.reps - current.reps;
  var done = totalReps - current.reps;
  return Math.round(done / range * 100);
}


