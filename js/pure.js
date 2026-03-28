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

// Node.js export for tests
if (typeof module !== 'undefined') {
  module.exports = {
    getTreeLevel, getTreeNextLevel, getTreeProgress,
    getMountainLevel, getMountainNextLevel, getMountainProgress,
    dateKey, getWeekDates, getDayPlanIndex,
    TREE_LEVELS, MOUNTAIN_LEVELS, STANCE_EXERCISES
  };
}
