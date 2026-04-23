// Тесты для db.js в текущем (legacy) виде.
// Цель — зафиксировать как работают функции сейчас,
// чтобы при рефакторинге не сломать legacy-ветку.
//
// Запуск: node tools/tests/db.test.js

'use strict';
var assert = require('assert');
var ts = require('./db-test-setup');

var passed = 0, failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(' ✓', name);
    passed++;
  } catch (e) {
    console.error(' ✗', name);
    console.error('  ', e.stack || e.message);
    failed++;
  } finally {
    ts.teardown();
  }
}

function group(name) { console.log('\n' + name); }

// ─── userCol ─────────────────────────────────────────────────────────────────

async function runTests() {
  // ─── userCol ─────────────────────────────────────────────────────────────

  group('userCol');

  await test('userCol returns users/{uid}/{name} ref', function() {
    var ctx = ts.setup();
    var ref = ctx.api.userCol('strength');
    assert.strictEqual(ref.path, 'users/u1/strength');
  });

  // ─── loadDayData ─────────────────────────────────────────────────────────

  group('loadDayData');

  await test('returns empty shape if doc missing and no plan', function() {
    var ctx = ts.setup();
    return ctx.api.loadDayData('strength', new Date('2026-04-18T12:00:00')).then(function(d) {
      assert.deepStrictEqual(d.checks, {});
      assert.deepStrictEqual(d.values, {});
      assert.deepStrictEqual(d.plan, []);
      assert.strictEqual(d.type, 'rest');
    });
  });

  await test('uses plan from plans[section] when doc missing', function() {
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
  });

  // ─── saveDayData ─────────────────────────────────────────────────────────

  group('saveDayData');

  await test('does nothing if cache entry missing', function() {
    var ctx = ts.setup();
    ctx.api.saveDayData('strength', new Date('2026-04-18T12:00:00'));
    return Promise.resolve().then(function() {
      assert.strictEqual(ctx.mock.log.length, 0);
    });
  });

  // ─── saveTestData ────────────────────────────────────────────────────────

  group('saveTestData');

  await test('writes values to sections/{section}/tests/{YYYY}/history/{date}', function() {
    var ctx = ts.setup();
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
  });

  await test('items without section fall into strength', function() {
    var ctx = ts.setup();
    ctx.api.plans.tests = [{ name: 'Custom', unit: 'раз' }];
    ctx.api.saveTestData('2026-04-18', { 'Custom': 5 });
    return Promise.resolve().then(function() {
      assert.deepStrictEqual(
        ctx.mock.store['users/u1/sections/strength/tests/2026/history/2026-04-18'],
        { 'Custom': 5 });
    });
  });

  await test('removing a value re-writes section doc without it', function() {
    var ctx = ts.setup({
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
  });

  await test('clearing all values in a section writes empty doc', function() {
    var ctx = ts.setup({
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
  });

  // ─── loadSkill ───────────────────────────────────────────────────────────

  group('loadSkill');

  await test('returns 0 if skill doc missing', function() {
    var ctx = ts.setup();
    var skill = pure_getSkill('pushups');
    return ctx.api.loadSkill(skill).then(function() {
      assert.strictEqual(ctx.api.skillTotals.pushups, 0);
    });
  });

  await test('reads sections/{section}/skills/{skill.id}', function() {
    var ctx = ts.setup({
      seed: { 'users/u1/sections/strength/skills/pushups': { totalReps: 500 } }
    });
    var skill = pure_getSkill('pushups');
    return ctx.api.loadSkill(skill).then(function() {
      assert.strictEqual(ctx.api.skillTotals.pushups, 500);
    });
  });

  await test('mountain lives under wingchun section', function() {
    var ctx = ts.setup({
      seed: { 'users/u1/sections/wingchun/skills/mountain': { totalSeconds: 9000 } }
    });
    var skill = pure_getSkill('mountain');
    return ctx.api.loadSkill(skill).then(function() {
      assert.strictEqual(ctx.api.skillTotals.mountain, 9000);
    });
  });

  // ─── recalcSkill ─────────────────────────────────────────────────────────

  group('recalcSkill');

  await test('sums from plan history and writes to sections/.../skills/', function() {
    var ctx = ts.setup({
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
  });

  await test('mountain sums from wingchun history AND wingchun tests history', function() {
    var ctx = ts.setup({
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
  });

  // ─── findSkillByName ─────────────────────────────────────────────────────

  group('findSkillByName');

  await test('finds pushups by "Отжимания" (single field)', function() {
    var ctx = ts.setup();
    var s = ctx.api.findSkillByName('Отжимания');
    assert.strictEqual(s.id, 'pushups');
  });

  await test('finds mountain by "Мабу" (fields array)', function() {
    var ctx = ts.setup();
    var s = ctx.api.findSkillByName('Мабу');
    assert.strictEqual(s.id, 'mountain');
  });

  await test('returns null for unknown name', function() {
    var ctx = ts.setup();
    assert.strictEqual(ctx.api.findSkillByName('Не существует'), null);
  });

  // ─── calcDailyStreak ─────────────────────────────────────────────────────

  group('calcDailyStreak');

  await test('empty section → streak 0', function() {
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
  });

  await test('streak counts partially done days', function() {
    var ctx = ts.setup({ config: { createdAt: '2026-04-15T00:00:00.000Z' } });
    ctx.mock.seed('users/u1/sections/strength/plan/2026/history/2026-04-16', {
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
  });

  await test('streak breaks on day with plan but no checks', function() {
    var ctx = ts.setup({ config: { createdAt: '2026-04-10T00:00:00.000Z' } });
    ctx.mock.seed('users/u1/sections/strength/plan/2026/history/2026-04-16', {
      plan: [{ name: 'A' }],
      checks: { A: true }
    });
    ctx.mock.seed('users/u1/sections/strength/plan/2026/history/2026-04-15', {
      plan: [{ name: 'B' }],
      checks: {} // ничего не сделано
    });
    ctx.mock.seed('users/u1/sections/strength/plan/2026/history/2026-04-14', {
      plan: [{ name: 'C' }],
      checks: { C: true }
    });
    var origDate = Date;
    global.Date = fakeDate('2026-04-17T12:00:00');
    return ctx.api.calcDailyStreak('strength').then(function(streak) {
      global.Date = origDate;
      assert.strictEqual(streak, 1); // только 16-е, 15-е разрывает
    });
  });

  await test('cache hit returns without DB call', function() {
    var ctx = ts.setup();
    ctx.api.streakCache.strength = 42;
    return ctx.api.calcDailyStreak('strength').then(function(streak) {
      assert.strictEqual(streak, 42);
      // Не должно быть GET_COLL
      var gets = ctx.mock.log.filter(function(op) { return op[0] === 'GET_COLL'; });
      assert.strictEqual(gets.length, 0);
    });
  });

  await test('invalidateStreakCache clears cache', function() {
    var ctx = ts.setup();
    ctx.api.streakCache.strength = 42;
    ctx.api.invalidateStreakCache('strength');
    assert.strictEqual(ctx.api.streakCache.strength, undefined);
  });

  // ─── resetCache ──────────────────────────────────────────────────────────

  group('resetCache');

  await test('clears cache[section]', function() {
    var ctx = ts.setup();
    ctx.api.cache.strength['2026-04-01'] = { foo: 1 };
    ctx.api.resetCache('strength');
    assert.deepStrictEqual(ctx.api.cache.strength, {});
  });

  // ─── loadAllSkills ───────────────────────────────────────────────────────

  group('loadAllSkills');

  await test('loads every skill in SKILLS', function() {
    var ctx = ts.setup({
      seed: {
        'users/u1/sections/strength/skills/pushups': { totalReps: 100 },
        'users/u1/sections/qigong/skills/tree':      { totalMinutes: 50 },
      }
    });
    return ctx.api.loadAllSkills().then(function() {
      assert.strictEqual(ctx.api.skillTotals.pushups, 100);
      assert.strictEqual(ctx.api.skillTotals.tree, 50);
      // Остальные навыки = 0
      assert.strictEqual(ctx.api.skillTotals.pullups, 0);
      assert.strictEqual(ctx.api.skillTotals.mountain, 0);
    });
  });

  // ============================================================
  // V2-специфичные тесты (пути, агрегация по секциям)
  // ============================================================

  // ─── loadPlanFromFirebase ────────────────────────────────────────────────

  group('loadPlanFromFirebase');

  await test('reads sections/{section}/plan/current.days', function() {
    var days = [{ day: 'Пн' }];
    var ctx = ts.setup({
      seed: { 'users/u1/sections/strength/plan/current': { days: days } }
    });
    return ctx.api.loadPlanFromFirebase('strength').then(function() {
      assert.deepStrictEqual(ctx.api.plans.strength, days);
    });
  });

  await test('tests aggregates from all active sections', function() {
    var ctx = ts.setup({
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
  });

  // ─── loadDayData: v2-specific path ───────────────────────────────────────

  group('loadDayData: v2 path');

  await test('reads sections/{section}/plan/{YYYY}/history/{date}', function() {
    var ctx = ts.setup({
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
  });

  // ─── saveDayData: v2-specific path ───────────────────────────────────────

  group('saveDayData: v2 path');

  await test('writes sections/{section}/plan/{YYYY}/history/{date}', function() {
    var ctx = ts.setup();
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
  });

  // ─── loadTestsCache ──────────────────────────────────────────────────────

  group('loadTestsCache');

  await test('merges tests history from all active sections by date', function() {
    var ctx = ts.setup({
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
  });

  // ─── listYearsToRead ─────────────────────────────────────────────────────

  group('listYearsToRead');

  await test('returns [createdYear..currentYear]', function() {
    var ctx = ts.setup({
      config: { createdAt: '2025-08-12T00:00:00.000Z' }
    });
    var origDate = Date;
    global.Date = fakeDate('2026-04-19T12:00:00');
    var years = ctx.api.listYearsToRead();
    global.Date = origDate;
    assert.deepStrictEqual(years, ['2025', '2026']);
  });

  await test('returns single year when created this year', function() {
    var ctx = ts.setup({
      config: { createdAt: '2026-03-01T00:00:00.000Z' }
    });
    var origDate = Date;
    global.Date = fakeDate('2026-04-19T12:00:00');
    var years = ctx.api.listYearsToRead();
    global.Date = origDate;
    assert.deepStrictEqual(years, ['2026']);
  });

  // ─── API layer: loadConfig / saveConfig ──────────────────────────────────

  group('API: loadConfig / saveConfig');

  await test('loadConfig returns config data', function() {
    var ctx = ts.setup({ config: { sections: ['strength', 'wingchun'] } });
    return ctx.api.loadConfig().then(function(cfg) {
      assert.deepStrictEqual(cfg.sections, ['strength', 'wingchun']);
    });
  });

  await test('saveConfig merges with existing', function() {
    var ctx = ts.setup({ config: { sections: ['strength'], email: 'a@b.c' } });
    return ctx.api.saveConfig({ sections: ['strength', 'wingchun'] })
      .then(function() {
        var stored = ctx.mock.store['users/u1'];
        assert.deepStrictEqual(stored.sections, ['strength', 'wingchun']);
        assert.strictEqual(stored.email, 'a@b.c'); // сохранилось
      });
  });

  // ─── API layer: loadSectionPlan / savePlan ───────────────────────────────

  group('API: loadSectionPlan / savePlan');

  await test('v2 loadSectionPlan reads sections/{section}/plan/current.days', function() {
    var days = [{ day: 'Пн' }];
    var ctx = ts.setup({
      seed: { 'users/u1/sections/strength/plan/current': { days: days } }
    });
    return ctx.api.loadSectionPlan('strength').then(function(d) {
      assert.deepStrictEqual(d, days);
    });
  });

  await test('v2 savePlan writes sections/{section}/plan/current', function() {
    var ctx = ts.setup();
    var days = [{ day: 'Пн' }];
    return ctx.api.savePlan('strength', days).then(function() {
      var stored = ctx.mock.store['users/u1/sections/strength/plan/current'];
      assert.deepStrictEqual(stored.days, days);
      assert.ok(stored.updatedAt);
    });
  });

  // ─── API layer: loadSectionTests / saveTests ─────────────────────────────

  group('API: loadSectionTests / saveTests');

  await test('v2 loadSectionTests reads sections/{section}/tests/current', function() {
    var items = [{ name: 'Отжимания', unit: 'раз' }];
    var ctx = ts.setup({
      seed: { 'users/u1/sections/strength/tests/current': { items: items } }
    });
    return ctx.api.loadSectionTests('strength').then(function(i) {
      assert.deepStrictEqual(i, items);
    });
  });

  await test('v2 saveTests writes sections/{section}/tests/current', function() {
    var ctx = ts.setup();
    var items = [{ name: 'Отжимания', unit: 'раз' }];
    return ctx.api.saveTests('strength', items).then(function() {
      var stored = ctx.mock.store['users/u1/sections/strength/tests/current'];
      assert.deepStrictEqual(stored.items, items);
      assert.ok(stored.updatedAt);
    });
  });

  // ─── API layer: createSectionDefaults ────────────────────────────────────

  group('API: createSectionDefaults');

  await test('v2 creates plan/default, plan/current, tests/default, tests/current', function() {
    var ctx = ts.setup();
    var days = [{ day: 'Пн' }];
    var items = [{ name: 'Мабу', unit: 'сек' }];
    return ctx.api.createSectionDefaults('wingchun', days, items).then(function() {
      var base = 'users/u1/sections/wingchun/';
      assert.deepStrictEqual(ctx.mock.store[base + 'plan/default'], { days: days });
      assert.deepStrictEqual(ctx.mock.store[base + 'plan/current'].days, days);
      assert.deepStrictEqual(ctx.mock.store[base + 'tests/default'], { items: items });
      assert.deepStrictEqual(ctx.mock.store[base + 'tests/current'].items, items);
    });
  });

  await test('v2 creates empty tests when testsItems null', function() {
    var ctx = ts.setup();
    return ctx.api.createSectionDefaults('brain', [], null).then(function() {
      var base = 'users/u1/sections/brain/';
      assert.deepStrictEqual(ctx.mock.store[base + 'tests/default'], { items: [] });
      assert.deepStrictEqual(ctx.mock.store[base + 'tests/current'].items, []);
    });
  });

  // ─── API layer: enableSection / disableSection ───────────────────────────

  group('API: enableSection / disableSection');

  await test('v2 enableSection sets enabled=true and syncs config', function() {
    var ctx = ts.setup({
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
  });

  await test('v2 disableSection sets enabled=false and removes from config', function() {
    var ctx = ts.setup({
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
  });

  // ─── API layer: saveAllTests ─────────────────────────────────────────────

  group('API: saveAllTests');

  await test('v2 saveAllTests spreads items across sections by item.section', function() {
    var ctx = ts.setup();
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
  });

  await test('v2 saveAllTests empties active sections without items', function() {
    var ctx = ts.setup();
    global.userSections = ['strength', 'qigong'];
    var items = [{ name: 'X', section: 'strength' }];
    return ctx.api.saveAllTests(items).then(function() {
      delete global.userSections;
      var qi = ctx.mock.store['users/u1/sections/qigong/tests/current'];
      assert.deepStrictEqual(qi.items, []);
    });
  });

  await test('v2 saveAllTests does not touch inactive sections', function() {
    var ctx = ts.setup({
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
  });

  // ─── Promise contracts (защита от race conditions) ──────────────────────

  group('Promise contracts');

  await test('saveDayData returns a Promise', function() {
    var ctx = ts.setup();
    ctx.api.cache.strength['2026-04-18'] = {
      plan: [], type: 'rest', label: '', checks: {}, values: {}
    };
    var result = ctx.api.saveDayData('strength', new Date('2026-04-18T12:00:00'));
    assert.ok(result, 'expected return value');
    assert.ok(typeof result.then === 'function', 'expected thenable');
    return result;
  });

  await test('saveDayData returns resolved Promise when cache missing', function() {
    var ctx = ts.setup();
    var result = ctx.api.saveDayData('strength', new Date('2026-04-18T12:00:00'));
    assert.ok(result && typeof result.then === 'function');
    return result;
  });

  await test('saveTestData returns a Promise', function() {
    var ctx = ts.setup();
    ctx.api.plans.tests = [{ name: 'X', section: 'strength' }];
    var result = ctx.api.saveTestData('2026-04-18', { X: 5 });
    assert.ok(result && typeof result.then === 'function');
    return result;
  });

  await test('v2: after saveDayData resolves, recalcSkill sees fresh data', function() {
    var ctx = ts.setup();
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
  });

  await test('v2: after saveTestData resolves, recalcSkill for mountain sees Мабу', function() {
    var ctx = ts.setup();
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
  });

  await test('v2: parallel recalcSkill calls serialize — last wins', function() {
    // Баг: поставил значение и сразу снял. Два recalcSkill параллельно.
    // Должно быть сериализовано — последний вызов победит.
    var ctx = ts.setup();
    var pushups = pure_getSkill('pushups');
    var date = new Date('2026-04-18T12:00:00');

    ctx.api.cache.strength['2026-04-18'] = {
      plan: [{ name: 'Отжимания' }], type: 'upper', label: 'Верх',
      checks: { 'Отжимания': true }, values: { 'Отжимания': 100 }
    };
    var save1 = ctx.api.saveDayData('strength', date);
    var recalc1 = save1.then(function() { return ctx.api.recalcSkill(pushups); });

    ctx.api.cache.strength['2026-04-18'] = {
      plan: [{ name: 'Отжимания' }], type: 'upper', label: 'Верх',
      checks: { 'Отжимания': false }, values: { 'Отжимания': 0 }
    };
    var save2 = ctx.api.saveDayData('strength', date);
    var recalc2 = save2.then(function() { return ctx.api.recalcSkill(pushups); });

    return Promise.all([recalc1, recalc2]).then(function() {
      assert.strictEqual(
        ctx.mock.store['users/u1/sections/strength/skills/pushups'].totalReps, 0);
      assert.strictEqual(ctx.api.skillTotals.pushups, 0);
    });
  });

  // ─── adjustSkillTotal (инкрементальное обновление) ──────────────────────

  group('adjustSkillTotal');

  await test('adjustSkillTotal adds delta and persists', function() {
    var ctx = ts.setup();
    var pushups = pure_getSkill('pushups');
    ctx.api.skillTotals.pushups = 100;
    return ctx.api.adjustSkillTotal(pushups, 25).then(function() {
      assert.strictEqual(ctx.api.skillTotals.pushups, 125);
      assert.strictEqual(
        ctx.mock.store['users/u1/sections/strength/skills/pushups'].totalReps, 125);
    });
  });

  await test('adjustSkillTotal subtracts correctly', function() {
    var ctx = ts.setup();
    var pushups = pure_getSkill('pushups');
    ctx.api.skillTotals.pushups = 100;
    return ctx.api.adjustSkillTotal(pushups, -30).then(function() {
      assert.strictEqual(ctx.api.skillTotals.pushups, 70);
    });
  });

  await test('adjustSkillTotal never goes below zero', function() {
    var ctx = ts.setup();
    var pushups = pure_getSkill('pushups');
    ctx.api.skillTotals.pushups = 10;
    return ctx.api.adjustSkillTotal(pushups, -50).then(function() {
      assert.strictEqual(ctx.api.skillTotals.pushups, 0);
    });
  });

  await test('adjustSkillTotal with 0 delta is no-op', function() {
    var ctx = ts.setup();
    var pushups = pure_getSkill('pushups');
    ctx.api.skillTotals.pushups = 42;
    return ctx.api.adjustSkillTotal(pushups, 0).then(function() {
      assert.strictEqual(ctx.api.skillTotals.pushups, 42);
      // Нет записи в базу — не должно быть в логе операций SET
      var sets = ctx.mock.log.filter(function(op) { return op[0] === 'SET' && op[1].indexOf('skills/pushups') !== -1; });
      assert.strictEqual(sets.length, 0);
    });
  });

  await test('adjustSkillTotal parallel calls do not race', function() {
    // Ключевой тест: много быстрых вызовов подряд — результат детерминирован
    // потому что функция не читает из базы
    var ctx = ts.setup();
    var pushups = pure_getSkill('pushups');
    ctx.api.skillTotals.pushups = 0;
    return Promise.all([
      ctx.api.adjustSkillTotal(pushups, 100),   // 0 → 100
      ctx.api.adjustSkillTotal(pushups, -100),  // 100 → 0
      ctx.api.adjustSkillTotal(pushups, 200),   // 0 → 200
      ctx.api.adjustSkillTotal(pushups, -200),  // 200 → 0
    ]).then(function() {
      assert.strictEqual(ctx.api.skillTotals.pushups, 0);
      assert.strictEqual(
        ctx.mock.store['users/u1/sections/strength/skills/pushups'].totalReps, 0);
    });
  });






  // ─── updateExerciseCheck ─────────────────────────────────────────────────

  group('updateExerciseCheck');

  await test('set checked with value: writes cache, DB, skill', function() {
    var ctx = ts.setup();
    ctx.api.cache.strength['2026-04-15'] = {
      plan: [{ name: 'Отжимания' }], type: 'upper', label: 'Верх',
      checks: {}, values: {}
    };
    ctx.api.skillTotals.pushups = 0;
    return ctx.api.updateExerciseCheck('strength', '2026-04-15', 'Отжимания', true, 20).then(function() {
      var day = ctx.api.cache.strength['2026-04-15'];
      assert.strictEqual(day.checks['Отжимания'], true);
      assert.strictEqual(day.values['Отжимания'], 20);
      assert.strictEqual(ctx.api.skillTotals.pushups, 20);
      var stored = ctx.mock.store['users/u1/sections/strength/plan/2026/history/2026-04-15'];
      assert.ok(stored);
      assert.strictEqual(stored.checks['Отжимания'], true);
      assert.strictEqual(stored.values['Отжимания'], 20);
      assert.strictEqual(
        ctx.mock.store['users/u1/sections/strength/skills/pushups'].totalReps, 20);
    });
  });

  await test('unset with value=0: rolls skill back by oldVal', function() {
    var ctx = ts.setup();
    ctx.api.cache.strength['2026-04-15'] = {
      plan: [{ name: 'Отжимания' }], type: 'upper', label: 'Верх',
      checks: { 'Отжимания': true }, values: { 'Отжимания': 30 }
    };
    ctx.api.skillTotals.pushups = 100;
    return ctx.api.updateExerciseCheck('strength', '2026-04-15', 'Отжимания', false, 0).then(function() {
      var day = ctx.api.cache.strength['2026-04-15'];
      assert.strictEqual(day.checks['Отжимания'], false);
      assert.strictEqual(day.values['Отжимания'], 0);
      assert.strictEqual(ctx.api.skillTotals.pushups, 70);
    });
  });

  await test('without value arg: checks updated, values untouched, skill no-op', function() {
    var ctx = ts.setup();
    ctx.api.cache.qigong['2026-04-15'] = {
      plan: [{ name: 'Разминка' }], type: 'qi', label: 'Цигун',
      checks: {}, values: { 'Разминка': 5 }
    };
    ctx.api.skillTotals.tree = 42;
    return ctx.api.updateExerciseCheck('qigong', '2026-04-15', 'Разминка', true).then(function() {
      var day = ctx.api.cache.qigong['2026-04-15'];
      assert.strictEqual(day.checks['Разминка'], true);
      assert.strictEqual(day.values['Разминка'], 5);
      assert.strictEqual(ctx.api.skillTotals.tree, 42);
    });
  });

  await test('cache miss: returns resolved promise, no writes', function() {
    var ctx = ts.setup();
    var logBefore = ctx.mock.log.length;
    return ctx.api.updateExerciseCheck('strength', '2026-04-15', 'Отжимания', true, 10).then(function() {
      assert.strictEqual(ctx.mock.log.length, logBefore);
    });
  });

  await test('exercise without skill: updates day, skill not touched', function() {
    var ctx = ts.setup();
    ctx.api.cache.strength['2026-04-15'] = {
      plan: [{ name: 'Разведение гантелей' }], type: 'upper', label: 'Верх',
      checks: {}, values: {}
    };
    return ctx.api.updateExerciseCheck('strength', '2026-04-15', 'Разведение гантелей', true, 12).then(function() {
      var day = ctx.api.cache.strength['2026-04-15'];
      assert.strictEqual(day.checks['Разведение гантелей'], true);
      assert.strictEqual(day.values['Разведение гантелей'], 12);
      var skillWrites = ctx.mock.log.filter(function(op) {
        return op[0] === 'SET' && op[1].indexOf('/skills/') !== -1;
      });
      assert.strictEqual(skillWrites.length, 0);
    });
  });

  await test('invalidates streak cache for section', function() {
    var ctx = ts.setup();
    ctx.api.cache.strength['2026-04-15'] = {
      plan: [{ name: 'Отжимания' }], type: 'upper', label: 'Верх',
      checks: {}, values: {}
    };
    ctx.api.streakCache.strength = 5;
    return ctx.api.updateExerciseCheck('strength', '2026-04-15', 'Отжимания', true, 10).then(function() {
      assert.strictEqual(ctx.api.streakCache.strength, undefined);
    });
  });

  await test('sequential toggles: skill total stays consistent', function() {
    var ctx = ts.setup();
    ctx.api.cache.strength['2026-04-15'] = {
      plan: [{ name: 'Отжимания' }], type: 'upper', label: 'Верх',
      checks: {}, values: { 'Отжимания': 0 }
    };
    ctx.api.skillTotals.pushups = 0;
    return ctx.api.updateExerciseCheck('strength', '2026-04-15', 'Отжимания', true, 10)
      .then(function() {
        assert.strictEqual(ctx.api.skillTotals.pushups, 10);
        return ctx.api.updateExerciseCheck('strength', '2026-04-15', 'Отжимания', true, 25);
      })
      .then(function() {
        assert.strictEqual(ctx.api.skillTotals.pushups, 25);
        return ctx.api.updateExerciseCheck('strength', '2026-04-15', 'Отжимания', false, 0);
      })
      .then(function() {
        assert.strictEqual(ctx.api.skillTotals.pushups, 0);
      });
  });

  // ─── updateTestValue ─────────────────────────────────────────────────────

  group('updateTestValue');

  await test('numeric set: updates cache, DB, skill via findSkillByName', function() {
    var ctx = ts.setup();
    ctx.api.plans.tests = [{ name: 'Отжимания', section: 'strength', unit: 'раз' }];
    ctx.api.skillTotals.pushups = 0;
    return ctx.api.updateTestValue('2026-04-15', 'Отжимания', 35).then(function() {
      assert.strictEqual(ctx.api.cache.tests['2026-04-15']['Отжимания'], 35);
      assert.strictEqual(ctx.api.skillTotals.pushups, 35);
      var stored = ctx.mock.store['users/u1/sections/strength/tests/2026/history/2026-04-15'];
      assert.ok(stored);
      assert.strictEqual(stored['Отжимания'], 35);
    });
  });

  await test('null value: deletes field, rolls skill back', function() {
    var ctx = ts.setup();
    ctx.api.plans.tests = [{ name: 'Отжимания', section: 'strength', unit: 'раз' }];
    ctx.api.cache.tests['2026-04-15'] = { 'Отжимания': 40 };
    ctx.api.skillTotals.pushups = 100;
    return ctx.api.updateTestValue('2026-04-15', 'Отжимания', null).then(function() {
      assert.strictEqual(ctx.api.cache.tests['2026-04-15']['Отжимания'], undefined);
      assert.strictEqual(ctx.api.skillTotals.pushups, 60);
    });
  });

  await test('text value: cache updated, skill not touched', function() {
    var ctx = ts.setup();
    ctx.api.plans.tests = [{ name: 'Темп бега', section: 'cardio', unit: 'мин/км', type: 'text' }];
    ctx.api.skillTotals.pushups = 50;
    return ctx.api.updateTestValue('2026-04-15', 'Темп бега', '6:30').then(function() {
      assert.strictEqual(ctx.api.cache.tests['2026-04-15']['Темп бега'], '6:30');
      assert.strictEqual(ctx.api.skillTotals.pushups, 50);
    });
  });

  await test('no skill matching name: cache updated, nothing else', function() {
    var ctx = ts.setup();
    ctx.api.plans.tests = [{ name: 'Пульс покоя', section: 'cardio', unit: 'уд/мин' }];
    return ctx.api.updateTestValue('2026-04-15', 'Пульс покоя', 62).then(function() {
      assert.strictEqual(ctx.api.cache.tests['2026-04-15']['Пульс покоя'], 62);
      var skillWrites = ctx.mock.log.filter(function(op) {
        return op[0] === 'SET' && op[1].indexOf('/skills/') !== -1;
      });
      assert.strictEqual(skillWrites.length, 0);
    });
  });

  await test('replacing value: skill delta computed from old to new', function() {
    var ctx = ts.setup();
    ctx.api.plans.tests = [{ name: 'Отжимания', section: 'strength', unit: 'раз' }];
    ctx.api.cache.tests['2026-04-15'] = { 'Отжимания': 20 };
    ctx.api.skillTotals.pushups = 20;
    return ctx.api.updateTestValue('2026-04-15', 'Отжимания', 35).then(function() {
      assert.strictEqual(ctx.api.cache.tests['2026-04-15']['Отжимания'], 35);
      assert.strictEqual(ctx.api.skillTotals.pushups, 35);
    });
  });

  // ─── applyDayOverride ────────────────────────────────────────────────────

  group('applyDayOverride');

  await test('null override: возвращает исходный массив без изменений', function() {
    var ctx = ts.setup();
    var base = [{ name: 'Отжимания' }, { name: 'Планка' }];
    var result = ctx.api.applyDayOverride(base, null);
    assert.strictEqual(result, base);
  });

  await test('removed: убирает упражнение из списка', function() {
    var ctx = ts.setup();
    var base = [{ name: 'Отжимания' }, { name: 'Планка' }];
    var result = ctx.api.applyDayOverride(base, { removed: ['Планка'], added: [], modified: [] });
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, 'Отжимания');
  });

  await test('added: добавляет упражнение в конец списка', function() {
    var ctx = ts.setup();
    var base = [{ name: 'Отжимания' }];
    var extra = { name: 'Берпи', trackValue: false };
    var result = ctx.api.applyDayOverride(base, { removed: [], added: [extra], modified: [] });
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[1].name, 'Берпи');
  });

  await test('modified: заменяет упражнение с тем же именем', function() {
    var ctx = ts.setup();
    var base = [{ name: 'Отжимания', note: '3x12' }, { name: 'Планка' }];
    var mod  = { name: 'Отжимания', note: '4x10' };
    var result = ctx.api.applyDayOverride(base, { removed: [], added: [], modified: [mod] });
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].note, '4x10');
    assert.strictEqual(result[1].name, 'Планка');
  });

  await test('removed + added применяются вместе', function() {
    var ctx = ts.setup();
    var base = [{ name: 'Отжимания' }, { name: 'Планка' }];
    var result = ctx.api.applyDayOverride(base, { removed: ['Планка'], added: [{ name: 'Берпи' }], modified: [] });
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].name, 'Отжимания');
    assert.strictEqual(result[1].name, 'Берпи');
    assert.ok(!result.find(function(e) { return e.name === 'Планка'; }));
  });

  // ─── computeDayOverride ──────────────────────────────────────────────────

  group('computeDayOverride');

  await test('нет изменений → null', function() {
    var ctx = ts.setup();
    var exs = [{ name: 'Отжимания' }, { name: 'Планка' }];
    var result = ctx.api.computeDayOverride(exs, exs);
    assert.strictEqual(result, null);
  });

  await test('удалённое упражнение попадает в removed', function() {
    var ctx = ts.setup();
    var template = [{ name: 'Отжимания' }, { name: 'Планка' }];
    var edited   = [{ name: 'Отжимания' }];
    var result = ctx.api.computeDayOverride(template, edited);
    assert.ok(result !== null);
    assert.deepStrictEqual(result.removed, ['Планка']);
    assert.strictEqual(result.added.length, 0);
    assert.strictEqual(result.modified.length, 0);
  });

  await test('новое упражнение попадает в added', function() {
    var ctx = ts.setup();
    var template = [{ name: 'Отжимания' }];
    var edited   = [{ name: 'Отжимания' }, { name: 'Берпи', trackValue: false }];
    var result = ctx.api.computeDayOverride(template, edited);
    assert.ok(result !== null);
    assert.strictEqual(result.added.length, 1);
    assert.strictEqual(result.added[0].name, 'Берпи');
    assert.strictEqual(result.removed.length, 0);
    assert.strictEqual(result.modified.length, 0);
  });

  await test('изменённое упражнение попадает в modified', function() {
    var ctx = ts.setup();
    var template = [{ name: 'Отжимания', note: '3x12' }];
    var edited   = [{ name: 'Отжимания', note: '4x10' }];
    var result = ctx.api.computeDayOverride(template, edited);
    assert.ok(result !== null);
    assert.strictEqual(result.modified.length, 1);
    assert.strictEqual(result.modified[0].note, '4x10');
    assert.strictEqual(result.added.length, 0);
    assert.strictEqual(result.removed.length, 0);
  });

  await test('removed и added вычисляются вместе', function() {
    var ctx = ts.setup();
    var template = [{ name: 'Отжимания' }, { name: 'Планка' }];
    var edited   = [{ name: 'Отжимания' }, { name: 'Берпи' }];
    var result = ctx.api.computeDayOverride(template, edited);
    assert.deepStrictEqual(result.removed, ['Планка']);
    assert.strictEqual(result.added[0].name, 'Берпи');
  });

  // ─── saveDayData: dayOverride ─────────────────────────────────────────────

  group('saveDayData: dayOverride');

  await test('пишет dayOverride в документ когда задан в кеше', function() {
    var ctx = ts.setup();
    var override = { added: [{ name: 'Берпи' }], removed: ['Планка'] };
    ctx.api.cache.strength['2026-04-18'] = {
      plan: [{ name: 'Берпи' }], dayOverride: override,
      type: 'rest', label: 'Отдых', checks: {}, values: {}
    };
    return ctx.api.saveDayData('strength', new Date('2026-04-18T12:00:00')).then(function() {
      var p = 'users/u1/sections/strength/plan/2026/history/2026-04-18';
      assert.ok(ctx.mock.store[p]);
      assert.deepStrictEqual(ctx.mock.store[p].dayOverride, override);
    });
  });

  await test('не добавляет поле dayOverride если его нет в кеше', function() {
    var ctx = ts.setup();
    ctx.api.cache.strength['2026-04-18'] = {
      plan: [{ name: 'Отжимания' }],
      type: 'rest', label: 'Отдых', checks: {}, values: {}
      // dayOverride намеренно отсутствует
    };
    return ctx.api.saveDayData('strength', new Date('2026-04-18T12:00:00')).then(function() {
      var p = 'users/u1/sections/strength/plan/2026/history/2026-04-18';
      assert.ok(ctx.mock.store[p]);
      assert.ok(!('dayOverride' in ctx.mock.store[p]), 'dayOverride не должен попасть в документ');
    });
  });


  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
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

runTests().catch(function(e) { console.error(e); process.exit(1); });
