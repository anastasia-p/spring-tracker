// Test form and history

function renderTestForm() {
  var items = plans.tests || [];
  var grid = document.getElementById('test-grid');
  if (!items.length) { grid.innerHTML = '<div class="loading">Загрузка теста...</div>'; return; }
  _bindTestGridHandlers(grid);
  var dk = dateKey(new Date());
  var saved = cache.tests[dk] || {};
  grid.innerHTML = items.map(function(item, i) {
    var isChecked = !!saved[item.name];
    var val = saved[item.name] || '';
    var dataAttrs =
      ' data-test-name="' + escapeHtml(item.name) + '"' +
      ' data-test-unit="' + escapeHtml(item.unit || '') + '"';
    return '<div class="test-item">' +
      '<label class="ex-row">' +
        '<input type="checkbox" class="ex-check" id="tc_' + i + '" ' + (isChecked ? 'checked' : '') +
          dataAttrs + ' data-action="test-check">' +
        '<div class="ex-info">' +
          '<div class="ex-name">' + escapeHtml(item.name) + (item.note ? '<span style="color:var(--text-hint);font-size:10px;display:block">' + escapeHtml(item.note) + '</span>' : '') + '</div>' +
          (isChecked && val ? '<div class="ex-value">' + escapeHtml(val) + ' ' + escapeHtml(item.unit || '') + '</div>' : '') +
        '</div>' +
      '</label>' +
    '</div>';
  }).join('') +
  '<div style="margin-top:8px;padding-top:10px;border-top:1px solid var(--border-light);text-align:center">' +
    '<button id="edit-tests-btn" ' +
      'style="background:none;border:none;color:var(--text-muted);font-size:13px;cursor:pointer;padding:4px 8px">' +
      '\u270f редактировать тесты</button>' +
  '</div>';

  var editBtn = document.getElementById('edit-tests-btn');
  if (editBtn) {
    editBtn.onclick = function() {
      openTestEditor({
        section: 'tests',
        sectionLabel: 'Еженедельный тест',
        onSave: function() { renderTestForm(); }
      });
    };
  }
}

// Делегированный обработчик change по чекбоксам тестов внутри #test-grid.
// Контейнер не пересоздаётся — навешиваем listener один раз.
function _bindTestGridHandlers(container) {
  if (!container || container.__testGridHandlersBound) return;
  container.__testGridHandlersBound = true;
  container.addEventListener('change', function(e) {
    var el = e.target;
    if (el && el.dataset && el.dataset.action === 'test-check') {
      handleTestCheckbox(el);
    }
  });
}

// Диспетчер галочки теста — читает параметры из data-* атрибутов
// (см. техдолг: XSS — имя теста может содержать кавычки / HTML).
function handleTestCheckbox(el) {
  var name = el.dataset.testName;
  var unit = el.dataset.testUnit || '';
  handleTestCheck(name, unit, el);
}

function handleTestCheck(name, unit, el) {
  if (el.checked) {
    var dk = dateKey(new Date());
    // Найдем тип поля из plans.tests
    var item = (plans.tests || []).find(function(it) { return it.name === name; });
    var isText = item && item.type === 'text';
    if (isText) {
      showTextTestPopup(name, unit, dk, el);
    } else {
      showValuePopup('tests', dk, name, unit, el);
    }
  } else {
    var dk = dateKey(new Date());
    saveTestField(dk, name, null);
    renderTestForm();
  }
}

function showTextTestPopup(name, unit, dk, checkboxEl) {
  var existing = (cache.tests[dk] || {})[name] || '';
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1000;display:flex;align-items:center;justify-content:center';
  overlay.innerHTML =
    '<div style="background:var(--card);border-radius:16px;padding:24px 20px;width:280px;box-shadow:0 8px 32px rgba(0,0,0,.18)">' +
      '<div style="font-size:15px;font-weight:600;margin-bottom:4px">' + escapeHtml(name) + '</div>' +
      '<div style="font-size:12px;color:var(--text-muted);margin-bottom:16px">' + escapeHtml(unit) + '</div>' +
      '<input id="text-test-input" type="text" placeholder="например 6:30" value="' + escapeHtml(existing) + '" ' +
        'style="width:100%;box-sizing:border-box;border:1.5px solid var(--border-light);border-radius:8px;padding:10px 12px;font-size:16px;outline:none">' +
      '<div style="display:flex;gap:8px;margin-top:16px">' +
        '<button id="text-test-cancel" style="flex:1;padding:10px;border:1.5px solid var(--border-light);border-radius:8px;background:var(--card);font-size:14px;cursor:pointer;color:var(--text-subtle)">Отмена</button>' +
        '<button id="text-test-save" style="flex:1;padding:10px;border:none;border-radius:8px;background:var(--green);color:var(--card);font-size:14px;font-weight:600;cursor:pointer">Сохранить</button>' +
      '</div>' +
    '</div>';
  overlay.id = 'text-test-overlay';
  document.body.appendChild(overlay);

  document.getElementById('text-test-cancel').onclick = cancelTextTestPopup;
  document.getElementById('text-test-save').onclick = function() { confirmTextTestPopup(name, dk); };

  setTimeout(function() {
    var inp = document.getElementById('text-test-input');
    if (inp) { inp.focus(); inp.select(); }
  }, 50);
}

function cancelTextTestPopup() {
  var ov = document.getElementById('text-test-overlay');
  if (ov) ov.remove();
  renderTestForm();
}

function confirmTextTestPopup(name, dk) {
  var inp = document.getElementById('text-test-input');
  var val = inp ? inp.value.trim() : '';
  var ov = document.getElementById('text-test-overlay');
  if (ov) ov.remove();
  if (val) {
    saveTestField(dk, name, val);
  }
  renderTestForm();
}

function saveTestField(dk, name, value) {
  // Тонкий врап поверх централизованной updateTestValue в db.js.
  // Оставлен для двух точек вызова в этом файле (handleTestCheck, confirmTextTestPopup).
  return updateTestValue(dk, name, value);
}

function loadAndRenderHistory() {
  var c = document.getElementById('history-container');
  if (!c) return;
  _bindHistoryHandlers(c);
  c.innerHTML = '<div class="loading">Загрузка...</div>';
  // Чистим кеш чтобы перечитать всё заново
  resetCache('tests');
  loadTestsCache().then(function() {
    var entries = Object.keys(cache.tests).map(function(dk) {
      return { dk: dk, data: cache.tests[dk] };
    });
    entries.sort(function(a, b) { return a.dk < b.dk ? -1 : 1; });
    var items = plans.tests || [];
    if (!entries.length) {
      c.innerHTML = '<div class="empty">Пока нет ни одного теста.<br>Пройди первый тест в воскресенье.</div>';
    } else {
      renderTestHistory(c, items, entries);
    }
    // Прошлые тесты — рендерим в отдельный контейнер ниже. Используем те же entries
    // (cache.tests хранит все измерения по датам — определения архивных тестов
    // привязываются к этим же значениям через item.name, секция в пути Firestore).
    renderArchivedTestsSection(entries);
  }).catch(function() { c.innerHTML = '<div class="empty">Ошибка загрузки.</div>'; });
}

// Прошлые тесты — рендер блока ниже «Активных тестов». Если архив пуст или
// ни у одного определения нет ни одного измерения в cache.tests — скрываем
// заголовок и контейнер целиком (чтобы пустая секция не торчала).
function renderArchivedTestsSection(entries) {
  var titleEl = document.getElementById('archived-history-title');
  var c       = document.getElementById('archived-history-container');
  if (!c || !titleEl) return;
  var items = plans.archivedTests || [];
  var hasAny = items.some(function(item) {
    return entries.some(function(e) { return e.data[item.name] != null; });
  });
  if (!hasAny) {
    titleEl.style.display = 'none';
    c.style.display = 'none';
    c.innerHTML = '';
    return;
  }
  titleEl.style.display = '';
  c.style.display = '';
  _bindHistoryHandlers(c);
  renderTestHistory(c, items, entries);
}

// Делегированный обработчик клика по карточке t3-item внутри #history-container.
// Контейнер не пересоздаётся между перерисовками — навешиваем listener один раз.
function _bindHistoryHandlers(container) {
  if (!container || container.__historyHandlersBound) return;
  container.__historyHandlersBound = true;
  container.addEventListener('click', function(e) {
    // Стрелка "назад" по неделям — на предыдущую entry с любыми измерениями.
    var prevArrow = e.target.closest('[data-action="test-prev"]');
    if (prevArrow && container.contains(prevArrow)) {
      _handleTestNavClick(container, -1);
      return;
    }
    // Стрелка "вперёд" — на следующую entry.
    var nextArrow = e.target.closest('[data-action="test-next"]');
    if (nextArrow && container.contains(nextArrow)) {
      _handleTestNavClick(container, 1);
      return;
    }
    // Кнопка "Развернуть/Свернуть" над списком — перехватываем до карточки.
    // В frozen-режиме (перелистнули в прошлое) клик сбрасывает дату к последней
    // и разворачивает все — по согласованной механике; см. _handleToggleAllClick.
    var toggleAllBtn = e.target.closest('[data-action="toggle-all-test-history"]');
    if (toggleAllBtn && container.contains(toggleAllBtn)) {
      _handleToggleAllClick(container);
      return;
    }
    // Клик по карточке — в frozen-режиме игнорируем, показываем только шапки.
    if (container.dataset.frozen) return;
    var item = e.target.closest('[data-action="toggle-test-history"]');
    if (!item || !container.contains(item)) return;
    var idx = parseInt(item.dataset.testIdx, 10);
    if (isNaN(idx)) return;
    toggleTestHistory(idx, item);
  });
}

// Перелистывание недель: меняем currentIdx, перерисовываем блок (только этот контейнер,
// без перезагрузки cache.tests). entries собираем заново из кеша — он актуальный.
function _handleTestNavClick(container, direction) {
  var entries = _buildEntries();
  if (!entries.length) return;
  var currentIdx = parseInt(container.dataset.currentIdx, 10);
  if (isNaN(currentIdx)) currentIdx = entries.length - 1;
  var newIdx = currentIdx + direction;
  if (newIdx < 0 || newIdx > entries.length - 1) return;
  renderTestHistory(container, _itemsForContainer(container), entries, { currentIdx: newIdx });
}

// Клик по кнопке "Развернуть/Свернуть":
//  - frozen (перелистнули в прошлое): сброс currentIdx к последней + развернуть все;
//  - обычный режим: текущая логика toggleAllTestHistory (один общий toggle).
function _handleToggleAllClick(container) {
  if (container.dataset.frozen) {
    var entries = _buildEntries();
    renderTestHistory(container, _itemsForContainer(container), entries);
    // После рендера карточки свёрнуты, кнопка "▼" — разворачиваем все.
    var btn = container.querySelector('[data-action="toggle-all-test-history"]');
    if (btn) toggleAllTestHistory(container, btn);
    return;
  }
  var btn = container.querySelector('[data-action="toggle-all-test-history"]');
  if (btn) toggleAllTestHistory(container, btn);
}

function renderTestHistory(container, items, entries, opts) {
  opts = opts || {};
  // currentIdx — индекс "текущей даты" в массиве entries. По умолчанию — последняя
  // (самая свежая) дата с измерениями. При перелистывании назад уменьшается;
  // блок становится "замороженным": видны только шапки карточек, индивидуальные
  // клики по карточкам игнорируются (см. _bindHistoryHandlers).
  var currentIdx = (typeof opts.currentIdx === 'number') ? opts.currentIdx : entries.length - 1;
  if (currentIdx < 0) currentIdx = 0;
  if (currentIdx > entries.length - 1) currentIdx = entries.length - 1;
  var sliced = entries.slice(0, currentIdx + 1);
  var isFrozen = currentIdx < entries.length - 1;

  var last = sliced[sliced.length - 1];
  var prev = sliced.length > 1 ? sliced[sliced.length - 2] : null;

  var html = '<div class="t3-list">';
  var renderedCount = 0;
  items.forEach(function(item, idx) {
    // Скрываем строки до первого измерения этого теста — тесты, добавленные позже
    // других, не должны показывать пустоту за весь период. После первого измерения
    // пустые даты остаются (непрерывная лента начиная с дебюта). При перелистывании
    // назад срез sliced короче — тесты, ещё не появившиеся к выбранной дате, не рисуем.
    var firstIdx = sliced.findIndex(function(e) { return e.data[item.name] != null; });
    if (firstIdx === -1) return;
    var visibleEntries = sliced.slice(firstIdx);
    renderedCount++;

    var lastVal = last.data[item.name];
    var prevVal = prev ? prev.data[item.name] : null;
    var isTextType = item.type === 'text';
    var diff = (!isTextType && lastVal != null && prevVal != null) ? lastVal - prevVal : null;
    var badgeHtml = '';
    var badgeStyle = 'min-width:44px;text-align:center';
    if (isTextType) {
      badgeHtml = ''; // нет сравнения для текстовых значений
    } else if (diff === null) {
      badgeHtml = '<span class="t3-badge t3-badge-neutral" style="' + badgeStyle + '">нет данных</span>';
    } else if (diff > 0) {
      badgeHtml = '<span class="t3-badge t3-badge-up" style="' + badgeStyle + '">+' + diff + ' ↑</span>';
    } else if (diff < 0) {
      badgeHtml = '<span class="t3-badge t3-badge-down" style="' + badgeStyle + '">' + diff + ' ↓</span>';
    } else {
      badgeHtml = '<span class="t3-badge t3-badge-neutral" style="' + badgeStyle + '">0</span>';
    }
    var valHtml = lastVal != null
      ? '<span class="t3-last-val">' + escapeHtml(lastVal) + '</span><span class="t3-unit"> ' + escapeHtml(item.unit || '') + '</span>'
      : '<span class="t3-last-val" style="color:var(--text-muted)">—</span>';

    // History rows — по visibleEntries (от первого измерения этого теста до выбранной даты)
    var maxVal = 0;
    if (!isTextType) {
      visibleEntries.forEach(function(e) { if (e.data[item.name] && e.data[item.name] > maxVal) maxVal = e.data[item.name]; });
    }
    var histHtml = '<div class="t3-history" style="display:none">';
    visibleEntries.forEach(function(e, i) {
      var v = e.data[item.name];
      var eprev = i > 0 ? visibleEntries[i-1].data[item.name] : null;
      var ediff = (!isTextType && v != null && eprev != null) ? v - eprev : null;
      var pct = (!isTextType && v != null && maxVal > 0) ? Math.round(v / maxVal * 100) : 0;
      var isDown = ediff !== null && ediff < 0;
      var isUp   = ediff !== null && ediff > 0;
      var barColor = isDown ? 'var(--diff-down-bar)' : 'var(--green)';
      var valColor = isDown ? 'var(--diff-down)' : (i === visibleEntries.length - 1 ? 'var(--green)' : 'var(--text)');
      var valWeight = i === visibleEntries.length - 1 ? '600' : '500';
      var diffHtml = isTextType ? '' :
        (ediff === null ? '<span style="width:30px"></span>'
        : (isUp   ? '<span style="font-size:11px;color:var(--green);width:30px">+' + ediff + '</span>'
        : (isDown ? '<span style="font-size:11px;color:var(--diff-down);width:30px">' + ediff + '</span>'
        :           '<span style="font-size:11px;color:var(--text-muted);width:30px">0</span>')));
      var unit = item.unit && item.unit !== 'раз' ? '<span style="font-size:11px;color:var(--text-muted)"> ' + escapeHtml(item.unit) + '</span>' : '';
      var barHtml = isTextType ? '' : '<div class="t3-bar-wrap"><div class="t3-bar-inner" style="width:' + pct + '%;background:' + barColor + '"></div></div>';
      histHtml += '<div class="t3-hist-row">' +
        '<div class="t3-hist-date">' + escapeHtml(e.data.date || e.dk) + '</div>' +
        barHtml +
        '<div class="t3-hist-val" style="color:' + valColor + ';font-weight:' + valWeight + '">' + (v != null ? escapeHtml(v) : '—') + unit + '</div>' +
        diffHtml +
      '</div>';
    });
    histHtml += '</div>';

    html += '<div class="t3-item' + (idx === items.length - 1 ? ' t3-item-last' : '') + '" data-action="toggle-test-history" data-test-idx="' + idx + '">' +
      '<div class="t3-row-main">' +
        '<div class="t3-item-name">' + escapeHtml(item.name) + '</div>' +
        '<div style="display:flex;align-items:center;gap:8px">' +
          valHtml + badgeHtml +
          '<span class="t3-chevron">▼</span>' +
        '</div>' +
      '</div>' +
      histHtml +
    '</div>';
  });
  html += '</div>';

  // Тулбар: навигатор по неделям (если >=2 entries) + кнопка toggle (если >=2 карточек).
  // Навигатор рисуется даже при пустом списке (renderedCount=0) — чтобы юзер мог
  // вернуться вперёд, если зашёл в раннюю дату, где у этого блока ещё нет данных.
  var navHtml = '';
  if (entries.length >= 2) {
    var dateStr = _formatTestDate(entries[currentIdx] ? entries[currentIdx].dk : '');
    var prevDisabled = currentIdx <= 0 ? ' disabled' : '';
    var nextDisabled = currentIdx >= entries.length - 1 ? ' disabled' : '';
    navHtml = '<div class="t3-nav">' +
      '<button class="t3-nav-arrow" data-action="test-prev"' + prevDisabled + '>\u2190</button>' +
      '<span class="t3-nav-date">' + escapeHtml(dateStr) + '</span>' +
      '<button class="t3-nav-arrow" data-action="test-next"' + nextDisabled + '>\u2192</button>' +
    '</div>';
  }
  // Кнопка-toggle: в frozen всегда "▼" (клик сделает сброс к последней дате + разворот).
  // В обычном режиме также стартует с "▼" — toggleAllTestHistory переключит на "▲"
  // после разворота. При повторной перерисовке (loadAndRenderHistory) состояние
  // развёрнутости карточек сбрасывается, и иконка тоже сбрасывается на "▼" — корректно.
  // В архивном блоке кнопка показывается всегда (даже при одной карточке) — для
  // единообразия UI; в активном — только при >=2 карточках (одиночную карточку проще
  // открыть кликом по самой карточке).
  var isArchived = container.id === 'archived-history-container';
  var showToggle = isArchived ? renderedCount >= 1 : renderedCount >= 2;
  var toggleHtml = showToggle
    ? '<button class="t3-toggle-all" data-action="toggle-all-test-history">\u25BC</button>'
    : '';
  var toolbarHtml = (navHtml || toggleHtml)
    ? '<div class="t3-toolbar">' + navHtml + toggleHtml + '</div>'
    : '';
  container.innerHTML = toolbarHtml + html;
  container.dataset.currentIdx = String(currentIdx);
  if (isFrozen) container.dataset.frozen = '1';
  else delete container.dataset.frozen;
}

// Дата YYYY-MM-DD → DD.MM.YYYY. Без локализации — формат фиксированный.
function _formatTestDate(dk) {
  if (!dk || dk.length < 10) return dk || '';
  return dk.slice(8, 10) + '.' + dk.slice(5, 7) + '.' + dk.slice(0, 4);
}

// Пересборка entries из cache.tests — для обработчиков перелистывания, чтобы
// не таскать массив через замыкания/глобалы. Дешёво (O(n) по уникальным датам).
function _buildEntries() {
  var entries = Object.keys(cache.tests).map(function(dk) {
    return { dk: dk, data: cache.tests[dk] };
  });
  entries.sort(function(a, b) { return a.dk < b.dk ? -1 : 1; });
  return entries;
}

// Какой массив определений тестов соответствует контейнеру.
function _itemsForContainer(container) {
  if (container && container.id === 'archived-history-container') return plans.archivedTests || [];
  return plans.tests || [];
}

function toggleTestHistory(idx, el) {
  // Ищем .t3-history относительно карточки, а не через id — id пришлось бы префиксить
  // для двух контейнеров (Активные + Прошлые), querySelector внутри el проще и чище.
  var hist = el.querySelector('.t3-history');
  var chev = el.querySelector('.t3-chevron');
  if (!hist) return;
  var isOpen = hist.style.display !== 'none';
  hist.style.display = isOpen ? 'none' : 'block';
  if (chev) chev.style.transform = isOpen ? '' : 'rotate(180deg)';
  el.style.background = '';
}

// Развернуть/свернуть все карточки в контейнере. Направление определяется по
// текущему состоянию DOM: если хоть одна карточка свёрнута — разворачиваем все,
// иначе сворачиваем. Текст кнопки обновляется по новому состоянию (это "что
// случится при следующем клике"); если юзер потом свернёт что-то индивидуально,
// текст временно "отстаёт" — при следующем клике на кнопку направление пересчитается.
function toggleAllTestHistory(container, btn) {
  var cards = container.querySelectorAll('.t3-item');
  if (!cards.length) return;
  var anyCollapsed = false;
  cards.forEach(function(card) {
    var h = card.querySelector('.t3-history');
    if (h && h.style.display === 'none') anyCollapsed = true;
  });
  var open = anyCollapsed;
  cards.forEach(function(card) {
    var h = card.querySelector('.t3-history');
    var chev = card.querySelector('.t3-chevron');
    if (h) h.style.display = open ? 'block' : 'none';
    if (chev) chev.style.transform = open ? 'rotate(180deg)' : '';
    card.style.background = '';
  });
  if (btn) btn.textContent = open ? '\u25B2' : '\u25BC';
}

function showTestInfo() {
  document.getElementById('test-info-popup').style.display = 'flex';
}

function closeTestInfo() {
  document.getElementById('test-info-popup').style.display = 'none';
}
