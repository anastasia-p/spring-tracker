function downloadPlan(section) {
  var plan = plans[section];
  if (!plan || !plan.length) {
    alert('План не загружен. Сначала обнови план.');
    return;
  }
  var btn = event.target;
  btn.disabled = true;
  btn.textContent = '...';
  fetch('https://api.spring-tracker.ru:8080/download/' + section, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: plan }),
  })
  .then(function(r) {
    if (!r.ok) throw new Error('Ошибка сервера');
    return r.blob();
  })
  .then(function(blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = section + '_plan.xlsx';
    a.click();
    setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
  })
  .catch(function(e) { alert('Ошибка: ' + e.message); })
  .finally(function() {
    btn.disabled = false;
    btn.textContent = 'Скачать';
  });
}

// --- Загрузка плана из Excel ---

function uploadPlan(section, input) {
  var file = input.files[0];
  if (!file) return;
  input.value = '';

  var formData = new FormData();
  formData.append('file', file);

  var label = input.closest('label');
  if (label) { label.style.opacity = '0.6'; label.style.pointerEvents = 'none'; }

  fetch('https://api.spring-tracker.ru:8080/upload/' + section, {
    method: 'POST',
    body: formData,
  })
  .then(function(r) {
    if (!r.ok) throw new Error('Ошибка сервера');
    return r.json();
  })
  .then(function(result) {
    if (!result.valid) {
      showValidationPopup(file.name, result.errors, result.warnings);
      return;
    }
    if (result.warnings.length > 0) {
      showValidationPopup(file.name, [], result.warnings);
    }
    // Сохраняем в Firebase
    var field = section === 'tests' ? 'items' : 'days';
    var doc = { updatedAt: new Date().toISOString() };
    doc[field] = result.data;
    userCol('plan').doc(section).set(doc).then(function() {
      plans[section] = null;
      if (section !== 'tests') cache[section] = {};
      return loadPlanFromFirebase(section);
    }).then(function() {
      if (section === 'tests') {
        renderTestForm();
      } else {
        renderSection(section);
      }
      var statusEl = document.getElementById('status-' + section);
      if (statusEl) { statusEl.textContent = 'Загружено!'; statusEl.className = 'update-status ok'; }
    });
  })
  .catch(function(e) { alert('Ошибка: ' + e.message); })
  .finally(function() {
    if (label) { label.style.opacity = ''; label.style.pointerEvents = ''; }
  });
}

// --- Попап валидации ---

function showValidationPopup(filename, errors, warnings) {
  var title = document.getElementById('validation-title');
  var list = document.getElementById('validation-list');

  var hasErrors = errors.length > 0;
  var count = errors.length + warnings.length;
  title.textContent = (hasErrors ? 'Ошибки в файле' : 'Предупреждения') + ' (' + count + ')';

  var html = '';
  if (errors.length > 0) {
    html += '<div style="font-weight:500;color:var(--red,#E24B4A);margin-bottom:8px">Ошибки — файл не загружен:</div>';
    errors.forEach(function(e) {
      var loc = e.sheet ? (e.sheet + (e.row ? ', строка ' + e.row : '')) : '';
      html += '<div style="margin-bottom:6px;padding:6px 8px;background:var(--bg-secondary,#F7F6F2);border-radius:6px">';
      if (loc) html += '<span style="font-weight:500">' + loc + '</span> — ';
      html += e.message + '</div>';
    });
  }
  if (warnings.length > 0) {
    html += '<div style="font-weight:500;color:#BA7517;margin-bottom:8px' + (errors.length ? ';margin-top:12px' : '') + '">Предупреждения:</div>';
    warnings.forEach(function(w) {
      var loc = w.sheet ? (w.sheet + (w.row ? ', строка ' + w.row : '')) : '';
      html += '<div style="margin-bottom:6px;padding:6px 8px;background:var(--bg-secondary,#F7F6F2);border-radius:6px">';
      if (loc) html += '<span style="font-weight:500">' + loc + '</span> — ';
      html += w.message + '</div>';
    });
  }
  list.innerHTML = html;

  document.getElementById('validation-overlay').style.display = 'block';
  var popup = document.getElementById('validation-popup');
  popup.style.display = 'flex';
  popup.style.flexDirection = 'column';
}

function closeValidationPopup() {
  document.getElementById('validation-overlay').style.display = 'none';
  document.getElementById('validation-popup').style.display = 'none';
}

function copyValidationErrors() {
  var list = document.getElementById('validation-list');
  var text = list.innerText;
  var btn = event.target;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function() {
      btn.textContent = 'Скопировано!';
      setTimeout(function() { btn.textContent = 'Скопировать'; }, 2000);
    }).catch(function() { fallbackCopy(text, btn); });
  } else {
    fallbackCopy(text, btn);
  }
}

function fallbackCopy(text, btn) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  btn.textContent = 'Скопировано!';
  setTimeout(function() { btn.textContent = 'Скопировать'; }, 2000);
}
