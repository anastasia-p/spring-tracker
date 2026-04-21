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
      _teOpen({
        section:      section,
        sectionLabel: sectionLabel,
        items:        items,
        config:       config,
        onSave:       onSave,
        mode:         'list',
        editIdx:      null,
        formData:     {},
        formEls:      null,
        dirty:        false
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
    empty.style.cssText = 'text-align:center;color:#bbb;font-size:14px;padding:28px 0';
    body.appendChild(empty);
  }

  // Карточки тестов
  items.forEach(function(item, i) {
    var card = document.createElement('div');
    card.style.cssText = 'background:#f8f8f6;border-radius:10px;padding:10px 12px;margin-bottom:8px;display:flex;align-items:center;gap:8px';

    var info = document.createElement('div');
    info.style.cssText = 'flex:1;min-width:0;overflow:hidden';
    info.innerHTML =
      '<div style="font-size:14px;font-weight:500;color:#222;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escapeHtml(item.name) + '</div>' +
      (item.note
        ? '<div style="font-size:12px;color:#999;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escapeHtml(item.note) + '</div>'
        : '') +
      (item.unit
        ? '<div style="font-size:12px;color:#bbb;margin-top:1px">' + escapeHtml(item.unit) + '</div>'
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
    btnDel.style.color = '#c0392b';
    btnDel.onclick = (function(idx) {
      return function() {
        if (confirm('Удалить "' + state.items[idx].name + '"?')) {
          state.items.splice(idx, 1);
          state.dirty = true;
          _teRender(state);
        }
      };
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
    'background:none;color:#999;font-size:13px;cursor:pointer'
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
  unitLbl.style.cssText = 'display:block;font-size:12px;color:#999;margin-bottom:5px';
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
    secLbl.style.cssText = 'display:block;font-size:12px;color:#999;margin-bottom:5px';
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
  if (!name) { els.name.style.borderColor = '#e24b4a'; els.name.focus(); return; }

  var item = { name: name, unit: els.unit.value };
  var note = els.note.value.trim();
  if (note) item.note = note;
  // В v2 общем редакторе добавляем поле section (для последующего разноса в saveAllTests)
  if (els.section) item.section = els.section.value;

  if (state.editIdx === null) state.items.push(item);
  else                        state.items[state.editIdx] = item;
  state.dirty    = true;
  state.mode     = 'list';
  state.editIdx  = null;
  state.formData = {};
  _teRender(state);
}

// ─── Сохранение в Firestore ───────────────────────────────────────────────────

function _teSave(state) {
  var savePromise = (state.section === 'tests')
    ? saveAllTests(state.items)
    : saveTests(state.section, state.items);

  meSaveFeedback(
    'te-save-btn',
    savePromise,
    function() {
      // cache.tests содержит ЗНАЧЕНИЯ (за даты), а мы сохранили ОПРЕДЕЛЕНИЯ теста.
      // Поэтому cache.tests не трогаем — иначе галочки за сегодня сбросятся до перезагрузки.
      state.dirty = false;
      if (typeof plans !== 'undefined') plans.tests = state.items;
      state.onSave();
    },
    function(e) { console.error('_teSave:', e); }
  );
}

// ─── Закрыть ──────────────────────────────────────────────────────────────────

function _teConfirmClose(state) { meConfirmClose(state, _teClose); }
function _teClose() { var o = document.getElementById('te-overlay'); if (o) o.remove(); }
