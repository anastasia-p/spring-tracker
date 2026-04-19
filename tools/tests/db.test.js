// Тесты для db.js в текущем (legacy) виде.
// Цель — зафиксировать как работают функции сейчас,
// чтобы при рефакторинге не сломать legacy-ветку.
//
// Запуск: node tools/tests/db.test.js

'use strict';
var assert = require('assert');
var ts = require('./db-test-setup');

var passed = 0, failed = 0;

function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(
      function() { console.log(' ✓', name); passed++; },
      function(e) { console.error(' ✗', name); console.error('  ', e.stack || e.message); failed++; }
    )
    .then(function() { ts.teardown(); });
}

function group(name) { console.log('\n' + name); }

// ─── userCol ─────────────────────────────────────────────────────────────────

function runTests() {
  return Promise.resolve()

  // ─── userCol ─────────────────────────────────────────────────────────────

  .then(function() { group('userCol'); })

  .then(function() { return test('userCol returns users/{uid}/{name} ref', function() {
    var ctx = ts.setup();
    var ref = ctx.api.userCol('strength');
    assert.strictEqual(ref.path, 'users/u1/strength');
  }); })

  // ─── loadPlanFromFirebase ────────────────────────────────────────────────

  .then(function() { group('loadPlanFromFirebase'); })

  .then(function() { return test('loads plan/{section}.days into plans[section]', function() {
    var days = [{ day: 'Пн' }, { day: 'Вт' }];
    var ctx = ts.setup({ seed: { 'users/u1/plan/strength': { days: days } } });
    return ctx.api.loadPlanFromFirebase('strength').then(function() {
      assert.deepStrictEqual(ctx.api.plans.strength, days);
    });
  }); })

  .then(function() { return test('loads plan/tests.items into plans.tests', function() {
    var items = [{ name: 'Отжимания', unit: 'раз' }];
    var ctx = ts.setup({ seed: { 'users/u1/plan/tests': { items: items } } });
    return ctx.api.loadPlanFromFirebase('tests').then(function() {
      assert.deepStrictEqual(ctx.api.plans.tests, items);
    });
  }); })

  .then(function() { return test('does nothing if doc does not exist', function() {
    var ctx = ts.setup();
    return ctx.api.loadPlanFromFirebase('strength').then(function() {
      assert.strictEqual(ctx.api.plans.strength, null);
    });
  }); })

  // ─── loadDayData ─────────────────────────────────────────────────────────

  .then(function() { group('loadDayData'); })

  .then(function() { return test('reads from {section}/{date}', function() {
    var ctx = ts.setup({
      seed: { 'users/u1/strength/2026-04-18': {
        plan: [{ name: 'Отжимания' }],
        type: 'upper', label: 'Верх',
        checks: { 'Отжимания': true }, values: { 'Отжимания': 25 }
      } }
    });
    return ctx.api.loadDayData('strength', new Date('2026-04-18T12:00:00')).then(function(d) {
      assert.deepStrictEqual(d.checks, { 'Отжимания': true });
      assert.deepStrictEqual(d.values, { 'Отжимания': 25 });
      assert.strictEqual(d.type, 'upper');
      assert.strictEqual(d.label, 'Верх');
    });
  }); })

  .then(function() { return test('returns empty shape if doc missing and no plan', function() {
    var ctx = ts.setup();
    return ctx.api.loadDayData('strength', new Date('2026-04-18T12:00:00')).then(function(d) {
      assert.deepStrictEqual(d.checks, {});
      assert.deepStrictEqual(d.values, {});
      assert.deepStrictEqual(d.plan, []);
      assert.strictEqual(d.type, 'rest');
    });
  }); })

  .then(function() { return test('uses plan from plans[section] when doc missing', function() {
    var ctx = ts.setup();
    // Подкладываем план недели — "Понедельник" = индекс 0
    ctx.api.plans.strength = [
      { day: 'Понедельник', type: 'legs', label: 'Ноги',
        exercises: [{ name: 'Приседания' }] }
    ];
    // 2026-04-13 — понедельник
    return ctx.api.loadDayData('strength', new Date('2026-04-13T12:00:00')).then(function(d) {
      assert.deepStrictEqual(d.plan, [{ name: 'Приседания' }]);
      assert.strictEqual(d.type, 'legs');
      assert.strictEqual(d.label, 'Ноги');
    });
  }); })

  .then(function() { return test('caches results — second call hits cache', function() {
    var ctx = ts.setup({
      seed: { 'users/u1/strength/2026-04-18': { checks: {}, values: {}, plan: [] } }
    });
    var date = new Date('2026-04-18T12:00:00');
    return ctx.api.loadDayData('strength', date).then(function() {
      ctx.mock.clearLog();
      return ctx.api.loadDayData('strength', date);
    }).then(function() {
      var gets = ctx.mock.log.filter(function(op) { return op[0] === 'GET'; });
      assert.strictEqual(gets.length, 0, 'cached call should not GET');
    });
  }); })

  // ─── saveDayData ─────────────────────────────────────────────────────────

  .then(function() { group('saveDayData'); })

  .then(function() { return test('writes to {section}/{date}', function() {
    var ctx = ts.setup();
    var date = new Date('2026-04-18T12:00:00');
    ctx.api.cache.strength['2026-04-18'] = {
      plan: [{ name: 'X' }], type: 'legs', label: 'Ноги',
      checks: { X: true }, values: { X: 5 }
    };
    ctx.api.saveDayData('strength', date);
    // saveDayData асинхронный внутри, но fire-and-forget — ждём tick
    return Promise.resolve().then(function() {
      assert.deepStrictEqual(ctx.mock.store['users/u1/strength/2026-04-18'], {
        plan: [{ name: 'X' }], type: 'legs', label: 'Ноги',
        checks: { X: true }, values: { X: 5 }
      });
    });
  }); })

  .then(function() { return test('does nothing if cache entry missing', function() {
    var ctx = ts.setup();
    ctx.api.saveDayData('strength', new Date('2026-04-18T12:00:00'));
    return Promise.resolve().then(function() {
      assert.strictEqual(ctx.mock.log.length, 0);
    });
  }); })

  // ─── loadTestsCache ──────────────────────────────────────────────────────

  .then(function() { group('loadTestsCache'); })

  .then(function() { return test('loads all tests/* docs into cache.tests', function() {
    var ctx = ts.setup({
      seed: {
        'users/u1/tests/2026-04-01': { 'Отжимания': 20 },
        'users/u1/tests/2026-04-08': { 'Отжимания': 25 },
      }
    });
    return ctx.api.loadTestsCache().then(function() {
      assert.deepStrictEqual(ctx.api.cache.tests['2026-04-01'], { 'Отжимания': 20 });
      assert.deepStrictEqual(ctx.api.cache.tests['2026-04-08'], { 'Отжимания': 25 });
    });
  }); })

  // ─── saveTestData ────────────────────────────────────────────────────────

  .then(function() { group('saveTestData'); })

  .then(function() { return test('writes to tests/{date} and updates cache', function() {
    var ctx = ts.setup();
    ctx.api.saveTestData('2026-04-18', { 'Отжимания': 30 });
    return Promise.resolve().then(function() {
      assert.deepStrictEqual(ctx.mock.store['users/u1/tests/2026-04-18'], { 'Отжимания': 30 });
      assert.deepStrictEqual(ctx.api.cache.tests['2026-04-18'], { 'Отжимания': 30 });
    });
  }); })

  // ─── loadSkill ───────────────────────────────────────────────────────────

  .then(function() { group('loadSkill'); })

  .then(function() { return test('reads tracker/{tracker}.{field} into skillTotals[skill.id]', function() {
    var ctx = ts.setup({
      seed: { 'users/u1/tracker/pushups': { totalReps: 369 } }
    });
    var skill = pure_getSkill('pushups');
    return ctx.api.loadSkill(skill).then(function() {
      assert.strictEqual(ctx.api.skillTotals.pushups, 369);
    });
  }); })

  .then(function() { return test('returns 0 if tracker doc missing', function() {
    var ctx = ts.setup();
    var skill = pure_getSkill('pushups');
    return ctx.api.loadSkill(skill).then(function() {
      assert.strictEqual(ctx.api.skillTotals.pushups, 0);
    });
  }); })

  .then(function() { return test('mountain uses tracker iron_legs (different id)', function() {
    var ctx = ts.setup({
      seed: { 'users/u1/tracker/iron_legs': { totalSeconds: 8680 } }
    });
    var skill = pure_getSkill('mountain');
    return ctx.api.loadSkill(skill).then(function() {
      assert.strictEqual(ctx.api.skillTotals.mountain, 8680);
    });
  }); })

  // ─── recalcSkill ─────────────────────────────────────────────────────────

  .then(function() { group('recalcSkill'); })

  .then(function() { return test('sums values across section history and writes to tracker', function() {
    var ctx = ts.setup({
      seed: {
        'users/u1/strength/2026-04-10': { values: { 'Отжимания': 20 } },
        'users/u1/strength/2026-04-11': { values: { 'Отжимания': 25 } },
      }
    });
    var skill = pure_getSkill('pushups');
    return waitRecalc(ctx, skill).then(function() {
      assert.strictEqual(ctx.api.skillTotals.pushups, 45);
      assert.deepStrictEqual(ctx.mock.store['users/u1/tracker/pushups'], { totalReps: 45 });
    });
  }); })

  .then(function() { return test('sourceExtra — mountain sums seconds from wingchun and tests', function() {
    var ctx = ts.setup({
      seed: {
        'users/u1/wingchun/2026-04-10': { values: { 'Всадник у стены': 60, 'Стульчик у стены': 40 } },
        'users/u1/tests/2026-04-08': { 'Всадник у стены': 50, 'Стульчик у стены': 30 },
      }
    });
    var skill = pure_getSkill('mountain');
    return waitRecalc(ctx, skill).then(function() {
      assert.strictEqual(ctx.api.skillTotals.mountain, 180); // 60+40+50+30
    });
  }); })

  // ─── findSkillByExercise ─────────────────────────────────────────────────

  .then(function() { group('findSkillByExercise'); })

  .then(function() { return test('finds pushups by "Отжимания" in strength', function() {
    var ctx = ts.setup();
    var s = ctx.api.findSkillByExercise('Отжимания', 'strength');
    assert.strictEqual(s.id, 'pushups');
  }); })

  .then(function() { return test('finds mountain by "Всадник у стены" in wingchun', function() {
    var ctx = ts.setup();
    var s = ctx.api.findSkillByExercise('Всадник у стены', 'wingchun');
    assert.strictEqual(s.id, 'mountain');
  }); })

  .then(function() { return test('returns null for unknown exercise', function() {
    var ctx = ts.setup();
    assert.strictEqual(ctx.api.findSkillByExercise('Nope', 'strength'), null);
  }); })

  .then(function() { return test('returns null when collection does not match', function() {
    var ctx = ts.setup();
    // "Отжимания" — skill.source.collection='strength', ищем в wingchun
    assert.strictEqual(ctx.api.findSkillByExercise('Отжимания', 'wingchun'), null);
  }); })

  // ─── calcDailyStreak ─────────────────────────────────────────────────────

  .then(function() { group('calcDailyStreak'); })

  .then(function() { return test('empty section → streak 0', function() {
    var ctx = ts.setup({ config: { createdAt: '2026-04-15T00:00:00.000Z' } });
    // Нет документов истории, нет плана — streak не начнётся (план ≠ пустой день отдыха)
    // Но в коде: если plan.length === 0 → streak++. Значит для всех дней вчера→createdAt
    // streak растёт до упора в createdAt.
    // Задаём "сегодня" =  2026-04-17 → вчера 2026-04-16, createdAt 2026-04-15 → 2 дня отдыха
    var origDate = Date;
    global.Date = fakeDate('2026-04-17T12:00:00');
    return ctx.api.calcDailyStreak('strength').then(function(streak) {
      global.Date = origDate;
      // createdAt=2026-04-15 → streak идёт от 2026-04-16 до 2026-04-15 включительно = 2
      assert.strictEqual(streak, 2);
    });
  }); })

  .then(function() { return test('streak counts partially done days', function() {
    var ctx = ts.setup({ config: { createdAt: '2026-04-15T00:00:00.000Z' } });
    ctx.mock.seed('users/u1/strength/2026-04-16', {
      plan: [{ name: 'A' }, { name: 'B' }],
      checks: { A: true }
    });
    var origDate = Date;
    global.Date = fakeDate('2026-04-17T12:00:00');
    return ctx.api.calcDailyStreak('strength').then(function(streak) {
      global.Date = origDate;
      // 2026-04-16 — частичное выполнение → streak+1, 2026-04-15 — нет данных, нет плана → plan.length === 0 → +1
      assert.strictEqual(streak, 2);
    });
  }); })

  .then(function() { return test('streak breaks on day with plan but no checks', function() {
    var ctx = ts.setup({ config: { createdAt: '2026-04-10T00:00:00.000Z' } });
    ctx.mock.seed('users/u1/strength/2026-04-16', {
      plan: [{ name: 'A' }],
      checks: { A: true }
    });
    ctx.mock.seed('users/u1/strength/2026-04-15', {
      plan: [{ name: 'B' }],
      checks: {} // ничего не сделано
    });
    ctx.mock.seed('users/u1/strength/2026-04-14', {
      plan: [{ name: 'C' }],
      checks: { C: true }
    });
    var origDate = Date;
    global.Date = fakeDate('2026-04-17T12:00:00');
    return ctx.api.calcDailyStreak('strength').then(function(streak) {
      global.Date = origDate;
      assert.strictEqual(streak, 1); // только 16-е, 15-е разрывает
    });
  }); })

  .then(function() { return test('cache hit returns without DB call', function() {
    var ctx = ts.setup();
    ctx.api.streakCache.strength = 42;
    return ctx.api.calcDailyStreak('strength').then(function(streak) {
      assert.strictEqual(streak, 42);
      // Не должно быть GET_COLL
      var gets = ctx.mock.log.filter(function(op) { return op[0] === 'GET_COLL'; });
      assert.strictEqual(gets.length, 0);
    });
  }); })

  .then(function() { return test('invalidateStreakCache clears cache', function() {
    var ctx = ts.setup();
    ctx.api.streakCache.strength = 42;
    ctx.api.invalidateStreakCache('strength');
    assert.strictEqual(ctx.api.streakCache.strength, undefined);
  }); })

  // ─── resetCache ──────────────────────────────────────────────────────────

  .then(function() { group('resetCache'); })

  .then(function() { return test('clears cache[section]', function() {
    var ctx = ts.setup();
    ctx.api.cache.strength['2026-04-01'] = { foo: 1 };
    ctx.api.resetCache('strength');
    assert.deepStrictEqual(ctx.api.cache.strength, {});
  }); })

  // ─── loadAllSkills ───────────────────────────────────────────────────────

  .then(function() { group('loadAllSkills'); })

  .then(function() { return test('loads every skill in SKILLS', function() {
    var ctx = ts.setup({
      seed: {
        'users/u1/tracker/pushups': { totalReps: 100 },
        'users/u1/tracker/tree':    { totalMinutes: 50 },
      }
    });
    return ctx.api.loadAllSkills().then(function() {
      assert.strictEqual(ctx.api.skillTotals.pushups, 100);
      assert.strictEqual(ctx.api.skillTotals.tree, 50);
      // Остальные навыки = 0
      assert.strictEqual(ctx.api.skillTotals.pullups, 0);
      assert.strictEqual(ctx.api.skillTotals.mountain, 0);
    });
  }); })

  // ─── Итог ────────────────────────────────────────────────────────────────

  .then(function() {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    if (failed > 0) process.exit(1);
  });
}

// ─── Хелперы ─────────────────────────────────────────────────────────────────

var pure = require('../../js/pure.js');

function pure_getSkill(id) {
  return pure.getSkillById(id);
}

// recalcSkill — fire-and-forget promise chain внутри, ждём до 2 тиков
function waitRecalc(ctx, skill) {
  ctx.api.recalcSkill(skill);
  return new Promise(function(resolve) { setTimeout(resolve, 20); });
}

// Простой мок Date для фиксации "сейчас"
function fakeDate(fixedIso) {
  var real = Date;
  function F() {
    if (arguments.length === 0) return new real(fixedIso);
    if (arguments.length === 1) return new real(arguments[0]);
    return new real(arguments[0], arguments[1], arguments[2] || 1,
                    arguments[3] || 0, arguments[4] || 0, arguments[5] || 0);
  }
  F.now = function() { return new real(fixedIso).getTime(); };
  F.prototype = real.prototype;
  F.parse = real.parse;
  F.UTC = real.UTC;
  return F;
}

runTests();
