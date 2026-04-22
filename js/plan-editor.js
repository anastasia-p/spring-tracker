// plan-editor.js — редактор упражнений дня (тонкий адаптер над modal-editor.js)
// Использование: openPlanEditor({ section, dayIndex, sectionLabel, onSave })

var _planEditorClipboard = null; // { name, desc, note, trackValue, unit, _sourceKey }
var _peConfigCache = { value: null };

function _peLoadConfig(cb) { meLoadConfig(_peConfigCache, cb); }

// ─── Публичный API ────────────────────────────────────────────────────────────

function openPlanEditor(opts) {
  if (typeof currentUser === 'undefined' || !currentUser) return;

  var section      = opts.section;
  var dayIndex     = opts.dayIndex;
  var sectionLabel = opts.sectionLabel || section;
  var onSave       = opts.onSave || function() {};
  var editMode     = opts.mode || 'plan'; // 'plan' | 'today'
  var dk           = opts.dk   || null;
  var date         = opts.date || null;

  var planPromise   = loadSectionPlan(section);
  var configPromise = new Promise(function(resolve) { _peLoadConfig(resolve); });
  // Для режима "только сегодня" грузим кешированные данные дня (шаблон + дельта уже применена)
  var dayPromise    = (editMode === 'today' && date)
    ? loadDayData(section, date)
    : Promise.resolve(null);

  Promise.all([planPromise, configPromise, dayPromise])
    .then(function(results) {
      var allDays  = results[0];
      var config   = results[1];
      var dayData  = results[2];
      if (allDays === null) { alert('План не найден'); return; }
      var day     = allDays[dayIndex] || {};
      var dayName = day.day || ('День ' + (dayIndex + 1));
      // templateExs — упражнения шаблона; нужны для вычисления дельты при сохранении "сегодня"
      var templateExs = JSON.parse(JSON.stringify(day.exercises || []));
      // exs — стартовый список для редактора
      var exs = editMode === 'today'
        ? JSON.parse(JSON.stringify(dayData ? dayData.plan : templateExs))
        : JSON.parse(JSON.stringify(templateExs));

      _peOpen({
        section:           section,
        sectionLabel:      sectionLabel,
        dayIndex:          dayIndex,
        dayName:           dayName,
        allDays:           allDays,
        templateExercises: templateExs,
        exercises:         exs,
        dayType:           day.type || 'rest',
        config:            config,
        onSave:            onSave,
        editMode:          editMode,
        dk:                dk,
        date:              date,
        mode:              'list',
        editIdx:           null,
        formData:          {},
        formEls:           null
      });
    })
    .catch(function(e) { console.error('openPlanEditor:', e); });
}

// ─── Открытие / рендер ────────────────────────────────────────────────────────

function _peOpen(state) {
  state.sheet = meOpen('pe-overlay', 'pe-sheet', function() { _peConfirmClose(state); });
  _peRender(state);
}

function _peRender(state) {
  var isForm = state.mode === 'form';
  var title  = isForm
    ? (state.editIdx === null ? 'Новое упражнение' : 'Редактировать')
    : (state.editMode === 'today' ? 'Редактор дня' : 'Редактор плана');

  meRender(state.sheet, {
    closeBtnId: 'pe-close-btn',
    footerId:   'pe-footer',
    saveBtnId:  'pe-save-btn',
    subtitle:   state.sectionLabel + ' — ' + state.dayName,
    title:      title,
    isForm:     isForm,
    editIdx:    state.editIdx,
    onClose:    function() { _peConfirmClose(state); },
    onBack:     function() {
      state.mode = 'list'; state.editIdx = null; state.formData = {};
      _peRender(state);
    },
    onApply:    function() { _peApplyForm(state); },
    onSave:     function() { _peSave(state); },
    renderBody: function(body) {
      if (isForm) _peRenderForm(state, body);
      else        _peRenderList(state, body);
    }
  });
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
    typeLbl.textContent   = 'Тип дня';
    typeLbl.style.cssText = 'display:block;font-size:12px;color:#999;margin-bottom:5px';
    var typeSelect = meSelect(state.dayType, dayTypes.map(function(dt) {
      return { value: dt.type, label: dt.label };
    }));
    typeSelect.onchange = function() { state.dayType = this.value; state.dirty = true; };
    typeWrap.appendChild(typeLbl);
    typeWrap.appendChild(typeSelect);
    body.appendChild(typeWrap);

    var divider = document.createElement('div');
    divider.style.cssText = 'border-top:0.5px solid #f0f0f0;margin-bottom:12px';
    body.appendChild(divider);
  }

  // Кнопка вставить
  var _pasteKey = state.section + ':' + state.dayIndex;
  if (_planEditorClipboard && _planEditorClipboard._sourceKey !== _pasteKey && !state.pastedThisSession) {
    var clipName  = _planEditorClipboard.name;
    var shortName = clipName.length > 26 ? clipName.slice(0, 26) + '…' : clipName;
    var pasteBtn  = document.createElement('button');
    pasteBtn.textContent   = 'Вставить: ' + shortName;
    pasteBtn.style.cssText = [
      'width:100%;padding:9px 12px;margin-bottom:10px',
      'border:1px dashed #1D9E75;border-radius:10px',
      'background:none;color:#1D9E75;font-size:13px',
      'cursor:pointer;text-align:left'
    ].join(';');
    pasteBtn.onclick = function() {
      var copy = JSON.parse(JSON.stringify(_planEditorClipboard));
      delete copy._sourceKey;
      state.exercises.push(copy);
      state.pastedThisSession = true;
      state.dirty = true;
      _peRender(state);
    };
    body.appendChild(pasteBtn);
  }

  // Пустой список
  if (exs.length === 0) {
    var empty = document.createElement('div');
    empty.textContent   = 'Упражнений пока нет';
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
      '<div style="font-size:14px;font-weight:500;color:#222;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escapeHtml(ex.name) + '</div>' +
      (ex.note ? '<div style="font-size:12px;color:#999;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escapeHtml(ex.note) + '</div>' : '');

    var btnCopy = meIconBtn('\u2398', 'Копировать');
    btnCopy.onclick = (function(idx, btn) {
      return function() {
        _planEditorClipboard = JSON.parse(JSON.stringify(state.exercises[idx]));
        _planEditorClipboard._sourceKey = state.section + ':' + state.dayIndex;
        btn.style.width  = btn.offsetWidth  + 'px';
        btn.style.height = btn.offsetHeight + 'px';
        btn.textContent  = '\u2713';
        btn.style.color       = '#1D9E75';
        btn.style.borderColor = '#1D9E75';
        setTimeout(function() { _peRender(state); }, 1000);
      };
    })(i, btnCopy);

    var btnEdit = meIconBtn('\u270F', 'Редактировать');
    btnEdit.onclick = (function(idx) {
      return function() {
        state.editIdx  = idx;
        state.formData = JSON.parse(JSON.stringify(state.exercises[idx]));
        state.mode     = 'form';
        _peRender(state);
      };
    })(i);

    var btnUp = meIconBtn('\u2191', 'Выше');
    if (i === 0) btnUp.style.visibility = 'hidden';
    btnUp.onclick = (function(idx) {
      return function() {
        var tmp = state.exercises[idx - 1];
        state.exercises[idx - 1] = state.exercises[idx];
        state.exercises[idx] = tmp;
        state.dirty = true;
        state.savedScrollTop = body.scrollTop;
        _peRender(state);
      };
    })(i);

    var btnDown = meIconBtn('\u2193', 'Ниже');
    if (i === exs.length - 1) btnDown.style.visibility = 'hidden';
    btnDown.onclick = (function(idx) {
      return function() {
        var tmp = state.exercises[idx + 1];
        state.exercises[idx + 1] = state.exercises[idx];
        state.exercises[idx] = tmp;
        state.dirty = true;
        state.savedScrollTop = body.scrollTop;
        _peRender(state);
      };
    })(i);

    var btnDel = meIconBtn('\u2715', 'Удалить');
    btnDel.style.color = '#c0392b';
    btnDel.onclick = (function(idx) {
      return function() {
        if (confirm('Удалить "' + state.exercises[idx].name + '"?')) {
          state.exercises.splice(idx, 1);
          state.dirty = true;
          _peRender(state);
        }
      };
    })(i);

    item.appendChild(info);
    item.appendChild(btnUp);
    item.appendChild(btnDown);
    item.appendChild(btnCopy);
    item.appendChild(btnEdit);
    item.appendChild(btnDel);
    body.appendChild(item);
  });

  // Добавить
  var addBtn = document.createElement('button');
  addBtn.textContent   = '+ добавить упражнение';
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

  if (state.savedScrollTop != null) {
    body.scrollTop = state.savedScrollTop;
    state.savedScrollTop = null;
  }
}

// ─── Форма упражнения ─────────────────────────────────────────────────────────

function _peRenderForm(state, body) {
  var fd     = state.formData;
  var units  = (state.config && state.config.units) || ['мин', 'сек', 'раз', 'км', 'кг'];
  var LIMITS = { name: 100, desc: 200, note: 200 };

  var nameEl = meInput(fd.name, 'Например: Приседания', LIMITS.name);
  meFieldWrap('Название *', nameEl, LIMITS.name, body);

  var descEl = meInput(fd.desc, 'Например: Ноги на ширине плеч', LIMITS.desc);
  meFieldWrap('Описание', descEl, LIMITS.desc, body);

  var noteEl = meInput(fd.note, 'Например: 3 подхода по 12 повторений', LIMITS.note);
  meFieldWrap('Заметка', noteEl, LIMITS.note, body);

  // Трекер значения
  var trackWrap = document.createElement('div');
  trackWrap.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:14px';
  var trackChk = document.createElement('input');
  trackChk.type         = 'checkbox';
  trackChk.checked      = !!fd.trackValue;
  trackChk.id           = 'pe-track-chk';
  trackChk.style.cssText = 'width:16px;height:16px;cursor:pointer;accent-color:#1D9E75';
  var trackLbl = document.createElement('label');
  trackLbl.htmlFor       = 'pe-track-chk';
  trackLbl.textContent   = 'Считать результат (вводить число)';
  trackLbl.style.cssText = 'font-size:14px;color:#444;cursor:pointer';
  trackWrap.appendChild(trackChk);
  trackWrap.appendChild(trackLbl);
  body.appendChild(trackWrap);

  var unitWrap = document.createElement('div');
  unitWrap.style.cssText = 'margin-bottom:14px;' + (fd.trackValue ? '' : 'display:none');
  var unitLbl = document.createElement('label');
  unitLbl.textContent   = 'Единица измерения';
  unitLbl.style.cssText = 'display:block;font-size:12px;color:#999;margin-bottom:5px';
  var unitEl = meSelect(fd.unit, units);
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
  if (!name) { els.name.style.borderColor = '#e24b4a'; els.name.focus(); return; }

  var ex   = { name: name };
  var desc = els.desc.value.trim();
  var note = els.note.value.trim();
  if (desc) ex.desc = desc;
  if (note) ex.note = note;
  if (els.track.checked) { ex.trackValue = true; ex.unit = els.unit.value; }

  if (state.editIdx === null) state.exercises.push(ex);
  else                        state.exercises[state.editIdx] = ex;
  state.dirty    = true;
  state.mode     = 'list';
  state.editIdx  = null;
  state.formData = {};
  _peRender(state);
}

// ─── Сохранение ───────────────────────────────────────────────────────────────

function _peSave(state) {
  if (state.editMode === 'today') _peSaveToday(state);
  else                            _peSavePlan(state);
}

// Сохраняет изменения в шаблон недели (plan/current) — текущее поведение.
function _peSavePlan(state) {
  var dayTypes   = (state.config && state.config.dayTypes) || [];
  var typeConfig = dayTypes.filter(function(dt) { return dt.type === state.dayType; })[0];
  state.allDays[state.dayIndex].type      = state.dayType;
  state.allDays[state.dayIndex].label     = typeConfig ? typeConfig.label : state.dayType;
  state.allDays[state.dayIndex].exercises = state.exercises.map(function(ex) {
    var copy = {};
    for (var k in ex) if (k.charAt(0) !== '_') copy[k] = ex[k];
    return copy;
  });

  meSaveFeedback(
    'pe-save-btn',
    savePlan(state.section, state.allDays),
    function() {
      if (typeof resetCache === 'function') resetCache(state.section);
      if (typeof invalidateStreakCache === 'function') invalidateStreakCache(state.section);
      state.dirty = false;
      if (typeof plans !== 'undefined') plans[state.section] = state.allDays;
      state.onSave();
    },
    function(e) { console.error('_peSavePlan:', e); }
  );
}

// Сохраняет изменения только в историю текущего дня через dayOverride (дельта).
// Шаблон не трогает. Дельта = разница между шаблоном и отредактированным списком.
// plan в истории = merged результат (корректный снапшот когда день уйдет в прошлое).
function _peSaveToday(state) {
  var dayTypes   = (state.config && state.config.dayTypes) || [];
  var typeConfig = dayTypes.filter(function(dt) { return dt.type === state.dayType; })[0];
  var editedExs  = state.exercises.map(function(ex) {
    var copy = {};
    for (var k in ex) if (k.charAt(0) !== '_') copy[k] = ex[k];
    return copy;
  });

  var override = computeDayOverride(state.templateExercises, editedExs);
  var dk       = state.dk;
  var date     = state.date;

  // Обновляем кеш: план (merged), дельта, тип дня
  if (!cache[state.section][dk]) cache[state.section][dk] = { checks: {}, values: {} };
  var day        = cache[state.section][dk];
  day.plan       = editedExs;
  day.dayOverride = override;
  day.type        = state.dayType;
  day.label       = typeConfig ? typeConfig.label : state.dayType;

  meSaveFeedback(
    'pe-save-btn',
    saveDayData(state.section, date),
    function() {
      if (typeof invalidateStreakCache === 'function') invalidateStreakCache(state.section);
      state.dirty = false;
      state.onSave();
    },
    function(e) { console.error('_peSaveToday:', e); }
  );
}

// ─── Закрыть ──────────────────────────────────────────────────────────────────

function _peConfirmClose(state) { meConfirmClose(state, _peClose); }
function _peClose() { var o = document.getElementById('pe-overlay'); if (o) o.remove(); }
