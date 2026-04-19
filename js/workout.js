// Test form and history

function renderTestForm() {
  var items = plans.tests || [];
  var grid = document.getElementById('test-grid');
  if (!items.length) { grid.innerHTML = '<div class="loading">Загрузка теста...</div>'; return; }
  var dk = dateKey(new Date());
  var saved = cache.tests[dk] || {};
  grid.innerHTML = items.map(function(item, i) {
    var isChecked = !!saved[item.name];
    var val = saved[item.name] || '';
    return '<div class="test-item">' +
      '<label class="ex-row">' +
        '<input type="checkbox" class="ex-check" id="tc_' + i + '" ' + (isChecked ? 'checked' : '') +
          ' onchange="handleTestCheck(\'' + item.name + '\', \'' + item.unit + '\', this)">' +
        '<div class="ex-info">' +
          '<div class="ex-name">' + item.name + (item.note ? '<span style="color:var(--text-hint);font-size:10px;display:block">' + item.note + '</span>' : '') + '</div>' +
          (isChecked && val ? '<div class="ex-value">' + val + ' ' + item.unit + '</div>' : '') +
        '</div>' +
      '</label>' +
    '</div>';
  }).join('') +
  '<div style="margin-top:8px;padding-top:10px;border-top:1px solid #f0f0f0;text-align:center">' +
    '<button onclick="openTestEditor({section:\'tests\',sectionLabel:\'Еженедельный тест\',onSave:function(){renderTestForm();}})" ' +
      'style="background:none;border:none;color:#999;font-size:13px;cursor:pointer;padding:4px 8px">' +
      '\u270f редактировать тесты</button>' +
  '</div>';
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
    '<div style="background:#fff;border-radius:16px;padding:24px 20px;width:280px;box-shadow:0 8px 32px rgba(0,0,0,.18)">' +
      '<div style="font-size:15px;font-weight:600;margin-bottom:4px">' + name + '</div>' +
      '<div style="font-size:12px;color:#999;margin-bottom:16px">' + unit + '</div>' +
      '<input id="text-test-input" type="text" placeholder="например 6:30" value="' + existing + '" ' +
        'style="width:100%;box-sizing:border-box;border:1.5px solid #e0e0e0;border-radius:8px;padding:10px 12px;font-size:16px;outline:none">' +
      '<div style="display:flex;gap:8px;margin-top:16px">' +
        '<button onclick="cancelTextTestPopup()" style="flex:1;padding:10px;border:1.5px solid #e0e0e0;border-radius:8px;background:#fff;font-size:14px;cursor:pointer;color:#666">Отмена</button>' +
        '<button onclick="confirmTextTestPopup(\'' + name + '\',\'' + dk + '\')" style="flex:1;padding:10px;border:none;border-radius:8px;background:#1D9E75;color:#fff;font-size:14px;font-weight:600;cursor:pointer">Сохранить</button>' +
      '</div>' +
    '</div>';
  overlay.id = 'text-test-overlay';
  document.body.appendChild(overlay);
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
  var oldVal = (cache.tests[dk] && cache.tests[dk][name]) || 0;
  if (!cache.tests[dk]) cache.tests[dk] = {};
  if (value === null) {
    delete cache.tests[dk][name];
  } else {
    cache.tests[dk][name] = value;
  }
  saveTestData(dk, cache.tests[dk]);
  // Инкрементально: новое значение (0 при снятии) — старое
  var newVal = (value === null) ? 0 : value;
  // Берем только числовые изменения (текстовые тесты вроде темпа бега игнорируем)
  if (typeof newVal !== 'number' || typeof oldVal !== 'number') return;
  var skill = SKILLS.find(function(s) {
    if (!s.sourceExtra || s.sourceExtra.collection !== 'tests') return false;
    var fields = s.sourceExtra.fields || (s.sourceExtra.field ? [s.sourceExtra.field] : []);
    return fields.indexOf(name) !== -1;
  });
  if (skill) adjustSkillTotal(skill, newVal - oldVal);
}

function loadAndRenderHistory() {
  var c = document.getElementById('history-container');
  if (!c) return;
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
      return;
    }
    renderTestHistory(c, items, entries);
  }).catch(function() { c.innerHTML = '<div class="empty">Ошибка загрузки.</div>'; });
}

function renderTestHistory(container, items, entries) {
  var last = entries[entries.length - 1];
  var prev = entries.length > 1 ? entries[entries.length - 2] : null;

  var html = '<div class="t3-list">';
  items.forEach(function(item, idx) {
    var hasAnyVal = entries.some(function(e) { return e.data[item.name] != null; });
    if (!hasAnyVal) return;
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
      ? '<span class="t3-last-val">' + lastVal + '</span><span class="t3-unit"> ' + item.unit + '</span>'
      : '<span class="t3-last-val" style="color:var(--text-muted)">—</span>';

    // History rows
    var maxVal = 0;
    if (!isTextType) {
      entries.forEach(function(e) { if (e.data[item.name] && e.data[item.name] > maxVal) maxVal = e.data[item.name]; });
    }
    var histHtml = '<div class="t3-history" id="t3-hist-' + idx + '" style="display:none">';
    entries.forEach(function(e, i) {
      var v = e.data[item.name];
      var eprev = i > 0 ? entries[i-1].data[item.name] : null;
      var ediff = (!isTextType && v != null && eprev != null) ? v - eprev : null;
      var pct = (!isTextType && v != null && maxVal > 0) ? Math.round(v / maxVal * 100) : 0;
      var isDown = ediff !== null && ediff < 0;
      var isUp   = ediff !== null && ediff > 0;
      var barColor = isDown ? '#F0997B' : '#1D9E75';
      var valColor = isDown ? '#D85A30' : (i === entries.length - 1 ? '#1D9E75' : 'var(--text)');
      var valWeight = i === entries.length - 1 ? '600' : '500';
      var diffHtml = isTextType ? '' :
        (ediff === null ? '<span style="width:30px"></span>'
        : (isUp   ? '<span style="font-size:11px;color:#1D9E75;width:30px">+' + ediff + '</span>'
        : (isDown ? '<span style="font-size:11px;color:#D85A30;width:30px">' + ediff + '</span>'
        :           '<span style="font-size:11px;color:var(--text-muted);width:30px">0</span>')));
      var unit = item.unit && item.unit !== 'раз' ? '<span style="font-size:11px;color:var(--text-muted)"> ' + item.unit + '</span>' : '';
      var barHtml = isTextType ? '' : '<div class="t3-bar-wrap"><div class="t3-bar-inner" style="width:' + pct + '%;background:' + barColor + '"></div></div>';
      histHtml += '<div class="t3-hist-row">' +
        '<div class="t3-hist-date">' + (e.data.date || e.dk) + '</div>' +
        barHtml +
        '<div class="t3-hist-val" style="color:' + valColor + ';font-weight:' + valWeight + '">' + (v != null ? v : '—') + unit + '</div>' +
        diffHtml +
      '</div>';
    });
    histHtml += '</div>';

    html += '<div class="t3-item' + (idx === items.length - 1 ? ' t3-item-last' : '') + '" onclick="toggleTestHistory(' + idx + ', this)">' +
      '<div class="t3-row-main">' +
        '<div class="t3-item-name">' + item.name + '</div>' +
        '<div style="display:flex;align-items:center;gap:8px">' +
          valHtml + badgeHtml +
          '<span class="t3-chevron">▼</span>' +
        '</div>' +
      '</div>' +
      histHtml +
    '</div>';
  });
  html += '</div>';
  container.innerHTML = html;
}

function toggleTestHistory(idx, el) {
  var hist = document.getElementById('t3-hist-' + idx);
  var chev = el.querySelector('.t3-chevron');
  if (!hist) return;
  var isOpen = hist.style.display !== 'none';
  hist.style.display = isOpen ? 'none' : 'block';
  if (chev) chev.style.transform = isOpen ? '' : 'rotate(180deg)';
  el.style.background = '';
}
