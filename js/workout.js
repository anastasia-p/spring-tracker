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
    var html = '<div class="history-wrap"><table class="history-table"><thead><tr><th>Дата</th>';
    items.forEach(function(item) { html += '<th>' + item.name.split(' ').pop() + '</th>'; });
    html += '</tr></thead><tbody>';
    entries.forEach(function(e, i) {
      html += '<tr><td>' + (e.data.date || e.dk) + '</td>';
      items.forEach(function(item) {
        var v = e.data[item.name], delta = '';
        if (i > 0) {
          var prev = entries[i - 1].data[item.name];
          if (v != null && prev != null) {
            var diff = v - prev;
            if (diff > 0) delta = '<span class="delta up">+' + diff + '</span>';
            else if (diff < 0) delta = '<span class="delta down">' + diff + '</span>';
          }
        }
        html += '<td>' + (v != null ? v : '—') + delta + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    c.innerHTML = html;
  }).catch(function() { c.innerHTML = '<div class="empty">Ошибка загрузки.</div>'; });
}
