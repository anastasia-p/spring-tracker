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
  }).join('');
}

function handleTestCheck(name, unit, el) {
  if (el.checked) {
    // Show value popup
    var dk = dateKey(new Date());
    showValuePopup('tests', dk, name, unit, el);
  } else {
    // Uncheck — remove value
    var dk = dateKey(new Date());
    saveTestField(dk, name, null);
    renderTestForm();
  }
}

function saveTestField(dk, name, value) {
  if (!cache.tests[dk]) cache.tests[dk] = {};
  if (value === null) {
    delete cache.tests[dk][name];
  } else {
    cache.tests[dk][name] = value;
  }
  // Save to Firebase
  userCol('tests').doc(dk).set(cache.tests[dk]).catch(function() {});
  // Recalc relevant skills
  var skill = SKILLS.find(function(s) {
    if (!s.sourceExtra || s.sourceExtra.collection !== 'tests') return false;
    var fields = s.sourceExtra.fields || (s.sourceExtra.field ? [s.sourceExtra.field] : []);
    return fields.indexOf(name) !== -1;
  });
  if (skill) recalcSkill(skill);
}

function loadAndRenderHistory() {
  var c = document.getElementById('history-container');
  if (!c) return;
  c.innerHTML = '<div class="loading">Загрузка...</div>';
  userCol('tests').get().then(function(snap) {
    var entries = [];
    snap.forEach(function(doc) {
      cache.tests[doc.id] = doc.data();
      entries.push({ dk: doc.id, data: doc.data() });
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
    var lastVal = last.data[item.name];
    var prevVal = prev ? prev.data[item.name] : null;
    var diff = (lastVal != null && prevVal != null) ? lastVal - prevVal : null;
    var badgeHtml = '';
    var badgeStyle = 'min-width:44px;text-align:center';
    if (diff === null) {
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
    entries.forEach(function(e) { if (e.data[item.name] && e.data[item.name] > maxVal) maxVal = e.data[item.name]; });
    var histHtml = '<div class="t3-history" id="t3-hist-' + idx + '" style="display:none">';
    entries.forEach(function(e, i) {
      var v = e.data[item.name];
      var eprev = i > 0 ? entries[i-1].data[item.name] : null;
      var ediff = (v != null && eprev != null) ? v - eprev : null;
      var pct = (v != null && maxVal > 0) ? Math.round(v / maxVal * 100) : 0;
      var isDown = ediff !== null && ediff < 0;
      var isUp   = ediff !== null && ediff > 0;
      var barColor = isDown ? '#F0997B' : '#1D9E75';
      var valColor = isDown ? '#D85A30' : (i === entries.length - 1 ? '#1D9E75' : 'var(--text)');
      var valWeight = i === entries.length - 1 ? '600' : '500';
      var diffHtml = ediff === null ? '<span style="width:30px"></span>'
        : (isUp   ? '<span style="font-size:11px;color:#1D9E75;width:30px">+' + ediff + '</span>'
        : (isDown ? '<span style="font-size:11px;color:#D85A30;width:30px">' + ediff + '</span>'
        :           '<span style="font-size:11px;color:var(--text-muted);width:30px">0</span>'));
      var unit = item.unit && item.unit !== 'раз' ? '<span style="font-size:11px;color:var(--text-muted)"> ' + item.unit + '</span>' : '';
      histHtml += '<div class="t3-hist-row">' +
        '<div class="t3-hist-date">' + (e.data.date || e.dk) + '</div>' +
        '<div class="t3-bar-wrap"><div class="t3-bar-inner" style="width:' + pct + '%;background:' + barColor + '"></div></div>' +
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
