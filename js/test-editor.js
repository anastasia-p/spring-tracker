// test-editor.js — редактор показателей тестов (независимый модуль)
// Использование: openTestEditor({ section, sectionLabel, onSave })
// section — ключ документа в users/{uid}/plan/ (обычно 'tests')

var _teConfigCache = null;

function _teLoadConfig(cb) {
  if (_teConfigCache) { cb(_teConfigCache); return; }
  fetch(API_URL + '/config')
    .then(function(r) { return r.json(); })
    .then(function(d) { _teConfigCache = d; cb(d); })
    .catch(function() {
      cb({ units: ['мин', 'сек', 'раз', 'км', 'кг'] });
    });
}

// ─── Публичный API ────────────────────────────────────────────────────────────

function openTestEditor(opts) {
  var uid = firebase.auth().currentUser && firebase.auth().currentUser.uid;
  if (!uid) return;

  var section      = opts.section || 'tests';
  var sectionLabel = opts.sectionLabel || 'Тесты';
  var onSave       = opts.onSave || function() {};

  // В v2 при section='tests' (общий редактор всех тестов) берём из plans.tests —
  // это уже агрегированный список из sections/*/tests/current с полем section у каждого
  var planPromise;
  if (section === 'tests' && isSchemaV2()) {
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
        uid:          uid,
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

// ─── Открытие ─────────────────────────────────────────────────────────────────

function _teOpen(state) {
  _teClose();

  var overlay = document.createElement('div');
  overlay.id = 'te-overlay';
  overlay.style.cssText = [
    'position:fixed;top:0;left:0;right:0;bottom:0',
    'background:rgba(0,0,0,0.5)',
    'z-index:9000',
    'display:flex;align-items:flex-end;justify-content:center'
  ].join(';');
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) _teConfirmClose(state);
  });

  var sheet = document.createElement('div');
  sheet.id = 'te-sheet';
  sheet.style.cssText = [
    'background:#fff',
    'border-radius:16px 16px 0 0',
    'width:100%;max-width:480px',
    'max-height:85vh',
    'display:flex;flex-direction:column',
    'overflow:hidden'
  ].join(';');

  overlay.appendChild(sheet);
  document.body.appendChild(overlay);

  state.sheet = sheet;
  _teRender(state);
}

// ─── Рендер модалки ───────────────────────────────────────────────────────────

function _teRender(state) {
  var sheet  = state.sheet;
  sheet.innerHTML = '';

  var isForm = state.mode === 'form';
  var title  = isForm
    ? (state.editIdx === null ? 'Новый тест' : 'Редактировать')
    : 'Редактор тестов';

  // Заголовок
  var header = document.createElement('div');
  header.style.cssText = 'padding:16px 20px 12px;border-bottom:0.5px solid #e5e5e5;display:flex;align-items:center;justify-content:space-between;flex-shrink:0';
  header.innerHTML =
    '<div>' +
      '<div style="font-size:12px;color:#999;margin-bottom:2px">' + state.sectionLabel + '</div>' +
      '<div style="font-size:16px;font-weight:500;color:#222">' + title + '</div>' +
    '</div>' +
    '<button id="te-close-btn" style="background:none;border:none;font-size:22px;color:#aaa;cursor:pointer;padding:2px 8px;line-height:1">×</button>';
  sheet.appendChild(header);
  document.getElementById('te-close-btn').onclick = function() { _teConfirmClose(state); };

  // Тело
  var body = document.createElement('div');
  body.style.cssText = 'flex:1;overflow-y:auto;padding:12px 20px;-webkit-overflow-scrolling:touch';
  sheet.appendChild(body);

  if (isForm) {
    _teRenderForm(state, body);
  } else {
    _teRenderList(state, body);
  }

  // Нижняя панель
  var footer = document.createElement('div');
  footer.id = 'te-footer';
  footer.style.cssText = 'padding:12px 20px;border-top:0.5px solid #e5e5e5;display:flex;gap:8px;flex-shrink:0';
  sheet.appendChild(footer);

  if (isForm) {
    var btnBack = _teBtn('Назад', 'secondary');
    btnBack.onclick = function() {
      state.mode     = 'list';
      state.editIdx  = null;
      state.formData = {};
      _teRender(state);
    };
    var btnApply = _teBtn(state.editIdx === null ? 'Добавить' : 'Применить', 'primary');
    btnApply.onclick = function() { _teApplyForm(state); };
    footer.appendChild(btnBack);
    footer.appendChild(btnApply);
  } else {
    var btnClose = _teBtn('Закрыть', 'secondary');
    btnClose.onclick = function() { _teConfirmClose(state); };
    var btnSave = _teBtn('Сохранить', 'primary');
    btnSave.id = 'te-save-btn';
    btnSave.onclick = function() { _teSave(state); };
    footer.appendChild(btnClose);
    footer.appendChild(btnSave);
  }
}

// ─── Список тестов ────────────────────────────────────────────────────────────

function _teRenderList(state, body) {
  var items = state.items;

  // Пустой список
  if (items.length === 0) {
    var empty = document.createElement('div');
    empty.textContent = 'Тестов пока нет';
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
      '<div style="font-size:14px;font-weight:500;color:#222;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + item.name + '</div>' +
      (item.note
        ? '<div style="font-size:12px;color:#999;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + item.note + '</div>'
        : '') +
      (item.unit
        ? '<div style="font-size:12px;color:#bbb;margin-top:1px">' + item.unit + '</div>'
        : '');

    var btnEdit = _teIconBtn('✏', 'Редактировать');
    btnEdit.onclick = (function(idx) {
      return function() {
        state.editIdx  = idx;
        state.formData = JSON.parse(JSON.stringify(state.items[idx]));
        state.mode     = 'form';
        _teRender(state);
      };
    })(i);

    var btnUp = _teIconBtn('↑', 'Выше');
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

    var btnDown = _teIconBtn('↓', 'Ниже');
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

    var btnDel = _teIconBtn('✕', 'Удалить');
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
  addBtn.textContent = '+ добавить тест';
  addBtn.style.cssText = [
    'width:100%;padding:10px;margin-top:4px',
    'border:1px dashed #ccc;border-radius:10px',
    'background:none;color:#999;font-size:13px;cursor:pointer'
  ].join(';');
  addBtn.onclick = function() {
    state.editIdx  = null;
    state.formData = { name: '', note: '', unit: '' };
    // В v2 общем редакторе дефолтная дисциплина — первая в списке активных
    if (state.section === 'tests' && typeof isSchemaV2 === 'function' && isSchemaV2()) {
      var activeList = (typeof userSections !== 'undefined' && userSections) ? userSections : SECTIONS;
      state.formData.section = activeList[0] || 'strength';
    }
    state.mode     = 'form';
    _teRender(state);
  };
  body.appendChild(addBtn);
}

// ─── Форма теста ──────────────────────────────────────────────────────────────

function _teRenderForm(state, body) {
  var fd     = state.formData;
  var units  = (state.config && state.config.units) || ['мин', 'сек', 'раз', 'км', 'кг'];
  var LIMITS = { name: 100, note: 200 };

  function makeInput(val, placeholder, maxLen) {
    var el = document.createElement('input');
    el.type        = 'text';
    el.value       = val || '';
    el.placeholder = placeholder || '';
    if (maxLen) el.maxLength = maxLen;
    el.style.cssText = [
      'width:100%;box-sizing:border-box',
      'padding:10px 12px',
      'border:0.5px solid #ddd;border-radius:10px',
      'font-size:14px;color:#222;background:#fff',
      'outline:none'
    ].join(';');
    el.addEventListener('focus', function() { this.style.borderColor = '#1D9E75'; });
    el.addEventListener('blur',  function() { this.style.borderColor = '#ddd'; });
    return el;
  }

  function makeSelect(val, options) {
    var el = document.createElement('select');
    el.style.cssText = [
      'width:100%;box-sizing:border-box',
      'padding:10px 36px 10px 12px',
      'border:0.5px solid #ddd;border-radius:10px',
      'font-size:14px;color:#222',
      'outline:none;cursor:pointer',
      'appearance:none;-webkit-appearance:none',
      'background:#fff url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23999%27 stroke-width=%272%27%3E%3Cpolyline points=%276 9 12 15 18 9%27/%3E%3C/svg%3E") no-repeat right 12px center'
    ].join(';');
    el.addEventListener('focus', function() { this.style.borderColor = '#1D9E75'; });
    el.addEventListener('blur',  function() { this.style.borderColor = '#ddd'; });
    options.forEach(function(u) {
      var opt = document.createElement('option');
      opt.value = opt.textContent = u;
      if (u === val) opt.selected = true;
      el.appendChild(opt);
    });
    return el;
  }

  function fieldWrap(labelText, el, maxLen) {
    var wrap = document.createElement('div');
    wrap.style.marginBottom = '14px';

    var hdr = document.createElement('div');
    hdr.style.cssText = 'display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px';

    var lbl = document.createElement('label');
    lbl.textContent = labelText;
    lbl.style.cssText = 'font-size:12px;color:#999';
    hdr.appendChild(lbl);

    if (maxLen) {
      var counter   = document.createElement('span');
      var threshold = Math.floor(maxLen * 0.8);
      function updateCounter() {
        var len       = el.value.length;
        var remaining = maxLen - len;
        counter.textContent = len >= threshold ? remaining + ' / ' + maxLen : '';
        counter.style.color = remaining <= 10 ? '#e24b4a' : '#bbb';
      }
      updateCounter();
      el.addEventListener('input', updateCounter);
      counter.style.cssText = 'font-size:11px;min-width:48px;text-align:right';
      hdr.appendChild(counter);
    }

    wrap.appendChild(hdr);
    wrap.appendChild(el);
    body.appendChild(wrap);
  }

  var nameEl = makeInput(fd.name, 'Например: Баланс правая нога', LIMITS.name);
  fieldWrap('Название *', nameEl, LIMITS.name);

  var noteEl = makeInput(fd.note, 'Например: за 15 секунд', LIMITS.note);
  fieldWrap('Примечание', noteEl, LIMITS.note);

  var unitWrap = document.createElement('div');
  unitWrap.style.marginBottom = '14px';
  var unitLbl = document.createElement('label');
  unitLbl.textContent = 'Единица измерения';
  unitLbl.style.cssText = 'display:block;font-size:12px;color:#999;margin-bottom:5px';
  var unitEl = makeSelect(fd.unit, units);
  unitWrap.appendChild(unitLbl);
  unitWrap.appendChild(unitEl);
  body.appendChild(unitWrap);

  // Селектор секции — только в v2, и только когда редактор общий (section === 'tests')
  var sectionEl = null;
  if (state.section === 'tests' && typeof isSchemaV2 === 'function' && isSchemaV2()) {
    var secWrap = document.createElement('div');
    secWrap.style.marginBottom = '14px';
    var secLbl = document.createElement('label');
    secLbl.textContent = 'Дисциплина';
    secLbl.style.cssText = 'display:block;font-size:12px;color:#999;margin-bottom:5px';
    // Варианты — активные секции с человеческими подписями
    var options = [];
    var activeList = (typeof userSections !== 'undefined' && userSections) ? userSections : SECTIONS;
    activeList.forEach(function(s) {
      var meta = (typeof SECTION_META !== 'undefined' && SECTION_META[s]) ? SECTION_META[s] : null;
      options.push({ value: s, label: meta ? meta.label : s });
    });
    var sel = document.createElement('select');
    sel.style.cssText = [
      'width:100%;box-sizing:border-box',
      'padding:10px 36px 10px 12px',
      'border:0.5px solid #ddd;border-radius:10px',
      'font-size:14px;color:#222',
      'outline:none;cursor:pointer',
      'appearance:none;-webkit-appearance:none',
      'background:#fff url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23999%27 stroke-width=%272%27%3E%3Cpolyline points=%276 9 12 15 18 9%27/%3E%3C/svg%3E") no-repeat right 12px center'
    ].join(';');
    var currentSec = fd.section || (activeList[0] || 'strength');
    options.forEach(function(opt) {
      var o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      if (opt.value === currentSec) o.selected = true;
      sel.appendChild(o);
    });
    secWrap.appendChild(secLbl);
    secWrap.appendChild(sel);
    body.appendChild(secWrap);
    sectionEl = sel;
  }

  state.formEls = { name: nameEl, note: noteEl, unit: unitEl, section: sectionEl };
}

// ─── Применить форму → в список ───────────────────────────────────────────────

function _teApplyForm(state) {
  var els  = state.formEls;
  var name = els.name.value.trim();
  if (!name) {
    els.name.style.borderColor = '#e24b4a';
    els.name.focus();
    return;
  }

  var item = { name: name, unit: els.unit.value };
  var note = els.note.value.trim();
  if (note) item.note = note;
  // В v2 общем редакторе добавляем поле section (для последующего разноса в saveAllTests)
  if (els.section) item.section = els.section.value;

  if (state.editIdx === null) {
    state.items.push(item);
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
  var btn = document.getElementById('te-save-btn');
  if (btn) {
    btn.style.width  = btn.offsetWidth  + 'px';
    btn.style.height = btn.offsetHeight + 'px';
    btn.disabled     = true;
    btn.textContent  = 'Сохранение...';
  }

  var savePromise = (state.section === 'tests')
    ? saveAllTests(state.items)
    : saveTests(state.section, state.items);
  savePromise
    .then(function() {
      if (typeof resetCache === 'function') resetCache('tests');
      state.dirty = false;
      if (typeof plans !== 'undefined') plans.tests = state.items;
      state.onSave();
      if (btn) {
        btn.disabled         = false;
        btn.textContent      = 'Сохранено ✓';
        btn.style.background = '#0F6E56';
        setTimeout(function() {
          if (btn) {
            btn.textContent      = 'Сохранить';
            btn.style.background = '#1D9E75';
            btn.style.width      = '';
            btn.style.height     = '';
          }
        }, 2000);
      }
    })
    .catch(function(e) {
      console.error('_teSave:', e);
      alert('Ошибка при сохранении');
      if (btn) {
        btn.disabled    = false;
        btn.textContent = 'Сохранить';
        btn.style.width = '';
        btn.style.height = '';
      }
    });
}

// ─── Закрыть ──────────────────────────────────────────────────────────────────

function _teConfirmClose(state) {
  if (state && state.dirty) {
    if (!confirm('Есть несохраненные изменения. Выйти без сохранения?')) return;
  }
  _teClose();
}

function _teClose() {
  var overlay = document.getElementById('te-overlay');
  if (overlay) overlay.remove();
}

// ─── Вспомогательные элементы ─────────────────────────────────────────────────

function _teBtn(text, type) {
  var btn = document.createElement('button');
  if (type === 'primary') {
    btn.style.cssText = 'flex:1;padding:11px;min-height:42px;border:none;border-radius:10px;background:#1D9E75;color:#fff;font-size:14px;font-weight:500;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1';
  } else {
    btn.style.cssText = 'flex:1;padding:11px;border:0.5px solid #ccc;border-radius:10px;background:none;color:#555;font-size:14px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center';
  }
  btn.textContent = text;
  return btn;
}

function _teIconBtn(icon, title) {
  var btn = document.createElement('button');
  btn.textContent = icon;
  btn.title       = title;
  btn.style.cssText = [
    'background:none',
    'border:0.5px solid #e0e0e0',
    'border-radius:8px',
    'padding:5px 9px',
    'font-size:13px;color:#888',
    'cursor:pointer;flex-shrink:0',
    'display:inline-flex;align-items:center;justify-content:center'
  ].join(';');
  return btn;
}
