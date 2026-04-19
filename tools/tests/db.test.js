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

  // ============================================================
  // V2 ТЕСТЫ — schema_version = 2, новая структура
  // ============================================================

  // ─── isSchemaV2 ──────────────────────────────────────────────────────────

  .then(function() { group('v2: isSchemaV2'); })

  .then(function() { return test('returns true when schemaV2 setup flag is set', function() {
    var ctx = ts.setup({ schemaV2: true });
    assert.strictEqual(ctx.api.isSchemaV2(), true);
  }); })

  .then(function() { return test('returns false when schemaV2 flag not set', function() {
    var ctx = ts.setup();
    assert.strictEqual(ctx.api.isSchemaV2(), false);
  }); })

  // ─── loadPlanFromFirebase v2 ─────────────────────────────────────────────

  .then(function() { group('v2: loadPlanFromFirebase'); })

  .then(function() { return test('v2: reads sections/{section}/plan/current.days', function() {
    var days = [{ day: 'Пн' }];
    var ctx = ts.setup({
      schemaV2: true,
      seed: { 'users/u1/sections/strength/plan/current': { days: days } }
    });
    return ctx.api.loadPlanFromFirebase('strength').then(function() {
      assert.deepStrictEqual(ctx.api.plans.strength, days);
    });
  }); })

  .then(function() { return test('v2: tests aggregates from all active sections', function() {
    var ctx = ts.setup({
      schemaV2: true,
      seed: {
        'users/u1/sections/strength/tests/current': {
          items: [{ name: 'Отжимания', unit: 'раз' }]
        },
        'users/u1/sections/wingchun/tests/current': {
          items: [{ name: 'Мабу', unit: 'сек' }]
        },
      }
    });
    global.userSections = ['strength', 'wingchun'];
    return ctx.api.loadPlanFromFirebase('tests').then(function() {
      delete global.userSections;
      var names = ctx.api.plans.tests.map(function(it) { return it.name; }).sort();
      assert.deepStrictEqual(names, ['Мабу', 'Отжимания']);
      ctx.api.plans.tests.forEach(function(it) {
        if (it.name === 'Мабу') assert.strictEqual(it.section, 'wingchun');
        if (it.name === 'Отжимания') assert.strictEqual(it.section, 'strength');
      });
    });
  }); })

  // ─── loadDayData v2 ──────────────────────────────────────────────────────

  .then(function() { group('v2: loadDayData'); })

  .then(function() { return test('v2: reads sections/{section}/plan/{YYYY}/history/{date}', function() {
    var ctx = ts.setup({
      schemaV2: true,
      seed: {
        'users/u1/sections/strength/plan/2026/history/2026-04-18': {
          plan: [{ name: 'Отжимания' }],
          type: 'upper', label: 'Верх',
          checks: { 'Отжимания': true }, values: { 'Отжимания': 25 }
        }
      }
    });
    return ctx.api.loadDayData('strength', new Date('2026-04-18T12:00:00')).then(function(d) {
      assert.deepStrictEqual(d.checks, { 'Отжимания': true });
      assert.strictEqual(d.values['Отжимания'], 25);
      var gets = ctx.mock.log.filter(function(op) { return op[0] === 'GET'; });
      assert.ok(gets.some(function(op) {
        return op[1] === 'users/u1/sections/strength/plan/2026/history/2026-04-18';
      }), 'expected GET on v2 path, got: ' + JSON.stringify(gets));
    });
  }); })

  // ─── saveDayData v2 ──────────────────────────────────────────────────────

  .then(function() { group('v2: saveDayData'); })

  .then(function() { return test('v2: writes sections/{section}/plan/{YYYY}/history/{date}', function() {
    var ctx = ts.setup({ schemaV2: true });
    ctx.api.cache.strength['2026-04-18'] = {
      plan: [{ name: 'X' }], type: 'legs', label: 'Ноги',
      checks: { X: true }, values: { X: 5 }
    };
    ctx.api.saveDayData('strength', new Date('2026-04-18T12:00:00'));
    return Promise.resolve().then(function() {
      var p = 'users/u1/sections/strength/plan/2026/history/2026-04-18';
      assert.ok(ctx.mock.store[p], 'expected write at ' + p);
      assert.strictEqual(ctx.mock.store[p].values.X, 5);
    });
  }); })

  // ─── loadSkill v2 ────────────────────────────────────────────────────────

  .then(function() { group('v2: loadSkill'); })

  .then(function() { return test('v2: reads sections/{section}/skills/{skill.id}', function() {
    var ctx = ts.setup({
      schemaV2: true,
      seed: { 'users/u1/sections/strength/skills/pushups': { totalReps: 500 } }
    });
    var skill = pure_getSkill('pushups');
    return ctx.api.loadSkill(skill).then(function() {
      assert.strictEqual(ctx.api.skillTotals.pushups, 500);
    });
  }); })

  .then(function() { return test('v2: mountain lives under wingchun section', function() {
    var ctx = ts.setup({
      schemaV2: true,
      seed: { 'users/u1/sections/wingchun/skills/mountain': { totalSeconds: 9000 } }
    });
    var skill = pure_getSkill('mountain');
    return ctx.api.loadSkill(skill).then(function() {
      assert.strictEqual(ctx.api.skillTotals.mountain, 9000);
    });
  }); })

  // ─── recalcSkill v2 ──────────────────────────────────────────────────────

  .then(function() { group('v2: recalcSkill'); })

  .then(function() { return test('v2: sums from plan history and writes to sections/.../skills/', function() {
    var ctx = ts.setup({
      schemaV2: true,
      seed: {
        'users/u1/sections/strength/plan/2026/history/2026-04-10': { values: { 'Отжимания': 20 } },
        'users/u1/sections/strength/plan/2026/history/2026-04-11': { values: { 'Отжимания': 25 } },
      }
    });
    var skill = pure_getSkill('pushups');
    return waitRecalc(ctx, skill).then(function() {
      assert.strictEqual(ctx.api.skillTotals.pushups, 45);
      assert.strictEqual(
        ctx.mock.store['users/u1/sections/strength/skills/pushups'].totalReps, 45);
    });
  }); })

  .then(function() { return test('v2: mountain sums from wingchun history AND wingchun tests history', function() {
    var ctx = ts.setup({
      schemaV2: true,
      seed: {
        'users/u1/sections/wingchun/plan/2026/history/2026-04-10': {
          values: { 'Всадник у стены': 60, 'Стульчик у стены': 40 }
        },
        'users/u1/sections/wingchun/tests/2026/history/2026-04-08': {
          'Всадник у стены': 50, 'Стульчик у стены': 30
        },
      }
    });
    var skill = pure_getSkill('mountain');
    return waitRecalc(ctx, skill).then(function() {
      assert.strictEqual(ctx.api.skillTotals.mountain, 180);
      assert.strictEqual(
        ctx.mock.store['users/u1/sections/wingchun/skills/mountain'].totalSeconds, 180);
    });
  }); })

  // ─── loadTestsCache v2 ───────────────────────────────────────────────────

  .then(function() { group('v2: loadTestsCache'); })

  .then(function() { return test('v2: merges tests history from all active sections by date', function() {
    var ctx = ts.setup({
      schemaV2: true,
      seed: {
        'users/u1/sections/strength/tests/2026/history/2026-04-18': { 'Отжимания': 25 },
        'users/u1/sections/wingchun/tests/2026/history/2026-04-18': { 'Мабу': 60 },
      }
    });
    global.userSections = ['strength', 'wingchun'];
    return ctx.api.loadTestsCache().then(function() {
      delete global.userSections;
      assert.deepStrictEqual(ctx.api.cache.tests['2026-04-18'],
        { 'Отжимания': 25, 'Мабу': 60 });
    });
  }); })

  // ─── saveTestData v2 ─────────────────────────────────────────────────────

  .then(function() { group('v2: saveTestData'); })

  .then(function() { return test('v2: writes values to sections/{section}/tests/{YYYY}/history/{date}', function() {
    var ctx = ts.setup({ schemaV2: true });
    ctx.api.plans.tests = [
      { name: 'Отжимания', unit: 'раз', section: 'strength' },
      { name: 'Мабу', unit: 'сек', section: 'wingchun' },
    ];
    ctx.api.saveTestData('2026-04-18', { 'Отжимания': 30, 'Мабу': 60 });
    return Promise.resolve().then(function() {
      assert.deepStrictEqual(
        ctx.mock.store['users/u1/sections/strength/tests/2026/history/2026-04-18'],
        { 'Отжимания': 30 });
      assert.deepStrictEqual(
        ctx.mock.store['users/u1/sections/wingchun/tests/2026/history/2026-04-18'],
        { 'Мабу': 60 });
    });
  }); })

  .then(function() { return test('v2: items without section fall into strength', function() {
    var ctx = ts.setup({ schemaV2: true });
    ctx.api.plans.tests = [{ name: 'Custom', unit: 'раз' }];
    ctx.api.saveTestData('2026-04-18', { 'Custom': 5 });
    return Promise.resolve().then(function() {
      assert.deepStrictEqual(
        ctx.mock.store['users/u1/sections/strength/tests/2026/history/2026-04-18'],
        { 'Custom': 5 });
    });
  }); })

  .then(function() { return test('v2: removing a value re-writes section doc without it', function() {
    var ctx = ts.setup({
      schemaV2: true,
      seed: {
        'users/u1/sections/strength/tests/2026/history/2026-04-18': {
          'Отжимания': 5, 'Подтягивания': 3
        }
      }
    });
    global.userSections = ['strength'];
    ctx.api.plans.tests = [
      { name: 'Отжимания', section: 'strength' },
      { name: 'Подтягивания', section: 'strength' },
    ];
    // Снимаем галочку с Подтягивания — осталось только Отжимания
    return ctx.api.saveTestData('2026-04-18', { 'Отжимания': 5 })
      .then(function() {
        delete global.userSections;
        var stored = ctx.mock.store['users/u1/sections/strength/tests/2026/history/2026-04-18'];
        assert.deepStrictEqual(stored, { 'Отжимания': 5 });
        assert.strictEqual(stored['Подтягивания'], undefined);
      });
  }); })

  .then(function() { return test('v2: clearing all values in a section writes empty doc', function() {
    var ctx = ts.setup({
      schemaV2: true,
      seed: {
        'users/u1/sections/wingchun/tests/2026/history/2026-04-18': { 'Мабу': 60 }
      }
    });
    global.userSections = ['wingchun'];
    ctx.api.plans.tests = [{ name: 'Мабу', section: 'wingchun' }];
    return ctx.api.saveTestData('2026-04-18', {})
      .then(function() {
        delete global.userSections;
        assert.deepStrictEqual(
          ctx.mock.store['users/u1/sections/wingchun/tests/2026/history/2026-04-18'], {});
      });
  }); })

  // ─── calcDailyStreak v2 ──────────────────────────────────────────────────

  .then(function() { group('v2: calcDailyStreak'); })

  .then(function() { return test('v2: counts streak via plan history', function() {
    var ctx = ts.setup({
      schemaV2: true,
      config: { createdAt: '2026-04-10T00:00:00.000Z' }
    });
    ctx.mock.seed('users/u1/sections/strength/plan/2026/history/2026-04-16', {
      plan: [{ name: 'A' }], checks: { A: true }
    });
    ctx.mock.seed('users/u1/sections/strength/plan/2026/history/2026-04-15', {
      plan: [{ name: 'B' }], checks: {}
    });
    var origDate = Date;
    global.Date = fakeDate('2026-04-17T12:00:00');
    return ctx.api.calcDailyStreak('strength').then(function(streak) {
      global.Date = origDate;
      assert.strictEqual(streak, 1);
    });
  }); })

  // ─── listYearsToRead ─────────────────────────────────────────────────────

  .then(function() { group('v2: listYearsToRead'); })

  .then(function() { return test('returns [createdYear..currentYear]', function() {
    var ctx = ts.setup({
      schemaV2: true,
      config: { createdAt: '2025-08-12T00:00:00.000Z' }
    });
    var origDate = Date;
    global.Date = fakeDate('2026-04-19T12:00:00');
    var years = ctx.api.listYearsToRead();
    global.Date = origDate;
    assert.deepStrictEqual(years, ['2025', '2026']);
  }); })

  .then(function() { return test('returns single year when created this year', function() {
    var ctx = ts.setup({
      schemaV2: true,
      config: { createdAt: '2026-03-01T00:00:00.000Z' }
    });
    var origDate = Date;
    global.Date = fakeDate('2026-04-19T12:00:00');
    var years = ctx.api.listYearsToRead();
    global.Date = origDate;
    assert.deepStrictEqual(years, ['2026']);
  }); })

  // ─── API layer: loadConfig / saveConfig ──────────────────────────────────

  .then(function() { group('API: loadConfig / saveConfig'); })

  .then(function() { return test('loadConfig returns config data', function() {
    var ctx = ts.setup({ config: { sections: ['strength', 'wingchun'] } });
    return ctx.api.loadConfig().then(function(cfg) {
      assert.deepStrictEqual(cfg.sections, ['strength', 'wingchun']);
    });
  }); })

  .then(function() { return test('saveConfig merges with existing', function() {
    var ctx = ts.setup({ config: { sections: ['strength'], email: 'a@b.c' } });
    return ctx.api.saveConfig({ sections: ['strength', 'wingchun'] })
      .then(function() {
        var stored = ctx.mock.store['users/u1'];
        assert.deepStrictEqual(stored.sections, ['strength', 'wingchun']);
        assert.strictEqual(stored.email, 'a@b.c'); // сохранилось
      });
  }); })

  // ─── API layer: loadSectionPlan / savePlan ───────────────────────────────

  .then(function() { group('API: loadSectionPlan / savePlan'); })

  .then(function() { return test('legacy loadSectionPlan reads plan/{section}.days', function() {
    var days = [{ day: 'Пн' }];
    var ctx = ts.setup({ seed: { 'users/u1/plan/strength': { days: days } } });
    return ctx.api.loadSectionPlan('strength').then(function(d) {
      assert.deepStrictEqual(d, days);
    });
  }); })

  .then(function() { return test('v2 loadSectionPlan reads sections/{section}/plan/current.days', function() {
    var days = [{ day: 'Пн' }];
    var ctx = ts.setup({
      schemaV2: true,
      seed: { 'users/u1/sections/strength/plan/current': { days: days } }
    });
    return ctx.api.loadSectionPlan('strength').then(function(d) {
      assert.deepStrictEqual(d, days);
    });
  }); })

  .then(function() { return test('legacy savePlan writes plan/{section}', function() {
    var ctx = ts.setup();
    var days = [{ day: 'Пн' }];
    return ctx.api.savePlan('strength', days).then(function() {
      assert.deepStrictEqual(ctx.mock.store['users/u1/plan/strength'], { days: days });
      assert.deepStrictEqual(ctx.api.plans.strength, days);
    });
  }); })

  .then(function() { return test('v2 savePlan writes sections/{section}/plan/current', function() {
    var ctx = ts.setup({ schemaV2: true });
    var days = [{ day: 'Пн' }];
    return ctx.api.savePlan('strength', days).then(function() {
      var stored = ctx.mock.store['users/u1/sections/strength/plan/current'];
      assert.deepStrictEqual(stored.days, days);
      assert.ok(stored.updatedAt);
    });
  }); })

  // ─── API layer: loadSectionTests / saveTests ─────────────────────────────

  .then(function() { group('API: loadSectionTests / saveTests'); })

  .then(function() { return test('v2 loadSectionTests reads sections/{section}/tests/current', function() {
    var items = [{ name: 'Отжимания', unit: 'раз' }];
    var ctx = ts.setup({
      schemaV2: true,
      seed: { 'users/u1/sections/strength/tests/current': { items: items } }
    });
    return ctx.api.loadSectionTests('strength').then(function(i) {
      assert.deepStrictEqual(i, items);
    });
  }); })

  .then(function() { return test('v2 saveTests writes sections/{section}/tests/current', function() {
    var ctx = ts.setup({ schemaV2: true });
    var items = [{ name: 'Отжимания', unit: 'раз' }];
    return ctx.api.saveTests('strength', items).then(function() {
      var stored = ctx.mock.store['users/u1/sections/strength/tests/current'];
      assert.deepStrictEqual(stored.items, items);
      assert.ok(stored.updatedAt);
    });
  }); })

  // ─── API layer: createSectionDefaults ────────────────────────────────────

  .then(function() { group('API: createSectionDefaults'); })

  .then(function() { return test('v2 creates plan/default, plan/current, tests/default, tests/current', function() {
    var ctx = ts.setup({ schemaV2: true });
    var days = [{ day: 'Пн' }];
    var items = [{ name: 'Мабу', unit: 'сек' }];
    return ctx.api.createSectionDefaults('wingchun', days, items).then(function() {
      var base = 'users/u1/sections/wingchun/';
      assert.deepStrictEqual(ctx.mock.store[base + 'plan/default'], { days: days });
      assert.deepStrictEqual(ctx.mock.store[base + 'plan/current'].days, days);
      assert.deepStrictEqual(ctx.mock.store[base + 'tests/default'], { items: items });
      assert.deepStrictEqual(ctx.mock.store[base + 'tests/current'].items, items);
    });
  }); })

  .then(function() { return test('v2 creates empty tests when testsItems null', function() {
    var ctx = ts.setup({ schemaV2: true });
    return ctx.api.createSectionDefaults('brain', [], null).then(function() {
      var base = 'users/u1/sections/brain/';
      assert.deepStrictEqual(ctx.mock.store[base + 'tests/default'], { items: [] });
      assert.deepStrictEqual(ctx.mock.store[base + 'tests/current'].items, []);
    });
  }); })

  .then(function() { return test('legacy creates only plan/{section}', function() {
    var ctx = ts.setup();
    var days = [{ day: 'Пн' }];
    return ctx.api.createSectionDefaults('strength', days, []).then(function() {
      assert.deepStrictEqual(ctx.mock.store['users/u1/plan/strength'], { days: days });
      // Никаких sections/ в legacy
      var hasV2 = Object.keys(ctx.mock.store).some(function(k) {
        return k.indexOf('users/u1/sections/') === 0;
      });
      assert.strictEqual(hasV2, false);
    });
  }); })

  // ─── API layer: enableSection / disableSection ───────────────────────────

  .then(function() { group('API: enableSection / disableSection'); })

  .then(function() { return test('v2 enableSection sets enabled=true and syncs config', function() {
    var ctx = ts.setup({
      schemaV2: true,
      config: { sections: ['strength'] },
      seed: {
        'users/u1/sections/strength': { enabled: true, order: 0 },
        'users/u1/sections/wingchun': { enabled: false, order: 1 },
        'users/u1/sections/qigong':   { enabled: false, order: 2 },
      }
    });
    return ctx.api.enableSection('wingchun').then(function() {
      assert.strictEqual(ctx.mock.store['users/u1/sections/wingchun'].enabled, true);
      // config.sections должен синхронизироваться с enabled флагами
      var cfgSections = ctx.mock.store['users/u1'].sections.slice().sort();
      assert.deepStrictEqual(cfgSections, ['strength', 'wingchun']);
    });
  }); })

  .then(function() { return test('v2 disableSection sets enabled=false and removes from config', function() {
    var ctx = ts.setup({
      schemaV2: true,
      config: { sections: ['strength', 'wingchun'] },
      seed: {
        'users/u1/sections/strength': { enabled: true },
        'users/u1/sections/wingchun': { enabled: true },
      }
    });
    return ctx.api.disableSection('wingchun').then(function() {
      assert.strictEqual(ctx.mock.store['users/u1/sections/wingchun'].enabled, false);
      assert.deepStrictEqual(ctx.mock.store['users/u1'].sections, ['strength']);
    });
  }); })

  .then(function() { return test('legacy enableSection adds to config.sections', function() {
    var ctx = ts.setup({ config: { sections: ['strength'] } });
    return ctx.api.enableSection('wingchun').then(function() {
      assert.deepStrictEqual(ctx.mock.store['users/u1'].sections, ['strength', 'wingchun']);
    });
  }); })

  .then(function() { return test('legacy disableSection removes from config.sections', function() {
    var ctx = ts.setup({ config: { sections: ['strength', 'wingchun'] } });
    return ctx.api.disableSection('wingchun').then(function() {
      assert.deepStrictEqual(ctx.mock.store['users/u1'].sections, ['strength']);
    });
  }); })

  // ─── API layer: saveAllTests ─────────────────────────────────────────────

  .then(function() { group('API: saveAllTests'); })

  .then(function() { return test('v2 saveAllTests spreads items across sections by item.section', function() {
    var ctx = ts.setup({ schemaV2: true });
    global.userSections = ['strength', 'wingchun', 'qigong'];
    var items = [
      { name: 'Отжимания', unit: 'раз', section: 'strength' },
      { name: 'Подтягивания', unit: 'раз', section: 'strength' },
      { name: 'Мабу', unit: 'сек', section: 'wingchun' },
    ];
    return ctx.api.saveAllTests(items).then(function() {
      delete global.userSections;
      var strItems = ctx.mock.store['users/u1/sections/strength/tests/current'].items;
      var wcItems  = ctx.mock.store['users/u1/sections/wingchun/tests/current'].items;
      assert.strictEqual(strItems.length, 2);
      assert.strictEqual(wcItems.length, 1);
      // Поле section не должно попасть в хранилище — оно только в памяти
      strItems.forEach(function(it) { assert.strictEqual(it.section, undefined); });
    });
  }); })

  .then(function() { return test('v2 saveAllTests empties active sections without items', function() {
    var ctx = ts.setup({ schemaV2: true });
    global.userSections = ['strength', 'qigong'];
    var items = [{ name: 'X', section: 'strength' }];
    return ctx.api.saveAllTests(items).then(function() {
      delete global.userSections;
      var qi = ctx.mock.store['users/u1/sections/qigong/tests/current'];
      assert.deepStrictEqual(qi.items, []);
    });
  }); })

  .then(function() { return test('v2 saveAllTests does not touch inactive sections', function() {
    var ctx = ts.setup({
      schemaV2: true,
      seed: {
        'users/u1/sections/cardio/tests/current': { items: [{ name: 'old-cardio-test' }] }
      }
    });
    global.userSections = ['strength']; // cardio не активна
    return ctx.api.saveAllTests([{ name: 'X', section: 'strength' }]).then(function() {
      delete global.userSections;
      // Данные неактивной секции остались нетронутыми
      assert.deepStrictEqual(
        ctx.mock.store['users/u1/sections/cardio/tests/current'].items,
        [{ name: 'old-cardio-test' }]
      );
    });
  }); })

  .then(function() { return test('legacy saveAllTests writes plan/tests as single doc', function() {
    var ctx = ts.setup();
    var items = [{ name: 'Отжимания' }, { name: 'Мабу' }];
    return ctx.api.saveAllTests(items).then(function() {
      assert.deepStrictEqual(ctx.mock.store['users/u1/plan/tests'], { items: items });
    });
  }); })

  // ─── Promise contracts (защита от race conditions) ──────────────────────

  .then(function() { group('Promise contracts'); })

  .then(function() { return test('saveDayData returns a Promise', function() {
    var ctx = ts.setup({ schemaV2: true });
    ctx.api.cache.strength['2026-04-18'] = {
      plan: [], type: 'rest', label: '', checks: {}, values: {}
    };
    var result = ctx.api.saveDayData('strength', new Date('2026-04-18T12:00:00'));
    assert.ok(result, 'expected return value');
    assert.ok(typeof result.then === 'function', 'expected thenable');
    return result;
  }); })

  .then(function() { return test('saveDayData returns resolved Promise when cache missing', function() {
    var ctx = ts.setup({ schemaV2: true });
    var result = ctx.api.saveDayData('strength', new Date('2026-04-18T12:00:00'));
    assert.ok(result && typeof result.then === 'function');
    return result;
  }); })

  .then(function() { return test('saveTestData returns a Promise', function() {
    var ctx = ts.setup({ schemaV2: true });
    ctx.api.plans.tests = [{ name: 'X', section: 'strength' }];
    var result = ctx.api.saveTestData('2026-04-18', { X: 5 });
    assert.ok(result && typeof result.then === 'function');
    return result;
  }); })

  .then(function() { return test('v2: after saveDayData resolves, recalcSkill sees fresh data', function() {
    var ctx = ts.setup({ schemaV2: true });
    var pushups = pure_getSkill('pushups');
    ctx.api.cache.strength['2026-04-18'] = {
      plan: [{ name: 'Отжимания' }], type: 'upper', label: 'Верх',
      checks: { 'Отжимания': true }, values: { 'Отжимания': 10 }
    };
    return ctx.api.saveDayData('strength', new Date('2026-04-18T12:00:00'))
      .then(function() { return ctx.api.recalcSkill(pushups); })
      .then(function() {
        assert.strictEqual(ctx.api.skillTotals.pushups, 10);
        assert.strictEqual(
          ctx.mock.store['users/u1/sections/strength/skills/pushups'].totalReps, 10);
      });
  }); })

  .then(function() { return test('v2: after saveTestData resolves, recalcSkill for mountain sees Мабу', function() {
    var ctx = ts.setup({ schemaV2: true });
    global.userSections = ['wingchun'];
    ctx.api.plans.tests = [{ name: 'Мабу', unit: 'сек', section: 'wingchun' }];
    var mountain = pure_getSkill('mountain');
    return ctx.api.saveTestData('2026-04-18', { 'Мабу': 60 })
      .then(function() { return ctx.api.recalcSkill(mountain); })
      .then(function() {
        delete global.userSections;
        assert.strictEqual(ctx.api.skillTotals.mountain, 60);
        assert.strictEqual(
          ctx.mock.store['users/u1/sections/wingchun/skills/mountain'].totalSeconds, 60);
      });
  }); })




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
