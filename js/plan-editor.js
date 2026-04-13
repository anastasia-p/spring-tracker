// plan-editor.js — редактор упражнений дня (независимый модуль)
// Использование: openPlanEditor({ section, dayIndex, sectionLabel, onSave })

var _planEditorClipboard = null; // { name, desc, note, trackValue, unit }
var _peConfigCache = null;

function _peLoadConfig(cb) {
  if (_peConfigCache) { cb(_peConfigCache); return; }
  fetch(API_URL + '/config')
    .then(function(r) { return r.json(); })
    .then(function(d) { _peConfigCache = d; cb(d); })
    .catch(function() {
      cb({ units: ['мин', 'сек', 'раз', 'км', 'кг'], dayTypes: [] });
    });
}

// ─── Публичный API ────────────────────────────────────────────────────────────

function openPlanEditor(opts) {
  var uid = firebase.auth().currentUser && firebase.auth().currentUser.uid;
  if (!uid) return;

  var section      = opts.section;
  var dayIndex     = opts.dayIndex;
  var sectionLabel = opts.sectionLabel || section;
  var onSave       = opts.onSave || function() {};

  var planPromise   = firebase.firestore()
    .collection('users').doc(uid)
    .collection('plan').doc(section)
    .get();
  var configPromise = new Promise(function(resolve) { _peLoadConfig(resolve); });

  Promise.all([planPromise, configPromise])
    .then(function(results) {
      var snap   = results[0];
      var config = results[1];
      if (!snap.exists) { alert('План не найден'); return; }
      var allDays = snap.data().days || [];
      var day     = allDays[dayIndex] || {};
      var dayName = day.day || ('День ' + (dayIndex + 1));
      var exs     = JSON.parse(JSON.stringify(day.exercises || []));

      _peOpen({
        uid:          uid,
        section:      section,
        sectionLabel: sectionLabel,
        dayIndex:     dayIndex,
        dayName:      dayName,
        allDays:      allDays,
        exercises:    exs,
        dayType:      day.type || 'rest',
        config:       config,
        onSave:       onSave,
        mode:         'list',
        editIdx:      null,
        formData:     {},
        formEls:      null
      });
    })
    .catch(function(e) { console.error('openPlanEditor:', e); });
}

// ─── Открытие ─────────────────────────────────────────────────────────────────

function _peOpen(state) {
  _peClose();

  var overlay = document.createElement('div');
  overlay.id = 'pe-overlay';
  overlay.style.cssText = [
    'position:fixed;top:0;left:0;right:0;bottom:0',
    'background:rgba(0,0,0,0.5)',
    'z-index:9000',
    'display:flex;align-items:flex-end;justify-content:center'
  ].join(';');
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) _peClose();
  });

  var sheet = document.createElement('div');
  sheet.id = 'pe-sheet';
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
  _peRender(state);
}

// ─── Рендер модалки ───────────────────────────────────────────────────────────

function _peRender(state) {
  var sheet  = state.sheet;
  sheet.innerHTML = '';

  var isForm = state.mode === 'form';
  var title  = isForm
    ? (state.editIdx === null ? 'Новое упражнение' : 'Редактировать')
    : 'Редактор плана';

  // Заголовок
  var header = document.createElement('div');
  header.style.cssText = 'padding:16px 20px 12px;border-bottom:0.5px solid #e5e5e5;display:flex;align-items:center;justify-content:space-between;flex-shrink:0';
  header.innerHTML =
    '<div>' +
      '<div style="font-size:12px;color:#999;margin-bottom:2px">' + state.sectionLabel + ' — ' + state.dayName + '</div>' +
      '<div style="font-size:16px;font-weight:500;color:#222">' + title + '</div>' +
    '</div>' +
    '<button id="pe-close-btn" style="background:none;border:none;font-size:22px;color:#aaa;cursor:pointer;padding:2px 8px;line-height:1">×</button>';
  sheet.appendChild(header);
  document.getElementById('pe-close-btn').onclick = _peClose;

  // Тело
  var body = document.createElement('div');
  body.style.cssText = 'flex:1;overflow-y:auto;padding:12px 20px;-webkit-overflow-scrolling:touch';
  sheet.appendChild(body);

  if (isForm) {
    _peRenderForm(state, body);
  } else {
    _peRenderList(state, body);
  }

  // Нижняя панель
  var footer = document.createElement('div');
  footer.id = 'pe-footer';
  footer.style.cssText = 'padding:12px 20px;border-top:0.5px solid #e5e5e5;display:flex;gap:8px;flex-shrink:0';
  sheet.appendChild(footer);

  if (isForm) {
    var btnBack = _peBtn('Назад', 'secondary');
    btnBack.onclick = function() {
      state.mode     = 'list';
      state.editIdx  = null;
      state.formData = {};
      _peRender(state);
    };
    var btnApply = _peBtn(state.editIdx === null ? 'Добавить' : 'Применить', 'primary');
    btnApply.onclick = function() { _peApplyForm(state); };
    footer.appendChild(btnBack);
    footer.appendChild(btnApply);
  } else {
    var btnClose = _peBtn('Закрыть', 'secondary');
    btnClose.onclick = _peClose;
    var btnSave = _peBtn('Сохранить', 'primary');
    btnSave.id = 'pe-save-btn';
    btnSave.onclick = function() { _peSave(state); };
    footer.appendChild(btnClose);
    footer.appendChild(btnSave);
  }
}

// ─── Список упражнений ────────────────────────────────────────────────────────

function _peRenderList(state, body) {
  var exs = state.exercises;

  // Тип дня
  var dayTypes = (state.config && state.config.dayTypes) || [];
  if (dayTypes.length > 0) {
    var typeWrap = document.createElement('div');
    typeWrap.style.cssText = 'margin-bottom:14px';
    var typeLbl = document.createElement('label');
    typeLbl.textContent = 'Тип дня';
    typeLbl.style.cssText = 'display:block;font-size:12px;color:#999;margin-bottom:5px';
    var typeSelect = document.createElement('select');
    typeSelect.style.cssText = [
      'width:100%;box-sizing:border-box',
      'padding:10px 12px',
      'border:0.5px solid #ddd;border-radius:10px',
      'font-size:14px;color:#222;background:#fff',
      'outline:none;cursor:pointer'
    ].join(';');
    dayTypes.forEach(function(dt) {
      var opt = document.createElement('option');
      opt.value       = dt.type;
      opt.textContent = dt.label;
      if (dt.type === state.dayType) opt.selected = true;
      typeSelect.appendChild(opt);
    });
    typeSelect.addEventListener('focus', function() { this.style.borderColor = '#1D9E75'; });
    typeSelect.addEventListener('blur',  function() { this.style.borderColor = '#ddd'; });
    typeSelect.onchange = function() { state.dayType = this.value; };
    typeWrap.appendChild(typeLbl);
    typeWrap.appendChild(typeSelect);
    body.appendChild(typeWrap);

    var divider = document.createElement('div');
    divider.style.cssText = 'border-top:0.5px solid #f0f0f0;margin-bottom:12px';
    body.appendChild(divider);
  }

  // Кнопка вставить
  if (_planEditorClipboard) {
    var clipName  = _planEditorClipboard.name;
    var shortName = clipName.length > 26 ? clipName.slice(0, 26) + '…' : clipName;
    var pasteBtn  = document.createElement('button');
    pasteBtn.textContent = 'Вставить: ' + shortName;
    pasteBtn.style.cssText = [
      'width:100%;padding:9px 12px;margin-bottom:10px',
      'border:1px dashed #1D9E75;border-radius:10px',
      'background:none;color:#1D9E75;font-size:13px',
      'cursor:pointer;text-align:left'
    ].join(';');
    pasteBtn.onclick = function() {
      state.exercises.push(JSON.parse(JSON.stringify(_planEditorClipboard)));
      _peRender(state);
    };
    body.appendChild(pasteBtn);
  }

  // Пустой список
  if (exs.length === 0) {
    var empty = document.createElement('div');
    empty.textContent = 'Упражнений пока нет';
    empty.style.cssText = 'text-align:center;color:#bbb;font-size:14px;padding:28px 0';
    body.appendChild(empty);
  }

  // Карточки упражнений
  exs.forEach(function(ex, i) {
    var item = document.createElement('div');
    item.style.cssText = 'background:#f8f8f6;border-radius:10px;padding:10px 12px;margin-bottom:8px;display:flex;align-items:center;gap:8px';

    var info = document.createElement('div');
    info.style.cssText = 'flex:1;min-width:0;overflow:hidden';
    info.innerHTML =
      '<div style="font-size:14px;font-weight:500;color:#222;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + ex.name + '</div>' +
      (ex.note ? '<div style="font-size:12px;color:#999;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + ex.note + '</div>' : '');

    var btnCopy = _peIconBtn('⎘', 'Копировать');
    btnCopy.onclick = (function(idx) {
      return function() {
        _planEditorClipboard = JSON.parse(JSON.stringify(state.exercises[idx]));
        _peRender(state);
      };
    })(i);

    var btnEdit = _peIconBtn('✏', 'Редактировать');
    btnEdit.onclick = (function(idx) {
      return function() {
        state.editIdx  = idx;
        state.formData = JSON.parse(JSON.stringify(state.exercises[idx]));
        state.mode     = 'form';
        _peRender(state);
      };
    })(i);

    var btnDel = _peIconBtn('✕', 'Удалить');
    btnDel.style.color = '#c0392b';
    btnDel.onclick = (function(idx) {
      return function() {
        if (confirm('Удалить "' + state.exercises[idx].name + '"?')) {
          state.exercises.splice(idx, 1);
          _peRender(state);
        }
      };
    })(i);

    item.appendChild(info);
    item.appendChild(btnCopy);
    item.appendChild(btnEdit);
    item.appendChild(btnDel);
    body.appendChild(item);
  });

  // Добавить
  var addBtn = document.createElement('button');
  addBtn.textContent = '+ добавить упражнение';
  addBtn.style.cssText = [
    'width:100%;padding:10px;margin-top:4px',
    'border:1px dashed #ccc;border-radius:10px',
    'background:none;color:#999;font-size:13px;cursor:pointer'
  ].join(';');
  addBtn.onclick = function() {
    state.editIdx  = null;
    state.formData = { name: '', desc: '', note: '', trackValue: false, unit: '' };
    state.mode     = 'form';
    _peRender(state);
  };
  body.appendChild(addBtn);
}

// ─── Форма упражнения ─────────────────────────────────────────────────────────

function _peRenderForm(state, body) {
  var fd     = state.formData;
  var units  = (state.config && state.config.units) || ['мин', 'сек', 'раз', 'км', 'кг'];
  var LIMITS = { name: 100, desc: 200, note: 200 };

  function makeInput(val, placeholder, maxLen) {
    var el = document.createElement('input');
    el.type = 'text';
    el.value = val || '';
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
      'padding:10px 12px',
      'border:0.5px solid #ddd;border-radius:10px',
      'font-size:14px;color:#222;background:#fff',
      'outline:none;cursor:pointer'
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

  var nameEl = makeInput(fd.name, 'Например: Приседания', LIMITS.name);
  fieldWrap('Название *', nameEl, LIMITS.name);

  var descEl = makeInput(fd.desc, 'Например: Ноги на ширине плеч', LIMITS.desc);
  fieldWrap('Описание', descEl, LIMITS.desc);

  var noteEl = makeInput(fd.note, 'Например: 3 подхода по 12 повторений', LIMITS.note);
  fieldWrap('Заметка', noteEl, LIMITS.note);

  // Трекер значения
  var trackWrap = document.createElement('div');
  trackWrap.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:14px';

  var trackChk = document.createElement('input');
  trackChk.type    = 'checkbox';
  trackChk.checked = !!fd.trackValue;
  trackChk.id      = 'pe-track-chk';
  trackChk.style.cssText = 'width:16px;height:16px;cursor:pointer;accent-color:#1D9E75';

  var trackLbl = document.createElement('label');
  trackLbl.htmlFor     = 'pe-track-chk';
  trackLbl.textContent = 'Считать результат (вводить число)';
  trackLbl.style.cssText = 'font-size:14px;color:#444;cursor:pointer';

  trackWrap.appendChild(trackChk);
  trackWrap.appendChild(trackLbl);
  body.appendChild(trackWrap);

  var unitWrap = document.createElement('div');
  unitWrap.style.cssText = 'margin-bottom:14px;' + (fd.trackValue ? '' : 'display:none');
  var unitLbl = document.createElement('label');
  unitLbl.textContent = 'Единица измерения';
  unitLbl.style.cssText = 'display:block;font-size:12px;color:#999;margin-bottom:5px';
  var unitEl = makeSelect(fd.unit, units);
  unitWrap.appendChild(unitLbl);
  unitWrap.appendChild(unitEl);
  body.appendChild(unitWrap);

  trackChk.onchange = function() {
    fd.trackValue          = this.checked;
    unitWrap.style.display = this.checked ? '' : 'none';
  };

  state.formEls = { name: nameEl, desc: descEl, note: noteEl, track: trackChk, unit: unitEl };
}

// ─── Применить форму → в список ───────────────────────────────────────────────

function _peApplyForm(state) {
  var els  = state.formEls;
  var name = els.name.value.trim();
  if (!name) {
    els.name.style.borderColor = '#e24b4a';
    els.name.focus();
    return;
  }

  var ex   = { name: name };
  var desc = els.desc.value.trim();
  var note = els.note.value.trim();
  if (desc) ex.desc = desc;
  if (note) ex.note = note;
  if (els.track.checked) {
    ex.trackValue = true;
    ex.unit       = els.unit.value;
  }

  if (state.editIdx === null) {
    state.exercises.push(ex);
  } else {
    state.exercises[state.editIdx] = ex;
  }

  state.mode     = 'list';
  state.editIdx  = null;
  state.formData = {};
  _peRender(state);
}

// ─── Сохранение в Firestore ───────────────────────────────────────────────────

function _peSave(state) {
  var btn = document.getElementById('pe-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Сохранение...'; }

  // Обновляем тип и label дня
  var dayTypes   = (state.config && state.config.dayTypes) || [];
  var typeConfig = dayTypes.filter(function(dt) { return dt.type === state.dayType; })[0];
  state.allDays[state.dayIndex].type      = state.dayType;
  state.allDays[state.dayIndex].label     = typeConfig ? typeConfig.label : state.dayType;
  state.allDays[state.dayIndex].exercises = state.exercises;

  firebase.firestore()
    .collection('users').doc(state.uid)
    .collection('plan').doc(state.section)
    .update({ days: state.allDays })
    .then(function() {
      if (typeof resetCache === 'function') resetCache(state.section);
      if (typeof plans !== 'undefined' && plans[state.section] !== undefined) {
        plans[state.section] = null;
      }
      state.onSave();
      if (btn) {
        btn.disabled         = false;
        btn.textContent      = 'Сохранено ✓';
        btn.style.background = '#0F6E56';
        setTimeout(function() {
          if (btn) {
            btn.textContent      = 'Сохранить';
            btn.style.background = '#1D9E75';
          }
        }, 2000);
      }
    })
    .catch(function(e) {
      console.error('_peSave:', e);
      alert('Ошибка при сохранении');
      if (btn) { btn.disabled = false; btn.textContent = 'Сохранить'; }
    });
}

// ─── Закрыть ──────────────────────────────────────────────────────────────────

function _peClose() {
  var overlay = document.getElementById('pe-overlay');
  if (overlay) overlay.remove();
}

// ─── Вспомогательные элементы ─────────────────────────────────────────────────

function _peBtn(text, type) {
  var btn = document.createElement('button');
  if (type === 'primary') {
    btn.style.cssText = 'flex:1;padding:11px;border:none;border-radius:10px;background:#1D9E75;color:#fff;font-size:14px;font-weight:500;cursor:pointer';
  } else {
    btn.style.cssText = 'flex:1;padding:11px;border:0.5px solid #ccc;border-radius:10px;background:none;color:#555;font-size:14px;cursor:pointer';
  }
  btn.textContent = text;
  return btn;
}

function _peIconBtn(icon, title) {
  var btn = document.createElement('button');
  btn.textContent = icon;
  btn.title = title;
  btn.style.cssText = [
    'background:none',
    'border:0.5px solid #e0e0e0',
    'border-radius:8px',
    'padding:5px 9px',
    'font-size:13px;color:#888',
    'cursor:pointer;flex-shrink:0'
  ].join(';');
  return btn;
}
