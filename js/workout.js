// Test form and history

function renderTestForm() {
  var items = plans.tests || [];
  var grid = document.getElementById('test-grid');
  if (!items.length) { grid.innerHTML = '<div class="loading">Загрузка теста...</div>'; return; }
  grid.innerHTML = items.map(function(item, i) {
    return '<div class="test-item">' +
      '<div class="test-label">' + item.name + (item.note ? '<span style="color:var(--text-hint);font-size:10px;display:block">' + item.note + '</span>' : '') + '</div>' +
      '<input class="test-input" type="number" id="ti_' + i + '" placeholder="—">' +
      '<div class="test-unit">' + item.unit + '</div>' +
    '</div>';
  }).join('');
}

function saveTest() {
  var items = plans.tests || [];
  var now = new Date(), dk = dateKey(now);
  var data = { date: now.toLocaleDateString('ru'), plan: items };
  var hasVal = false;
  items.forEach(function(item, i) {
    var v = document.getElementById('ti_' + i);
    if (v && v.value !== '') { data[item.name] = parseInt(v.value); hasVal = true; }
  });
  if (!hasVal) return;
  saveTestData(dk, data);
  SKILLS.forEach(function(skill) {
    if (skill.sourceExtra && skill.sourceExtra.collection === 'tests') {
      recalcSkill(skill);
    }
  });
  document.getElementById('saved-msg').style.display = 'block';
  setTimeout(function() { document.getElementById('saved-msg').style.display = 'none'; }, 2000);
  items.forEach(function(_, i) { var v = document.getElementById('ti_' + i); if (v) v.value = ''; });
  loadAndRenderHistory();
}

function loadAndRenderHistory() {
  var c = document.getElementById('history-container');
  c.innerHTML = '<div class="loading">Загрузка...</div>';
  userCol('tests').get().then(function(snap) {
    snap.forEach(function(doc) { cache.tests[doc.id] = doc.data(); });
    var entries = [];
    snap.forEach(function(doc) { entries.push({ dk: doc.id, data: doc.data() }); });
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
