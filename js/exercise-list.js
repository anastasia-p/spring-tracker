// exercise-list.js — модуль работы со списком упражнений секции.
// Используется plan-editor.js:
//   - addExerciseToList: для кнопки "+ добавить в список" в редакторе упражнения;
//   - openExerciseListPicker: для кнопки "+ добавить из списка" в редакторе дня.
//
// Хранение в Firestore: users/{uid}/sections/{section}/exercises/list.items
// Поля упражнения: { name, desc?, note?, trackValue?, unit? } — идентичны полям
// упражнения в плане (см. _peApplyForm в plan-editor.js).

// ─── Чистые хелперы (тестируются) ─────────────────────────────────────────────

// Убирает поля, начинающиеся с подчеркивания (_sourceKey и т.п.).
function _elClean(ex) {
  var copy = {};
  for (var k in ex) if (k.charAt(0) !== '_') copy[k] = ex[k];
  return copy;
}

// Сортирует массив элементов по name (русская локаль, регистронезависимо).
// Не мутирует входной массив.
function _elSort(items) {
  return items.slice().sort(function(a, b) {
    return (a.name || '').localeCompare(b.name || '', 'ru');
  });
}

// Определяет операцию над списком при попытке добавить element clean.
// Возвращает { action: 'add', items: [...] } или { action: 'duplicate', dupIndex: N }.
function _elComputeMutation(items, clean) {
  for (var i = 0; i < items.length; i++) {
    if (items[i].name === clean.name) {
      return { action: 'duplicate', dupIndex: i };
    }
  }
  return { action: 'add', items: items.concat([clean]) };
}

// ─── Попап "упражнение уже есть в списке" ─────────────────────────────────────
// Возвращает Promise<'replace'|'cancel'>.
function _elDuplicatePopup() {
  return new Promise(function(resolve) {
    var prev = document.getElementById('el-dup-overlay');
    if (prev) prev.remove();

    var overlay = document.createElement('div');
    overlay.id = 'el-dup-overlay';
    overlay.style.cssText = [
      'position:fixed;top:0;left:0;right:0;bottom:0',
      'background:rgba(0,0,0,0.5)',
      'z-index:9500',
      'display:flex;align-items:center;justify-content:center;padding:20px'
    ].join(';');

    var sheet = document.createElement('div');
    sheet.style.cssText = [
      'background:var(--card)',
      'border-radius:14px',
      'max-width:360px;width:100%',
      'padding:20px;box-sizing:border-box',
      'display:flex;flex-direction:column;gap:14px'
    ].join(';');

    var resolved = false;
    function done(result) {
      if (resolved) return;
      resolved = true;
      overlay.remove();
      resolve(result);
    }

    // Шапка с крестиком
    var header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:flex-start;justify-content:space-between;gap:10px';

    var title = document.createElement('div');
    title.textContent = 'Упражнение уже есть в списке';
    title.style.cssText = 'font-size:15px;font-weight:500;color:var(--text);flex:1';

    var closeBtn = document.createElement('button');
    closeBtn.textContent = '\u00D7';
    closeBtn.style.cssText = 'background:none;border:none;font-size:22px;color:var(--text-hint);cursor:pointer;padding:0 4px;line-height:1';
    closeBtn.onclick = function() { done('cancel'); };

    header.appendChild(title);
    header.appendChild(closeBtn);
    sheet.appendChild(header);

    // Подтекст
    var subtext = document.createElement('div');
    subtext.textContent = 'Заменить существующее упражнение в списке?';
    subtext.style.cssText = 'font-size:13px;color:var(--text-muted)';
    sheet.appendChild(subtext);

    // Кнопки
    var btns = document.createElement('div');
    btns.style.cssText = 'display:flex;gap:8px;margin-top:6px';

    var btnCancel = meBtn('Отмена', 'secondary');
    btnCancel.onclick = function() { done('cancel'); };

    var btnReplace = meBtn('Заменить', 'primary');
    btnReplace.onclick = function() { done('replace'); };

    btns.appendChild(btnCancel);
    btns.appendChild(btnReplace);
    sheet.appendChild(btns);

    // Клик по фону = отмена (стандартное поведение модалок проекта)
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) done('cancel');
    });

    overlay.appendChild(sheet);
    document.body.appendChild(overlay);
  });
}

// ─── Публичная: добавление в список ──────────────────────────────────────────
// Возвращает Promise<{ status: 'added'|'replaced'|'cancelled' }>.
function addExerciseToList(section, exercise) {
  var clean = _elClean(exercise);
  if (!clean.name) return Promise.resolve({ status: 'cancelled' });

  return loadSectionExercisesList(section).then(function(items) {
    var mut = _elComputeMutation(items, clean);

    if (mut.action === 'add') {
      return saveExercisesList(section, mut.items).then(function() {
        return { status: 'added' };
      });
    }

    // duplicate — спрашиваем юзера
    return _elDuplicatePopup().then(function(answer) {
      if (answer !== 'replace') return { status: 'cancelled' };
      items[mut.dupIndex] = clean;
      return saveExercisesList(section, items).then(function() {
        return { status: 'replaced' };
      });
    });
  });
}

// ─── Публичная: модалка выбора из списка ─────────────────────────────────────
// opts: { section, dayExercises, onPick }
//   section      — ключ секции (wingchun, strength, ...)
//   dayExercises — массив упражнений редактируемого дня (для фильтра по name)
//   onPick(ex)   — колбэк при клике "+", получает чистую копию упражнения
function openExerciseListPicker(opts) {
  var section = opts.section;
  var onPick = opts.onPick || function() {};

  var state = {
    section:    section,
    // Имена, которые уже добавлены в день (для скрытия из модалки).
    // Копируем, чтобы расширять при кликах "+" без мутации внешнего массива.
    addedNames: (opts.dayExercises || []).map(function(ex) { return ex.name; }),
    items:      [],
    loaded:     false
  };

  state.sheet = meOpen('el-overlay', 'el-sheet', function() { _elClose(); });
  _elRender(state, onPick);

  loadSectionExercisesList(section).then(function(items) {
    state.items  = _elSort(items);
    state.loaded = true;
    _elRender(state, onPick);
  }).catch(function(e) {
    console.error('openExerciseListPicker:', e);
    state.items  = [];
    state.loaded = true;
    _elRender(state, onPick);
  });
}

function _elRender(state, onPick) {
  var sectionLabel = (typeof getSectionMeta === 'function')
    ? (getSectionMeta(state.section) || {}).label || state.section
    : state.section;

  meRender(state.sheet, {
    closeBtnId: 'el-close-btn',
    footerId:   'el-footer',
    saveBtnId:  'el-save-btn',
    subtitle:   sectionLabel,
    title:      'Добавить из списка',
    isForm:     false,
    readonly:   true,  // footer = только кнопка "Закрыть"
    editIdx:    null,
    onClose:    function() { _elClose(); },
    onBack:     function() {},
    onApply:    function() {},
    onSave:     function() {},
    renderBody: function(body) { _elRenderBody(state, body, onPick); }
  });
}

function _elRenderBody(state, body, onPick) {
  if (!state.loaded) {
    var loading = document.createElement('div');
    loading.textContent = 'Загрузка...';
    loading.style.cssText = 'text-align:center;color:var(--text-hint);font-size:14px;padding:28px 0';
    body.appendChild(loading);
    return;
  }

  // Фильтр: убираем те, что уже в редактируемом дне (по name).
  var visible = state.items.filter(function(ex) {
    return state.addedNames.indexOf(ex.name) === -1;
  });

  if (visible.length === 0) {
    var empty = document.createElement('div');
    empty.style.cssText = 'text-align:center;color:var(--text-hint);font-size:13px;padding:28px 16px;line-height:1.5';
    empty.textContent = state.items.length === 0
      ? 'Список пуст. Добавляй упражнения через «+ добавить в список» в редакторе упражнения.'
      : 'Все упражнения из списка уже добавлены в день.';
    body.appendChild(empty);
    return;
  }

  visible.forEach(function(ex) {
    body.appendChild(_elBuildCard(ex, state, onPick));
  });
}

// Карточка упражнения в picker'е — соответствует .ex-item в plan.js (renderSection):
// name + desc + note + строка-индикатор если trackValue. Без чекбокса и бейджей.
// Справа — кнопка "+".
function _elBuildCard(ex, state, onPick) {
  var item = document.createElement('div');
  item.style.cssText = 'background:var(--bg);border-radius:10px;padding:10px 12px;margin-bottom:8px;display:flex;align-items:flex-start;gap:10px';

  var info = document.createElement('div');
  info.style.cssText = 'flex:1;min-width:0;overflow:hidden';

  var nameDiv = document.createElement('div');
  nameDiv.textContent  = ex.name;
  nameDiv.style.cssText = 'font-size:14px;font-weight:500;color:var(--text);word-wrap:break-word';
  info.appendChild(nameDiv);

  if (ex.desc) {
    var descDiv = document.createElement('div');
    descDiv.textContent  = ex.desc;
    descDiv.style.cssText = 'font-size:12px;color:var(--text-subtle);margin-top:2px;word-wrap:break-word';
    info.appendChild(descDiv);
  }

  if (ex.note) {
    var noteDiv = document.createElement('div');
    noteDiv.textContent  = ex.note;
    noteDiv.style.cssText = 'font-size:12px;color:var(--text-muted);margin-top:2px;word-wrap:break-word';
    info.appendChild(noteDiv);
  }

  if (ex.trackValue) {
    var valDiv = document.createElement('div');
    valDiv.textContent  = 'считается в ' + (ex.unit || '');
    valDiv.style.cssText = 'font-size:11px;color:var(--text-hint);margin-top:3px;font-style:italic';
    info.appendChild(valDiv);
  }

  item.appendChild(info);

  // Кнопка "+" — визуально выпуклая (зеленая обводка, плюс).
  var btnAdd = meIconBtn('+', 'Добавить в день');
  btnAdd.style.color       = 'var(--green)';
  btnAdd.style.borderColor = 'var(--green)';
  btnAdd.style.fontSize    = '16px';
  btnAdd.style.fontWeight  = '500';
  btnAdd.style.alignSelf   = 'center';
  btnAdd.onclick = function() {
    var copy = JSON.parse(JSON.stringify(ex));
    onPick(copy);
    // Дополняем фильтр и перерисовываем модалку — упражнение уйдет из видимых.
    state.addedNames.push(ex.name);
    _elRender(state, onPick);
  };
  item.appendChild(btnAdd);

  return item;
}

function _elClose() {
  var o = document.getElementById('el-overlay');
  if (o) o.remove();
}

// ─── Экспорт для Node-тестов ─────────────────────────────────────────────────
// В браузере условие ложно — ничего не происходит.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    _elClean:            _elClean,
    _elSort:             _elSort,
    _elComputeMutation:  _elComputeMutation,
    addExerciseToList:   addExerciseToList
  };
}
