// Unit-тесты для js/pure.js
// Запуск: node tools/tests/pure.test.js
// Зависимости: только Node.js (assert из стандартной библиотеки)

'use strict';
const assert = require('assert');
const p = require('../../js/pure.js');

var passed = 0;
var failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(' ✓', name);
    passed++;
  } catch (e) {
    console.error(' ✗', name);
    console.error('  ', e.message);
    failed++;
  }
}

// ─── SECTION_META и SECTIONS ─────────────────────────────────────────────────
console.log('\nSECTION_META и SECTIONS');

test('SECTIONS содержит strength, wingchun, qigong, cardio', function() {
  assert.deepStrictEqual(p.SECTIONS, ['strength', 'wingchun', 'qigong', 'cardio']);
});

test('каждая секция имеет label и defaultPlan', function() {
  p.SECTIONS.forEach(function(s) {
    var meta = p.SECTION_META[s];
    assert.ok(meta.label, s + ': нет label');
    assert.ok(meta.defaultPlan, s + ': нет defaultPlan');
  });
});

test('defaultTests — строка или null', function() {
  p.SECTIONS.forEach(function(s) {
    var meta = p.SECTION_META[s];
    assert.ok(
      meta.defaultTests === null || typeof meta.defaultTests === 'string',
      s + ': defaultTests должен быть строкой или null'
    );
  });
});

test('getSectionMeta возвращает объект для валидной секции', function() {
  var m = p.getSectionMeta('qigong');
  assert.strictEqual(m.label, 'Цигун');
});

test('getSectionMeta возвращает null для неизвестной секции', function() {
  assert.strictEqual(p.getSectionMeta('unknown'), null);
});

// ─── SKILLS — структура ──────────────────────────────────────────────────────
console.log('\nSKILLS — структура');

test('все навыки имеют обязательные поля', function() {
  var required = ['id', 'name', 'section', 'color', 'bgColor', 'icon', 'valueType', 'tracker', 'trackerField', 'levels'];
  p.SKILLS.forEach(function(skill) {
    required.forEach(function(field) {
      assert.ok(skill[field] != null, skill.id + ': нет поля ' + field);
    });
  });
});

test('section каждого навыка присутствует в SECTION_META', function() {
  p.SKILLS.forEach(function(skill) {
    assert.ok(p.SECTION_META[skill.section], skill.id + ': секция ' + skill.section + ' не зарегистрирована');
  });
});

test('levels у каждого навыка — непустой массив', function() {
  p.SKILLS.forEach(function(skill) {
    assert.ok(Array.isArray(skill.levels) && skill.levels.length > 0, skill.id + ': levels пустой или не массив');
  });
});

test('у levels нет null — initSkillLevels удалён', function() {
  p.SKILLS.forEach(function(skill) {
    assert.notStrictEqual(skill.levels, null, skill.id + ': levels всё ещё null');
  });
});

test('id навыков уникальны', function() {
  var ids = p.SKILLS.map(function(s) { return s.id; });
  var unique = new Set(ids);
  assert.strictEqual(unique.size, ids.length, 'есть дублирующиеся id навыков');
});

// ─── SKILLS — иконки ─────────────────────────────────────────────────────────
console.log('\nSKILLS — иконки');

test('у каждого навыка есть непустая строка icon', function() {
  p.SKILLS.forEach(function(skill) {
    assert.strictEqual(typeof skill.icon, 'string', skill.id + ': icon не строка');
    assert.ok(skill.icon.length > 0, skill.id + ': icon пустой');
  });
});

test('icon начинается с < (валидный HTML-тег)', function() {
  p.SKILLS.forEach(function(skill) {
    assert.ok(skill.icon.trim().charAt(0) === '<', skill.id + ': icon не начинается с <');
  });
});

test('все icon — либо <svg>, либо <span>, либо <img>', function() {
  p.SKILLS.forEach(function(skill) {
    var t = skill.icon.trim();
    var ok = t.indexOf('<svg') === 0 || t.indexOf('<span') === 0 || t.indexOf('<img') === 0;
    assert.ok(ok, skill.id + ': icon начинается не с <svg/<span/<img — ' + t.slice(0, 20));
  });
});

test('в icon нет инлайн width/height (размер задает контейнер .sk-icon)', function() {
  p.SKILLS.forEach(function(skill) {
    assert.ok(!/\swidth\s*=\s*"/i.test(skill.icon), skill.id + ': icon содержит инлайн width=');
    assert.ok(!/\sheight\s*=\s*"/i.test(skill.icon), skill.id + ': icon содержит инлайн height=');
    assert.ok(!/(?<!-)width\s*:\s*\d/i.test(skill.icon), skill.id + ': icon содержит инлайн width:');
    assert.ok(!/(?<!-)height\s*:\s*\d/i.test(skill.icon), skill.id + ': icon содержит инлайн height:');
  });
});

test('в icon нет инлайн font-size (размер задает контейнер .sk-icon через em)', function() {
  p.SKILLS.forEach(function(skill) {
    assert.ok(!/font-size\s*:/i.test(skill.icon), skill.id + ': icon содержит инлайн font-size');
  });
});

// ─── getSkillById / getSkillsBySection ───────────────────────────────────────
console.log('\ngetSkillById / getSkillsBySection');

test('getSkillById находит навык по id', function() {
  var skill = p.getSkillById('tree');
  assert.strictEqual(skill.name, 'Дерево');
});

test('getSkillById возвращает null для несуществующего id', function() {
  assert.strictEqual(p.getSkillById('nonexistent'), null);
});

test('getSkillsBySection возвращает только навыки нужной секции', function() {
  var wc = p.getSkillsBySection('wingchun');
  assert.ok(wc.length > 0, 'wingchun: пустой список');
  wc.forEach(function(s) { assert.strictEqual(s.section, 'wingchun'); });
});

test('getSkillsBySection — wingchun содержит snake1', function() {
  var ids = p.getSkillsBySection('wingchun').map(function(s) { return s.id; });
  assert.ok(ids.includes('snake1'), 'нет snake1');
});

test('getSkillsBySection — strength содержит pushups, squats и pullups', function() {
  var ids = p.getSkillsBySection('strength').map(function(s) { return s.id; });
  assert.ok(ids.includes('pushups'), 'нет pushups');
  assert.ok(ids.includes('squats'), 'нет squats');
  assert.ok(ids.includes('pullups'), 'нет pullups');
});

test('getSkillsBySection — cardio содержит forest_gump', function() {
  var ids = p.getSkillsBySection('cardio').map(function(s) { return s.id; });
  assert.ok(ids.includes('forest_gump'), 'нет forest_gump');
});

// ─── getSkillLevel (minutes) — tree ──────────────────────────────────────────
console.log('\ngetSkillLevel — minutes (tree)');
var tree = p.getSkillById('tree');

test('0 минут → уровень 0', function() { assert.strictEqual(p.getSkillLevel(tree, 0).level, 0); });
test('599 минут (< 10ч) → уровень 0', function() { assert.strictEqual(p.getSkillLevel(tree, 599).level, 0); });
test('600 минут (= 10ч) → уровень 1', function() { assert.strictEqual(p.getSkillLevel(tree, 600).level, 1); });
test('1800 минут (= 30ч) → уровень 2', function() { assert.strictEqual(p.getSkillLevel(tree, 1800).level, 2); });
test('600000 минут (10000ч) → уровень 9 (максимум)', function() { assert.strictEqual(p.getSkillLevel(tree, 600000).level, 9); });

// ─── getSkillNextLevel / getSkillProgress (minutes) ──────────────────────────
console.log('\ngetSkillNextLevel / getSkillProgress — minutes (tree)');

test('getSkillNextLevel: 0 мин → следующий уровень 1 (10ч)', function() {
  var next = p.getSkillNextLevel(tree, 0);
  assert.strictEqual(next.level, 1);
  assert.strictEqual(next.hours, 10);
});

test('getSkillNextLevel: максимальный уровень → null', function() {
  assert.strictEqual(p.getSkillNextLevel(tree, 600000), null);
});

test('getSkillProgress: 0 мин → 0%', function() { assert.strictEqual(p.getSkillProgress(tree, 0), 0); });
test('getSkillProgress: ровно на пороге → 0% следующего диапазона', function() {
  assert.strictEqual(p.getSkillProgress(tree, 600), 0);
});
test('getSkillProgress: максимальный уровень → 100%', function() { assert.strictEqual(p.getSkillProgress(tree, 600000), 100); });
test('getSkillProgress: середина диапазона → ~50%', function() {
  var pct = p.getSkillProgress(tree, 1200);
  assert.strictEqual(pct, 50);
});

// ─── getSkillLevel (seconds) — mountain ──────────────────────────────────────
console.log('\ngetSkillLevel — seconds (mountain)');
var mtn = p.getSkillById('mountain');

test('0 сек → уровень 0', function() { assert.strictEqual(p.getSkillLevel(mtn, 0).level, 0); });
test('36000 сек (= 10ч) → уровень 1', function() { assert.strictEqual(p.getSkillLevel(mtn, 36000).level, 1); });
test('108000 сек (= 30ч) → уровень 2', function() { assert.strictEqual(p.getSkillLevel(mtn, 108000).level, 2); });

// ─── getSkillLevel (reps) — pushups ──────────────────────────────────────────
console.log('\ngetSkillLevel — reps (pushups)');
var pu = p.getSkillById('pushups');

test('0 повт → уровень 0', function() { assert.strictEqual(p.getSkillLevel(pu, 0).level, 0); });
test('100 повт → уровень 1', function() { assert.strictEqual(p.getSkillLevel(pu, 100).level, 1); });
test('999 повт → уровень 2', function() { assert.strictEqual(p.getSkillLevel(pu, 999).level, 2); });
test('1000000 повт → уровень 9', function() { assert.strictEqual(p.getSkillLevel(pu, 1000000).level, 9); });
test('getSkillProgress: 750 повт между уровнями 2(500) и 3(1000) → 50%', function() {
  assert.strictEqual(p.getSkillProgress(pu, 750), 50);
});

// ─── getSkillLevel (reps) — snake1 ───────────────────────────────────────────
console.log('\ngetSkillLevel — reps (snake1)');
var sn = p.getSkillById('snake1');

test('snake1: 0 повт → уровень 0', function() { assert.strictEqual(p.getSkillLevel(sn, 0).level, 0); });
test('snake1: 49 повт → уровень 0', function() { assert.strictEqual(p.getSkillLevel(sn, 49).level, 0); });
test('snake1: 50 повт → уровень 1', function() { assert.strictEqual(p.getSkillLevel(sn, 50).level, 1); });
test('snake1: 200 повт → уровень 2', function() { assert.strictEqual(p.getSkillLevel(sn, 200).level, 2); });
test('snake1: 10000 повт → уровень 9 (максимум)', function() { assert.strictEqual(p.getSkillLevel(sn, 10000).level, 9); });
test('snake1: 99999 повт → уровень 9 (не выходим за максимум)', function() { assert.strictEqual(p.getSkillLevel(sn, 99999).level, 9); });
test('snake1: getSkillProgress на максимуме → 100%', function() { assert.strictEqual(p.getSkillProgress(sn, 10000), 100); });

// ─── getSkillLevel (reps) — squats (Ноги титана) ─────────────────────────────
console.log('\ngetSkillLevel — reps (squats)');
var sq = p.getSkillById('squats');

test('squats: навык существует и называется "Ноги титана"', function() {
  assert.ok(sq, 'squats не найден');
  assert.strictEqual(sq.name, 'Ноги титана');
  assert.strictEqual(sq.section, 'strength');
  assert.strictEqual(sq.valueType, 'reps');
});
test('squats: source.fields содержит Приседания и Приседания сумо', function() {
  assert.deepStrictEqual(sq.source.fields, ['Приседания', 'Приседания сумо']);
});
test('squats: 0 повт → уровень 0', function() { assert.strictEqual(p.getSkillLevel(sq, 0).level, 0); });
test('squats: 99 повт → уровень 0', function() { assert.strictEqual(p.getSkillLevel(sq, 99).level, 0); });
test('squats: 100 повт → уровень 1', function() { assert.strictEqual(p.getSkillLevel(sq, 100).level, 1); });
test('squats: 999 повт → уровень 2', function() { assert.strictEqual(p.getSkillLevel(sq, 999).level, 2); });
test('squats: 1000000 повт → уровень 9 (Ноги титана)', function() {
  var lvl = p.getSkillLevel(sq, 1000000);
  assert.strictEqual(lvl.level, 9);
  assert.strictEqual(lvl.name, 'Ноги титана');
});
test('squats: getSkillProgress 750 между 500 и 1000 → 50%', function() {
  assert.strictEqual(p.getSkillProgress(sq, 750), 50);
});
test('squats: TITAN_LEGS_LEVELS совпадает с PUSHUP_LEVELS по числовым порогам', function() {
  for (var i = 0; i < p.PUSHUP_LEVELS.length; i++) {
    assert.strictEqual(p.TITAN_LEGS_LEVELS[i].reps, p.PUSHUP_LEVELS[i].reps,
      'уровень ' + i + ': пороги должны совпадать');
    assert.strictEqual(p.TITAN_LEGS_LEVELS[i].level, p.PUSHUP_LEVELS[i].level);
  }
});

// ─── getSkillLevel (km) — forest_gump ────────────────────────────────────────
console.log('\ngetSkillLevel — km (forest_gump)');
var fg = p.getSkillById('forest_gump');

test('0 км → уровень 0', function() { assert.strictEqual(p.getSkillLevel(fg, 0).level, 0); });
test('49 км → уровень 0', function() { assert.strictEqual(p.getSkillLevel(fg, 49).level, 0); });
test('50 км → уровень 1', function() { assert.strictEqual(p.getSkillLevel(fg, 50).level, 1); });
test('200 км → уровень 2', function() { assert.strictEqual(p.getSkillLevel(fg, 200).level, 2); });
test('30000 км → уровень 9 (максимум)', function() { assert.strictEqual(p.getSkillLevel(fg, 30000).level, 9); });
test('getSkillProgress: 125 км между уровнями 1(50) и 2(200) → 50%', function() {
  assert.strictEqual(p.getSkillProgress(fg, 125), 50);
});
test('getForestGumpLevel совпадает с getSkillLevel(forest_gump)', function() {
  [0, 50, 200, 30000].forEach(function(v) {
    assert.strictEqual(p.getForestGumpLevel(v).level, p.getSkillLevel(fg, v).level);
  });
});

// ─── Обёртки (обратная совместимость) ────────────────────────────────────────
console.log('\nИменованные обёртки (обратная совместимость)');

test('getTreeLevel совпадает с getSkillLevel(tree)', function() {
  [0, 600, 1800, 600000].forEach(function(v) {
    assert.strictEqual(p.getTreeLevel(v).level, p.getSkillLevel(tree, v).level, 'расхождение при ' + v);
  });
});

test('getMountainLevel совпадает с getSkillLevel(mountain)', function() {
  [0, 36000, 108000].forEach(function(v) {
    assert.strictEqual(p.getMountainLevel(v).level, p.getSkillLevel(mtn, v).level);
  });
});

test('getPushupLevel совпадает с getSkillLevel(pushups)', function() {
  [0, 100, 5000, 1000000].forEach(function(v) {
    assert.strictEqual(p.getPushupLevel(v).level, p.getSkillLevel(pu, v).level);
  });
});

test('getLotusLevel совпадает с getSkillLevel(lotus)', function() {
  var lotus = p.getSkillById('lotus');
  [0, 600, 18000].forEach(function(v) {
    assert.strictEqual(p.getLotusLevel(v).level, p.getSkillLevel(lotus, v).level);
  });
});

// ─── Утилиты дат ─────────────────────────────────────────────────────────────
console.log('\nУтилиты дат');

test('dateKey формирует YYYY-MM-DD', function() {
  var d = new Date(2025, 2, 5);
  assert.strictEqual(p.dateKey(d), '2025-03-05');
});

test('getWeekDates возвращает 7 дней', function() {
  assert.strictEqual(p.getWeekDates(0).length, 7);
});

test('getWeekDates offset=0: первый день — понедельник', function() {
  var dates = p.getWeekDates(0);
  assert.strictEqual(dates[0].getDay(), 1);
});

test('getDayPlanIndex: воскресенье (0) → 6', function() {
  var sun = new Date(2025, 2, 9);
  assert.strictEqual(p.getDayPlanIndex(sun), 6);
});

test('getDayPlanIndex: понедельник (1) → 0', function() {
  var mon = new Date(2025, 2, 10);
  assert.strictEqual(p.getDayPlanIndex(mon), 0);
});

// ─── pluralize (русское склонение) ────────────────────────────────────────────
console.log('\npluralize');

var days = ['день', 'дня', 'дней'];

test('1 → день', function() { assert.strictEqual(p.pluralize(1, days), 'день'); });
test('2 → дня', function() { assert.strictEqual(p.pluralize(2, days), 'дня'); });
test('3 → дня', function() { assert.strictEqual(p.pluralize(3, days), 'дня'); });
test('4 → дня', function() { assert.strictEqual(p.pluralize(4, days), 'дня'); });
test('5 → дней', function() { assert.strictEqual(p.pluralize(5, days), 'дней'); });
test('0 → дней', function() { assert.strictEqual(p.pluralize(0, days), 'дней'); });
test('11 → дней', function() { assert.strictEqual(p.pluralize(11, days), 'дней'); });
test('12 → дней', function() { assert.strictEqual(p.pluralize(12, days), 'дней'); });
test('14 → дней', function() { assert.strictEqual(p.pluralize(14, days), 'дней'); });
test('21 → день', function() { assert.strictEqual(p.pluralize(21, days), 'день'); });
test('22 → дня', function() { assert.strictEqual(p.pluralize(22, days), 'дня'); });
test('25 → дней', function() { assert.strictEqual(p.pluralize(25, days), 'дней'); });
test('101 → день', function() { assert.strictEqual(p.pluralize(101, days), 'день'); });
test('111 → дней (исключение)', function() { assert.strictEqual(p.pluralize(111, days), 'дней'); });

// ─── escapeHtml (защита от XSS) ───────────────────────────────────────────────
console.log('\nescapeHtml');

test('обычный текст без изменений', function() {
  assert.strictEqual(p.escapeHtml('Отжимания'), 'Отжимания');
});
test('< и > экранируются', function() {
  assert.strictEqual(p.escapeHtml('<img src=x>'), '&lt;img src=x&gt;');
});
test('амперсанд экранируется первым (без двойного кодирования)', function() {
  assert.strictEqual(p.escapeHtml('A & B'), 'A &amp; B');
  assert.strictEqual(p.escapeHtml('<&>'), '&lt;&amp;&gt;');
});
test('двойные кавычки экранируются (для атрибутов)', function() {
  assert.strictEqual(p.escapeHtml('say "hi"'), 'say &quot;hi&quot;');
});
test('одинарные кавычки экранируются (для атрибутов)', function() {
  assert.strictEqual(p.escapeHtml("it's ok"), 'it&#39;s ok');
});
test('null → пустая строка', function() {
  assert.strictEqual(p.escapeHtml(null), '');
});
test('undefined → пустая строка', function() {
  assert.strictEqual(p.escapeHtml(undefined), '');
});
test('число приводится к строке', function() {
  assert.strictEqual(p.escapeHtml(42), '42');
});
test('XSS-вектор из техдолга нейтрализуется', function() {
  assert.strictEqual(
    p.escapeHtml('<img src=x onerror=alert(1)>'),
    '&lt;img src=x onerror=alert(1)&gt;'
  );
});
test('пустая строка остается пустой', function() {
  assert.strictEqual(p.escapeHtml(''), '');
});

// ─── Итог ─────────────────────────────────────────────────────────────────────
console.log('\n─────────────────────────────────');
console.log('Итого: ' + passed + ' прошло, ' + failed + ' упало');
if (failed > 0) process.exit(1);
