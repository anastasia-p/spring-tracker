// exercise-list.test.js — юнит-тесты для js/exercise-list.js
// Запуск: node tools/tests/exercise-list.test.js

var path = require('path');

// Моки для глобальных функций db.js, которые использует exercise-list.js.
// Должны быть в global ДО require — exercise-list.js обращается к ним по имени.
var _stored = [];
global.loadSectionExercisesList = function(section) {
  return Promise.resolve(_stored.slice());
};
global.saveExercisesList = function(section, items) {
  _stored = items.slice();
  return Promise.resolve();
};

// Импорт чистых функций из модуля.
var el = require(path.join(__dirname, '../../js/exercise-list.js'));

// ─── Test runner ─────────────────────────────────────────────────────────────

var passed = 0;
var failed = 0;
var currentGroup = '';

function group(name) {
  currentGroup = name;
  console.log('\n' + name + ':');
}

function ok(cond, msg) {
  if (cond) {
    passed++;
    console.log('  \u2713 ' + msg);
  } else {
    failed++;
    console.log('  \u2717 ' + msg);
  }
}

function eq(actual, expected, msg) {
  var a = JSON.stringify(actual);
  var b = JSON.stringify(expected);
  if (a === b) {
    passed++;
    console.log('  \u2713 ' + msg);
  } else {
    failed++;
    console.log('  \u2717 ' + msg);
    console.log('      ожидалось: ' + b);
    console.log('      получено:  ' + a);
  }
}

// ─── _elClean ────────────────────────────────────────────────────────────────

group('_elClean');

eq(
  el._elClean({ name: 'X' }),
  { name: 'X' },
  'без подчеркивания — без изменений'
);

eq(
  el._elClean({ name: 'X', _sourceKey: 'wingchun:0' }),
  { name: 'X' },
  'убирает _sourceKey'
);

eq(
  el._elClean({ name: 'X', desc: 'd', note: 'n', trackValue: true, unit: 'раз', _a: 1, _b: 2 }),
  { name: 'X', desc: 'd', note: 'n', trackValue: true, unit: 'раз' },
  'убирает все подчеркнутые, оставляет публичные'
);

eq(
  el._elClean({}),
  {},
  'пустой объект — пустой результат'
);

// ─── _elSort ─────────────────────────────────────────────────────────────────

group('_elSort');

eq(
  el._elSort([{ name: 'Бэ' }, { name: 'Ах' }, { name: 'Вэ' }]).map(function(x) { return x.name; }),
  ['Ах', 'Бэ', 'Вэ'],
  'кириллица по алфавиту'
);

eq(
  el._elSort([]).length,
  0,
  'пустой массив'
);

eq(
  el._elSort([{ name: 'X' }])[0].name,
  'X',
  'один элемент'
);

eq(
  el._elSort([{ name: 'b' }, { name: 'A' }, { name: 'c' }]).map(function(x) { return x.name; }),
  ['A', 'b', 'c'],
  'регистронезависимая сортировка'
);

// Не мутирует
var origArr = [{ name: 'Z' }, { name: 'A' }];
var sorted = el._elSort(origArr);
ok(origArr[0].name === 'Z' && sorted[0].name === 'A', 'не мутирует входной массив');

// Без поля name — не падает
eq(
  el._elSort([{ name: 'X' }, {}, { name: 'A' }]).map(function(x) { return x.name; }),
  [undefined, 'A', 'X'],
  'элементы без name идут первыми (пустая строка < любого)'
);

// ─── _elComputeMutation ──────────────────────────────────────────────────────

group('_elComputeMutation');

var m1 = el._elComputeMutation([], { name: 'A' });
ok(m1.action === 'add', 'пустой список — action=add');
eq(m1.items, [{ name: 'A' }], 'пустой список — items с новым элементом');

var m2 = el._elComputeMutation([{ name: 'X' }], { name: 'Y' });
ok(m2.action === 'add', 'новое имя — action=add');
eq(m2.items.length, 2, 'новое имя — items длиннее на 1');
eq(m2.items[1], { name: 'Y' }, 'новое имя — добавляется в конец');

var existing = [{ name: 'X' }, { name: 'Y' }, { name: 'Z' }];
var m3 = el._elComputeMutation(existing, { name: 'Y', desc: 'new' });
ok(m3.action === 'duplicate', 'совпадение по name — action=duplicate');
ok(m3.dupIndex === 1, 'duplicate — корректный индекс');

// Не мутирует
var orig = [{ name: 'X' }];
el._elComputeMutation(orig, { name: 'Y' });
eq(orig, [{ name: 'X' }], 'не мутирует входной массив');

// ─── addExerciseToList — асинхронно ──────────────────────────────────────────

group('addExerciseToList');

function resetStore(items) { _stored = (items || []).slice(); }

// Запускаем тесты последовательно через promise chain.
Promise.resolve()
  .then(function() {
    // 1) добавление в пустой
    resetStore([]);
    return el.addExerciseToList('wingchun', { name: 'A', desc: 'd' }).then(function(r) {
      ok(r.status === 'added', 'пустой список → status=added');
      eq(_stored, [{ name: 'A', desc: 'd' }], 'упражнение сохранено');
    });
  })
  .then(function() {
    // 2) добавление при наличии других имен
    resetStore([{ name: 'A' }, { name: 'B' }]);
    return el.addExerciseToList('wingchun', { name: 'C' }).then(function(r) {
      ok(r.status === 'added', 'новое имя → status=added');
      eq(_stored.length, 3, 'размер вырос');
      eq(_stored[2], { name: 'C' }, 'новый элемент в конце');
    });
  })
  .then(function() {
    // 3) добавление без name → cancelled (защита)
    resetStore([]);
    return el.addExerciseToList('wingchun', { desc: 'no name' }).then(function(r) {
      ok(r.status === 'cancelled', 'упражнение без name → cancelled');
      eq(_stored, [], 'ничего не сохранено');
    });
  })
  .then(function() {
    // 4) чистка _ полей при сохранении
    resetStore([]);
    return el.addExerciseToList('wingchun', { name: 'A', _sourceKey: 'x', desc: 'd' }).then(function(r) {
      ok(r.status === 'added', 'добавилось');
      eq(_stored, [{ name: 'A', desc: 'd' }], 'без _sourceKey в БД');
    });
  })
  .then(function() {
    console.log('\nИтог: ' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch(function(e) {
    console.error('Ошибка теста:', e);
    process.exit(1);
  });
