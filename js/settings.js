var API_URL = 'https://api.spring-tracker.ru:8080';

function downloadPlan(section) {
  var plan = plans[section];
  if (!plan || !plan.length) {
    alert('План не загружен. Сначала обнови план.');
    return;
  }
  var btn = event.target;
  btn.disabled = true;
  btn.textContent = '...';
  fetch(API_URL + '/download/' + section, {
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

  var label = input.closest('label');
  if (label) { label.style.opacity = '0.6'; label.style.pointerEvents = 'none'; }

  // Получаем ID токен и только потом делаем запрос
  currentUser.getIdToken().then(function(token) {
    var formData = new FormData();
    formData.append('file', file);

    return fetch(API_URL + '/upload/' + section, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
      body: formData,
    });
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
    applyUploadedPlan(section, result.data);
  })
  .catch(function(e) { alert('Ошибка: ' + e.message); })
  .finally(function() {
    if (label) { label.style.opacity = ''; label.style.pointerEvents = ''; }
  });
}

function applyUploadedPlan(section, data) {
  var writePromise;
  if (section === 'tests') {
    // TODO: загрузка Excel с тестами в v2 требует разноса по секциям.
    // Пока передаём 'tests' как псевдо-секцию — в legacy работает напрямую,
    // в v2 пишет в sections/tests/tests/current, что НЕПРАВИЛЬНО. Исправить
    // после того как Excel-формат станет включать колонку "секция" для каждого теста.
    writePromise = saveTests(section, data);
  } else {
    writePromise = savePlan(section, data);
  }
  writePromise.then(function() {
    plans[section] = null;
    resetCache(section);
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

// --- Управление дисциплинами ---

function toggleSection(sectionId, checked, el) {
  if (!checked) {
    var meta0 = getSectionMeta(sectionId);
    var label = meta0 ? meta0.label : sectionId;
    if (!confirm('Убрать «' + label + '» из плана?\n\nДанные сохранятся — можно вернуть в любой момент.')) {
      el.checked = true;
      return;
    }
    var newSections = userSections.filter(function(s) { return s !== sectionId; });
    disableSection(sectionId).then(function() {
      initWithSections(newSections);
      renderSettingsPlans();
    });
    return;
  }

  el.disabled = true;
  var newSections = userSections.concat([sectionId]);
  var baseUrl = location.origin + location.pathname.replace(/[^/]*$/, '');
  var meta = SECTION_META[sectionId];

  // Если у секции ещё нет плана — загружаем дефолты. Иначе просто включаем.
  loadSectionPlan(sectionId).then(function(existingPlan) {
    if (existingPlan !== null) return Promise.resolve(); // план уже есть
    // Загружаем дефолтный план и (если есть) дефолтные тесты с сервера
    var planUrl = baseUrl + meta.defaultPlan + '?t=' + Date.now();
    var promises = [fetch(planUrl).then(function(r) { return r.json(); })];
    if (meta.defaultTests) {
      promises.push(fetch(baseUrl + meta.defaultTests + '?t=' + Date.now())
        .then(function(r) { return r.ok ? r.json() : []; }));
    } else {
      promises.push(Promise.resolve([]));
    }
    return Promise.all(promises).then(function(results) {
      return createSectionDefaults(sectionId, results[0], results[1]);
    });
  }).then(function() {
    return enableSection(sectionId);
  }).then(function() {
    return loadPlanFromFirebase('tests');
  }).then(function() {
    initWithSections(newSections);
    renderSettingsPlans();
  }).catch(function(e) {
    console.error('toggleSection:', e);
    el.checked = false;
    el.disabled = false;
  });
}
