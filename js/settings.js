var BASE_URL = location.origin + location.pathname.replace('index.html', '');

function updatePlan(section) {
  var btn = event.target;
  var statusEl = document.getElementById('status-' + section);
  btn.disabled = true;
  btn.textContent = '...';
  statusEl.textContent = '';
  statusEl.className = 'update-status';

  var url = BASE_URL + 'plans/' + section + '.json?t=' + Date.now();

  fetch(url)
    .then(function(r) {
      if (!r.ok) throw new Error('Файл не найден');
      return r.json();
    })
    .then(function(data) {
      var field = section === 'tests' ? 'items' : 'days';
      var doc = { updatedAt: new Date().toISOString() };
      doc[field] = data;
      return userCol('plan').doc(section).set(doc);
    })
    .then(function() {
      plans[section] = null;
      cache = { strength: {}, wingchun: {}, qigong: {} };
      return loadPlanFromFirebase(section);
    })
    .then(function() {
      if (section === 'tests') {
        renderTestForm();
      } else {
        renderSection(section);
      }
      statusEl.textContent = 'Обновлено';
      statusEl.className = 'update-status ok';
      btn.disabled = false;
      btn.textContent = 'Обновить';
    })
    .catch(function(e) {
      statusEl.textContent = 'Ошибка: ' + e.message;
      statusEl.className = 'update-status err';
      btn.disabled = false;
      btn.textContent = 'Обновить';
    });
}
