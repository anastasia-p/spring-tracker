// test-editor.js — редактор показателей тестов (тонкий адаптер над modal-editor.js)
// Использование: openTestEditor({ section, sectionLabel, onSave })
// section — ключ документа в users/{uid}/plan/ (обычно 'tests')

var _teConfigCache = { value: null };

function _teLoadConfig(cb) { meLoadConfig(_teConfigCache, cb); }

// ─── Публичный API ────────────────────────────────────────────────────────────

function openTestEditor(opts) {
  // currentUser должен быть установлен (auth.js) — иначе ни db.js не сработает, ни onSave
  if (typeof currentUser === 'undefined' || !currentUser) return;

  var section      = opts.section || 'tests';
  var sectionLabel = opts.sectionLabel || 'Тесты';
  var onSave       = opts.onSave || function() {};

  // При section='tests' (общий редактор всех тестов) берём из plans.tests —
  // это уже агрегированный список из sections/*/tests/current с полем section у каждого
  var planPromise;
  if (section === 'tests') {
    planPromise = Promise.resolve(plans.tests || []);
  } else {
    planPromise = loadSectionTests(section);
  }
  var configPromise = new Promise(function(resolve) { _teLoadConfig(resolve); });

  Promise.all([planPromise, configPromise])
    .then(function(results) {
      var items  = JSON.parse(JSON.stringify(results[0] || []));
      var config = results[1];
      // Архив определений — дееp copy, чтобы локальные правки до "Сохранить" не
      // мутировали plans.archivedTests. Поддерживается только в общем редакторе
      // (section === 'tests'); per-section редактор работает по старой схеме.
      var archived = (section === 'tests' && plans.archivedTests)
        ? JSON.parse(JSON.stringify(plans.archivedTests))
        : [];
      _teOpen({
        section:       section,
        sectionLabel:  sectionLabel,
        items:         items,
        archivedTests: archived,
        config:        config,
        onSave:        onSave,
        mode:          'list',
        editIdx:       null,
        formData:      {},
        formEls:       null,
        dirty:         false
      });
    })
    .catch(function(e) { console.error('openTestEditor:', e); });
}

// ─── Открытие / рендер ────────────────────────────────────────────────────────

function _teOpen(state) {
  state.sheet = meOpen('te-overlay', 'te-sheet', function() { _teConfirmClose(state); });
  _teRender(state);
}

function _teRender(state) {
  var isForm = state.mode === 'form';
  var title  = isForm
    ? (state.editIdx === null ? 'Новый тест' : 'Редактировать')
    : 'Редактор тестов';

  meRender(state.sheet, {
    closeBtnId: 'te-close-btn',
    footerId:   'te-footer',
    saveBtnId:  'te-save-btn',
    subtitle:   state.sectionLabel,
    title:      title,
    isForm:     isForm,
    editIdx:    state.editIdx,
    onClose:    function() { _teConfirmClose(state); },
    onBack:     function() {
      state.mode = 'list'; state.editIdx = null; state.formData = {};
      _teRender(state);
    },
    onApply:    function() { _teApplyForm(state); },
    onSave:     function() { _teSave(state); },
    renderBody: function(body) {
      if (isForm) _teRenderForm(state, body);
      else        _teRenderList(state, body);
    }
  });
}

// ─── Список тестов ────────────────────────────────────────────────────────────

function _teRenderList(state, body) {
  var items = state.items;

  // Пустой список
  if (items.length === 0) {
    var empty = document.createElement('div');
    empty.textContent   = 'Тестов пока нет';
    empty.style.cssText = 'text-align:center;color:var(--text-hint);font-size:14px;padding:28px 0';
    body.appendChild(empty);
  }

  // Карточки тестов
  items.forEach(function(item, i) {
    var card = document.createElement('div');
    card.style.cssText = 'background:var(--bg);border-radius:10px;padding:10px 12px;margin-bottom:8px;display:flex;align-items:center;gap:8px';

    var info = document.createElement('div');
    info.style.cssText = 'flex:1;min-width:0;overflow:hidden';
    info.innerHTML =
      '<div style="font-size:14px;font-weight:500;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escapeHtml(item.name) + '</div>' +
      (item.note
        ? '<div style="font-size:12px;color:var(--text-muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escapeHtml(item.note) + '</div>'
        : '') +
      (item.unit
        ? '<div style="font-size:12px;color:var(--text-hint);margin-top:1px">' + escapeHtml(item.unit) + '</div>'
        : '');

    var btnEdit = meIconBtn('\u270F', 'Редактировать');
    btnEdit.onclick = (function(idx) {
      return function() {
        state.editIdx  = idx;
        state.formData = JSON.parse(JSON.stringify(state.items[idx]));
        state.mode     = 'form';
        _teRender(state);
      };
    })(i);

    var btnUp = meIconBtn('\u2191', 'Выше');
    if (i === 0) btnUp.style.visibility = 'hidden';
    btnUp.onclick = (function(idx) {
      return function() {
        var tmp = state.items[idx - 1];
        state.items[idx - 1] = state.items[idx];
        state.items[idx] = tmp;
        state.dirty = true;
        state.savedScrollTop = body.scrollTop;
        _teRender(state);
      };
    })(i);

    var btnDown = meIconBtn('\u2193', 'Ниже');
    if (i === items.length - 1) btnDown.style.visibility = 'hidden';
    btnDown.onclick = (function(idx) {
      return function() {
        var tmp = state.items[idx + 1];
        state.items[idx + 1] = state.items[idx];
        state.items[idx] = tmp;
        state.dirty = true;
        state.savedScrollTop = body.scrollTop;
        _teRender(state);
      };
    })(i);

    var btnDel = meIconBtn('\u2715', 'Удалить');
    btnDel.style.color = 'var(--red-dark)';
    btnDel.onclick = (function(idx) {
      return function() { _teHandleDelete(state, idx); };
    })(i);

    card.appendChild(info);
    card.appendChild(btnUp);
    card.appendChild(btnDown);
    card.appendChild(btnEdit);
    card.appendChild(btnDel);
    body.appendChild(card);
  });

  if (state.savedScrollTop != null) {
    body.scrollTop = state.savedScrollTop;
    state.savedScrollTop = null;
  }

  // Добавить
  var addBtn = document.createElement('button');
  addBtn.textContent   = '+ добавить тест';
  addBtn.style.cssText = [
    'width:100%;padding:10px;margin-top:4px',
    'border:1px dashed #ccc;border-radius:10px',
    'background:none;color:var(--text-muted);font-size:13px;cursor:pointer'
  ].join(';');
  addBtn.onclick = function() {
    state.editIdx  = null;
    state.formData = { name: '', note: '', unit: '' };
    // В общем редакторе дефолтная дисциплина — первая в списке активных
    if (state.section === 'tests') {
      var activeList = (typeof userSections !== 'undefined' && userSections) ? userSections : SECTIONS;
      state.formData.section = activeList[0] || 'strength';
    }
    state.mode = 'form';
    _teRender(state);
  };
  body.appendChild(addBtn);
}

// ─── Форма теста ──────────────────────────────────────────────────────────────

function _teRenderForm(state, body) {
  var fd     = state.formData;
  var units  = (state.config && state.config.units) || ['мин', 'сек', 'раз', 'км', 'кг'];
  var LIMITS = { name: 100, note: 200 };

  var nameEl = meInput(fd.name, 'Например: Баланс правая нога', LIMITS.name);
  meFieldWrap('Название *', nameEl, LIMITS.name, body);

  var noteEl = meInput(fd.note, 'Например: за 15 секунд', LIMITS.note);
  meFieldWrap('Примечание', noteEl, LIMITS.note, body);

  var unitWrap = document.createElement('div');
  unitWrap.style.marginBottom = '14px';
  var unitLbl = document.createElement('label');
  unitLbl.textContent   = 'Единица измерения';
  unitLbl.style.cssText = 'display:block;font-size:12px;color:var(--text-muted);margin-bottom:5px';
  var unitEl = meSelect(fd.unit, units);
  unitWrap.appendChild(unitLbl);
  unitWrap.appendChild(unitEl);
  body.appendChild(unitWrap);

  // Селектор секции — только когда редактор общий (section === 'tests')
  var sectionEl = null;
  if (state.section === 'tests') {
    var activeList = (typeof userSections !== 'undefined' && userSections) ? userSections : SECTIONS;
    var secOptions = activeList.map(function(s) {
      var meta = (typeof SECTION_META !== 'undefined' && SECTION_META[s]) ? SECTION_META[s] : null;
      return { value: s, label: meta ? meta.label : s };
    });
    var currentSec = fd.section || (activeList[0] || 'strength');
    var secWrap = document.createElement('div');
    secWrap.style.marginBottom = '14px';
    var secLbl = document.createElement('label');
    secLbl.textContent   = 'Дисциплина';
    secLbl.style.cssText = 'display:block;font-size:12px;color:var(--text-muted);margin-bottom:5px';
    sectionEl = meSelect(currentSec, secOptions);
    secWrap.appendChild(secLbl);
    secWrap.appendChild(sectionEl);
    body.appendChild(secWrap);
  }

  state.formEls = { name: nameEl, note: noteEl, unit: unitEl, section: sectionEl };
}

// ─── Применить форму → в список ───────────────────────────────────────────────

function _teApplyForm(state) {
  var els  = state.formEls;
  var name = els.name.value.trim();
  if (!name) { els.name.style.borderColor = 'var(--red)'; els.name.focus(); return; }

  var item = { name: name, unit: els.unit.value };
  var note = els.note.value.trim();
  if (note) item.note = note;
  // В v2 общем редакторе добавляем поле section (для последующего разноса в saveAllTests)
  if (els.section) item.section = els.section.value;

  if (state.editIdx === null) {
    state.items.push(item);
    // Возврат истории: если в архиве есть тест с такими же (name, section) —
    // удаляем из архива. Старые записи измерений (sections/*/tests/{year}/history)
    // в БД не трогаем — они автоматически "всплывут" в Активных тестах через cache.tests.
    if (state.section === 'tests' && item.section && state.archivedTests && state.archivedTests.length) {
      state.archivedTests = state.archivedTests.filter(function(a) {
        return !(a.name === item.name && a.section === item.section);
      });
    }
  } else {
    state.items[state.editIdx] = item;
  }
  state.dirty    = true;
  state.mode     = 'list';
  state.editIdx  = null;
  state.formData = {};
  _teRender(state);
}

// ─── Сохранение в Firestore ───────────────────────────────────────────────────

function _teSave(state) {
  var savePromise;
  if (state.section === 'tests') {
    // Общий редактор тестов: сохраняем И активные, И архив (один редактор владеет обоими)
    savePromise = Promise.all([
      saveAllTests(state.items),
      saveAllArchivedTests(state.archivedTests || [])
    ]);
  } else {
    // Per-section редактор: архив пока не поддерживаем (на практике не используется)
    savePromise = saveTests(state.section, state.items);
  }

  meSaveFeedback(
    'te-save-btn',
    savePromise,
    function() {
      // cache.tests содержит ЗНАЧЕНИЯ (за даты), а мы сохранили ОПРЕДЕЛЕНИЯ теста.
      // Поэтому cache.tests не трогаем — иначе галочки за сегодня сбросятся до перезагрузки.
      state.dirty = false;
      if (typeof plans !== 'undefined') {
        plans.tests = state.items;
        if (state.section === 'tests') plans.archivedTests = state.archivedTests || [];
      }
      state.onSave();
    },
    function(e) { console.error('_teSave:', e); }
  );
}

// ─── Закрыть ──────────────────────────────────────────────────────────────────

function _teConfirmClose(state) { meConfirmClose(state, _teClose); }
function _teClose() { var o = document.getElementById('te-overlay'); if (o) o.remove(); }

// ─── Удаление теста: с диалогом про "Прошлые тесты" ───────────────────────────

// Проверка наличия измерений у теста — синхронно по cache.tests.
// cache.tests склеивает значения всех активных секций по дате; при коллизии имён
// в разных секциях это даст false-positive, но дубликаты имён — известное ограничение
// модели (loadTestsCache перезаписывает поля при сборке).
function _teTestHasHistory(name) {
  if (typeof cache === 'undefined' || !cache.tests) return false;
  var dks = Object.keys(cache.tests);
  for (var i = 0; i < dks.length; i++) {
    if (cache.tests[dks[i]][name] != null) return true;
  }
  return false;
}

function _teHandleDelete(state, idx) {
  var item = state.items[idx];
  if (!item) return;

  // Архив поддерживается только в общем редакторе тестов. Per-section редактор —
  // прежнее поведение (на практике не используется).
  if (state.section !== 'tests') {
    if (!confirm('Удалить "' + item.name + '"?')) return;
    state.items.splice(idx, 1);
    state.dirty = true;
    _teRender(state);
    return;
  }

  // Нет измерений — простой confirm, без диалога про архив.
  if (!_teTestHasHistory(item.name)) {
    if (!confirm('Удалить "' + item.name + '"?')) return;
    state.items.splice(idx, 1);
    state.dirty = true;
    _teRender(state);
    return;
  }

  // Есть измерения — кастомный диалог "Отображать историю в Прошлых тестах?".
  _teShowArchiveDialog(function(choice) {
    if (choice === 'cancel') return;
    if (choice === 'show') {
      var copy = {};
      for (var k in item) copy[k] = item[k];
      copy.archivedAt = new Date().toISOString();
      // На случай повторного цикла "удалил → создал → удалил" — заменяем существующую
      // запись в архиве по ключу (name, section), чтобы не плодить дубликаты.
      state.archivedTests = (state.archivedTests || []).filter(function(a) {
        return !(a.name === item.name && a.section === item.section);
      });
      state.archivedTests.push(copy);
    }
    // 'hide' — определение не кладём в архив, в "Прошлых тестах" тест не показывается.
    // Сами измерения в БД остаются нетронутыми (никакие данные не удаляем).
    state.items.splice(idx, 1);
    state.dirty = true;
    _teRender(state);
  });
}

// Диалог "Отображать историю?" — три исхода: 'show' / 'hide' / 'cancel'.
// z-index 1100 — выше overlay редактора (modal-editor.js, обычно 1000-ый диапазон).
function _teShowArchiveDialog(callback) {
  var overlay = document.createElement('div');
  overlay.id = 'te-archive-dialog';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1100;'
    + 'display:flex;align-items:center;justify-content:center;padding:20px';
  overlay.innerHTML =
    '<div style="background:var(--card);border-radius:16px;padding:20px;width:320px;'
      + 'max-width:100%;box-shadow:0 8px 32px rgba(0,0,0,.18)">'
    +   '<div style="font-size:15px;font-weight:600;margin-bottom:10px;color:var(--text);line-height:1.35">'
    +     'Отображать историю измерений удаляемого теста?'
    +   '</div>'
    +   '<div style="font-size:13px;color:var(--text-muted);margin-bottom:18px;line-height:1.5">'
    +     'Она переместится в раздел «Прошлые тесты» и останется доступна для просмотра.'
    +   '</div>'
    +   '<div style="display:flex;flex-direction:column;gap:8px">'
    +     '<button id="te-arch-show" style="padding:10px;border:none;border-radius:8px;'
    +       'background:var(--green);color:var(--card);font-size:14px;font-weight:600;cursor:pointer">'
    +       'Отображать</button>'
    +     '<button id="te-arch-hide" style="padding:10px;border:1.5px solid var(--border-light);'
    +       'border-radius:8px;background:var(--card);color:var(--text);font-size:14px;cursor:pointer">'
    +       'Не отображать</button>'
    +     '<button id="te-arch-cancel" style="padding:10px;border:none;border-radius:8px;'
    +       'background:transparent;color:var(--text-muted);font-size:13px;cursor:pointer">'
    +       'Отмена</button>'
    +   '</div>'
    + '</div>';
  document.body.appendChild(overlay);

  function close() { var o = document.getElementById('te-archive-dialog'); if (o) o.remove(); }
  document.getElementById('te-arch-show').onclick   = function() { close(); callback('show'); };
  document.getElementById('te-arch-hide').onclick   = function() { close(); callback('hide'); };
  document.getElementById('te-arch-cancel').onclick = function() { close(); callback('cancel'); };
  overlay.onclick = function(e) { if (e.target === overlay) { close(); callback('cancel'); } };
}
