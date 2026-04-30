var API_URL = 'https://api.spring-tracker.ru:8080';

function downloadPlan(section, btn) {
  var plan = plans[section];
  if (!plan || !plan.length) { alert('План не загружен. Сначала обнови план.'); return; }
  btn.disabled = true;
  btn.textContent = '...';
  fetch(API_URL + '/download/' + section, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: plan }),
  })
    .then(function(r) { if (!r.ok) throw new Error('Ошибка сервера'); return r.blob(); })
    .then(function(blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = section + '_plan.xlsx';
      a.click();
      setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
    })
    .catch(function(e) {
      console.error('downloadPlan:', e);
      alert('Извините, что-то сломалось. Напишите @Ponomareva_Anastasia');
    })
    .finally(function() { btn.disabled = false; btn.textContent = 'Скачать'; });
}

// --- Загрузка плана из Excel ---
function uploadPlan(section, input) {
  var file = input.files[0];
  if (!file) return;
  input.value = '';
  var label = input.closest('label');
  if (label) { label.style.opacity = '0.6'; label.style.pointerEvents = 'none'; }
  currentUser.getIdToken().then(function(token) {
    var formData = new FormData();
    formData.append('file', file);
    return fetch(API_URL + '/upload/' + section, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
      body: formData,
    });
  })
    .then(function(r) { if (!r.ok) throw new Error('Ошибка сервера'); return r.json(); })
    .then(function(result) {
      if (!result.valid) { showValidationPopup(file.name, result.errors, result.warnings); return; }
      if (result.warnings.length > 0) { showValidationPopup(file.name, [], result.warnings); }
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
    writePromise = saveAllTests(data);
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
    html += '<div style="font-weight:500;color:var(--red);margin-bottom:8px">Ошибки — файл не загружен:</div>';
    errors.forEach(function(e) {
      var loc = e.sheet ? (e.sheet + (e.row ? ', строка ' + e.row : '')) : '';
      html += '<div style="margin-bottom:6px;padding:6px 8px;background:var(--bg);border-radius:6px">';
      if (loc) html += '<span style="font-weight:500">' + escapeHtml(loc) + '</span> — ';
      html += escapeHtml(e.message) + '</div>';
    });
  }
  if (warnings.length > 0) {
    html += '<div style="font-weight:500;color:var(--warning);margin-bottom:8px' + (errors.length ? ';margin-top:12px' : '') + '">Предупреждения:</div>';
    warnings.forEach(function(w) {
      var loc = w.sheet ? (w.sheet + (w.row ? ', строка ' + w.row : '')) : '';
      html += '<div style="margin-bottom:6px;padding:6px 8px;background:var(--bg);border-radius:6px">';
      if (loc) html += '<span style="font-weight:500">' + escapeHtml(loc) + '</span> — ';
      html += escapeHtml(w.message) + '</div>';
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
      renderSettings();
    });
    return;
  }
  el.disabled = true;
  var newSections = userSections.concat([sectionId]);
  var baseUrl = location.origin + location.pathname.replace(/[^/]*$/, '');
  var meta = SECTION_META[sectionId];
  loadSectionPlan(sectionId).then(function(existingPlan) {
    if (existingPlan !== null) return Promise.resolve();
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
    renderSettings();
  }).catch(function(e) {
    console.error('toggleSection:', e);
    el.checked = false;
    el.disabled = false;
  });
}

// --- Рендер экрана настроек ---

function renderAccount(container) {
  var div = document.createElement('div');
  div.className = 'settings-group';
  div.style.marginBottom = '16px';

  if (currentUser && currentUser.isAnonymous) {
    div.style.padding = '16px';
    div.innerHTML = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">'
      + '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>'
      + '<line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'
      + '</svg>'
      + '<div style="font-size:14px;font-weight:500">Гостевой аккаунт</div>'
      + '</div>'
      + '<div style="font-size:13px;color:var(--text-muted);line-height:1.5;margin-bottom:14px">'
      + 'Сейчас вы используете гостевой аккаунт. Чтобы прогресс не пропал при очистке браузера, зарегистрируйтесь.'
      + '</div>'
      + '<button class="update-btn" id="link-account-btn" style="width:100%">Сохранить прогресс</button>';
  } else {
    var email = (currentUser && currentUser.email) || '';
    div.innerHTML = '<div class="settings-item">'
      + '<div>'
      + '<div class="settings-item-desc">Аккаунт</div>'
      + '<div id="settings-user-email" style="font-size:13px;font-weight:400;color:var(--text-muted)">' + escapeHtml(email) + '</div>'
      + '</div>'
      + '<button class="update-btn" id="logout-btn">Выйти</button>'
      + '</div>';
  }

  container.appendChild(div);

  var linkBtn = div.querySelector('#link-account-btn');
  if (linkBtn) linkBtn.onclick = openLinkPopup;
  var logoutBtn = div.querySelector('#logout-btn');
  if (logoutBtn) logoutBtn.onclick = doLogout;
}

function renderDisciplines(container) {
  var title = document.createElement('div');
  title.className = 'section-title';
  title.textContent = 'Дисциплины';
  container.appendChild(title);

  var group = document.createElement('div');
  group.className = 'settings-group';
  group.style.marginBottom = '16px';
  group.innerHTML = SECTIONS.map(function(id) {
    var meta = SECTION_META[id];
    var active = userSections.indexOf(id) !== -1;
    return '<div class="settings-item">'
      + '<span class="settings-item-label">' + meta.label + '</span>'
      + '<label class="toggle-switch">'
      + '<input type="checkbox"' + (active ? ' checked' : '') + ' data-action="toggle-section" data-section="' + id + '">'
      + '<span class="toggle-slider"></span>'
      + '</label>'
      + '</div>';
  }).join('');
  container.appendChild(group);

  group.querySelectorAll('input[data-action="toggle-section"]').forEach(function(input) {
    input.onchange = function() { toggleSection(input.dataset.section, input.checked, input); };
  });
}

// Навешивает обработчики на кнопки «Скачать» и инпуты «Загрузить» внутри группы
// настроек. Вызывается из renderPlans/renderTests после вставки group в DOM.
// Кнопки/инпуты различаются по data-action, секция передается через data-section.
function _bindPlanGroupHandlers(group) {
  group.querySelectorAll('button[data-action="download"]').forEach(function(btn) {
    btn.onclick = function() { downloadPlan(btn.dataset.section, btn); };
  });
  group.querySelectorAll('input[type="file"][data-action="upload"]').forEach(function(input) {
    input.onchange = function() { uploadPlan(input.dataset.section, input); };
  });
}

function renderPlans(container) {
  if (!userSections.length) return;

  var title = document.createElement('div');
  title.className = 'section-title';
  title.textContent = 'Планы';
  container.appendChild(title);

  var group = document.createElement('div');
  group.className = 'settings-group';
  group.style.marginBottom = '16px';
  group.innerHTML = userSections.map(function(section) {
    var meta = getSectionMeta(section);
    var label = meta ? meta.label : section;
    return '<div class="settings-item">'
      + '<div><div class="settings-item-label">' + label + '</div>'
      + '<div class="update-status" id="status-' + section + '"></div></div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
      + '<button class="update-btn" data-action="download" data-section="' + section + '">Скачать</button>'
      + '<label class="update-btn" style="cursor:pointer">Загрузить'
      + '<input type="file" accept=".xlsx" style="display:none" data-action="upload" data-section="' + section + '">'
      + '</label>'
      + '</div>'
      + '</div>';
  }).join('');
  container.appendChild(group);
  _bindPlanGroupHandlers(group);
}

function renderTests(container) {
  var title = document.createElement('div');
  title.className = 'section-title';
  title.textContent = 'Тесты';
  container.appendChild(title);

  var group = document.createElement('div');
  group.className = 'settings-group';
  group.style.marginBottom = '16px';
  group.innerHTML = '<div class="settings-item">'
    + '<div><div class="settings-item-label">Список показателей</div>'
    + '<div class="update-status" id="status-tests"></div></div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
    + '<button class="update-btn" data-action="download" data-section="tests">Скачать</button>'
    + '<label class="update-btn" style="cursor:pointer">Загрузить'
    + '<input type="file" accept=".xlsx" style="display:none" data-action="upload" data-section="tests">'
    + '</label>'
    + '</div>'
    + '</div>';
  container.appendChild(group);
  _bindPlanGroupHandlers(group);
}

// --- О приложении (в самом низу экрана настроек) ---
function renderAboutApp(container) {
  if (!container) return;
  var existing = container.querySelector('.about-app');
  if (existing) existing.remove();
  var v = window.APP_VERSION || { sha: 'unknown', date: 'unknown' };
  var block = document.createElement('div');
  block.className = 'about-app';
  block.style.cssText = 'margin-top:28px;padding:14px 0 8px;border-top:1px solid var(--border-light);font-size:13px;color:var(--text-muted)';
  block.innerHTML = '<div style="font-weight:500;margin-bottom:8px;color:var(--text-subtle)">О приложении</div>'
    + '<div style="display:grid;grid-template-columns:72px 1fr;gap:4px 12px;font-family:var(--font-mono,ui-monospace,SFMono-Regular,Menlo,monospace)">'
    + '<span style="color:var(--text-hint)">Версия</span><span>' + escapeHtml(v.sha) + '</span>'
    + '<span style="color:var(--text-hint)">Собрано</span><span>' + escapeHtml(v.date) + '</span>'
    + '</div>'
    + '<div style="margin-top:10px">Обратная связь: <a href="https://t.me/Ponomareva_Anastasia" target="_blank" rel="noopener noreferrer" style="color:var(--link);text-decoration:none">@Ponomareva_Anastasia</a></div>';
  container.appendChild(block);
}

// --- Главная функция — рендерит весь экран настроек ---
function renderSettings() {
  var screen = document.getElementById('settings');
  if (!screen) return;
  screen.innerHTML = '<div class="section-pad" id="settings-content"></div>';
  var container = document.getElementById('settings-content');
  renderAccount(container);
  renderDisciplines(container);
  renderPlans(container);
  renderTests(container);
  renderAboutApp(container);
}
