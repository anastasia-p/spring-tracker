// Navigation and app init
var userSections = []; // sections chosen by this user

function showTab(name, btn) {
  document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
  document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
  document.getElementById('settings-btn').style.color = '';
  document.getElementById(name).classList.add('active');
  if (btn && btn.classList && btn.classList.contains('tab-btn')) btn.classList.add('active');
  else if (btn) btn.style.color = 'var(--green)';
  var subTabs = document.getElementById('sub-tabs');
  if (name === 'plan') {
    renderPlanTabs();
    subTabs.style.visibility = 'visible';
  } else if (name === 'progress') {
    renderProgressTabs(userSections);
    subTabs.style.visibility = 'visible';
  } else if (name === 'settings') {
    renderSettingsPlans();
    subTabs.style.visibility = 'hidden';
  } else {
    subTabs.style.visibility = 'hidden';
  }
}

function showSubTab(name, btn) {
  document.querySelectorAll('.sub-screen').forEach(function(s) { s.classList.remove('active'); });
  document.querySelectorAll('.sub-tab').forEach(function(b) { b.classList.remove('active'); });
  document.getElementById(name).classList.add('active');
  btn.classList.add('active');
}

// --- Plan tabs ---
function renderPlanTabs() {
  var subTabsEl = document.getElementById('sub-tabs');
  subTabsEl.innerHTML = '';
  userSections.forEach(function(s, i) {
    var meta = getSectionMeta(s);
    if (!meta) return;
    var btn = document.createElement('button');
    btn.className = 'sub-tab' + (i === 0 ? ' active' : '');
    btn.textContent = meta.label;
    btn.onclick = function() { showSubTab(s, btn); };
    subTabsEl.appendChild(btn);
  });
  // Activate first sub-screen
  document.querySelectorAll('.sub-screen').forEach(function(el) { el.classList.remove('active'); });
  if (userSections[0]) {
    var first = document.getElementById(userSections[0]);
    if (first) first.classList.add('active');
  }
}

// --- Progress tabs ---
function renderProgressTabs(sections) {
  var tabsEl = document.getElementById('sub-tabs');
  tabsEl.innerHTML = '';
  var skillsBtn = document.createElement('button');
  skillsBtn.className = 'sub-tab';
  skillsBtn.textContent = 'Навыки';
  skillsBtn.onclick = function() { showProgressTab('skills', skillsBtn); };
  tabsEl.appendChild(skillsBtn);
  var testBtn = document.createElement('button');
  testBtn.className = 'sub-tab';
  testBtn.textContent = 'Тесты';
  testBtn.onclick = function() { showProgressTab('tests', testBtn); };
  tabsEl.appendChild(testBtn);
  showProgressTab('skills', skillsBtn);
}

function showProgressTab(section, btn) {
  document.querySelectorAll('#sub-tabs .sub-tab').forEach(function(b) { b.classList.remove('active'); });
  if (btn) {
    btn.classList.add('active');
  } else {
    var label = (getSectionMeta(section) || {}).label || section;
    document.querySelectorAll('#sub-tabs .sub-tab').forEach(function(b) {
      if (b.textContent === label || (section === 'tests' && b.textContent === 'Тесты')) {
        b.classList.add('active');
      }
    });
  }
  var container = document.getElementById('progress-content');
  if (section === 'tests') { renderTestsTab(container); return; }
  if (section === 'skills') { renderAllSkillsGrid(container); return; }
}

function renderAllSkillsGrid(container) {
  container.innerHTML = '<div class="sk-grid" id="sk-grid"></div>';
  var grid = document.getElementById('sk-grid');
  var visibleSkills = SKILLS.filter(function(skill) {
    return userSections.indexOf(skill.section) !== -1;
  });
  // Сортируем по проценту прогресса к следующему уровню (по убыванию).
  // Навыки на максимальном уровне возвращают 100 и оказываются в начале —
  // позже они переедут на «Доску почёта» (см. техдолг).
  visibleSkills.sort(function(a, b) {
    var pa = getSkillProgress(a, skillTotals[a.id] || 0);
    var pb = getSkillProgress(b, skillTotals[b.id] || 0);
    return pb - pa;
  });
  visibleSkills.forEach(function(skill) {
    grid.appendChild(buildSkillCardCompact(skill));
    renderSkillCard(skill);
  });
}

function buildSkillCardCompact(skill) {
  var prefix = getElemPrefix(skill.id);
  var div = document.createElement('div');
  div.className = 'sk-card';
  div.innerHTML =
    '<button class="sk-q" onclick="showSkillLevels(\'' + skill.id + '\');event.stopPropagation()">?</button>' +
    '<div class="sk3-name-row"><div class="sk-name">' + skill.name + '</div></div>' +
    '<div class="sk3-mid">' +
      '<div class="sk-icon" style="background:' + skill.bgColor + '">' + getSkillIcon(skill) + '</div>' +
      '<div class="sk-amount" id="' + prefix + '-hours"></div>' +
    '</div>' +
    '<div class="sk-level" id="' + prefix + '-level-name">Загрузка...</div>' +
    '<div class="tree-progress-wrap">' +
      '<div class="tree-progress-bar" id="' + prefix + '-progress-bar" style="width:0%;background:' + skill.color + '"></div>' +
    '</div>' +
    '<div class="tree-progress-labels">' +
      '<span id="' + prefix + '-label-left"></span>' +
      '<span id="' + prefix + '-progress-pct"></span>' +
      '<span id="' + prefix + '-label-right"></span>' +
    '</div>';
  return div;
}

function getSkillIcon(skill) {
  return (skill && skill.icon) || '';
}

function renderTestsTab(container) {
  container.innerHTML = '<div class="section-title">История тестов</div><div id="history-container"><div class="empty">Пока нет ни одного теста.</div></div>';
  loadAndRenderHistory();
}

// Universal levels popup — creates popup dynamically
function showSkillLevels(skillId) {
  var skill = getSkillById(skillId);
  if (!skill) return;
  var existing = document.getElementById('dynamic-levels-popup');
  if (existing) existing.remove();
  var prefix = getElemPrefix(skillId);
  var popup = document.createElement('div');
  popup.id = 'dynamic-levels-popup';
  popup.className = 'popup-overlay';
  popup.style.display = 'flex';
  var titleName = skill.name.toUpperCase();
  popup.innerHTML =
    '<div class="popup-box">' +
      '<div class="popup-header">' +
        '<span class="popup-title">' + titleName + '<br><span style="font-size:12px;font-weight:400;color:var(--text-muted)">Шкала опыта</span></span>' +
        '<button class="popup-close" onclick="document.getElementById(\'dynamic-levels-popup\').remove()">×</button>' +
      '</div>' +
      '<div class="levels-scroll"><div id="dynamic-levels-list"></div></div>' +
    '</div>';
  document.body.appendChild(popup);
  var listEl = document.getElementById('dynamic-levels-list');
  var total = getSkillTotal(skill);
  var levels = skill.levels;
  var current = getLevelForSkill(skill, total);
  var html = levels.map(function(lvl) {
    var isCur  = lvl.level === current.level;
    var isPast = lvl.level < current.level;
    var isNext = lvl.level === current.level + 1;

    var numStyle;
    if (isCur)       numStyle = 'background:' + skill.color + ';color:#fff;border-color:' + skill.color + ';font-weight:700';
    else if (isPast) numStyle = 'background:#f0f0f0;color:#c0c0c0;border-color:#e8e8e8';
    else             numStyle = 'background:#fff;color:#d0d0d0;border-color:#e8e8e8';

    var nameStyle, descStyle, hoursStyle;
    if (isCur) {
      nameStyle  = 'font-weight:700;color:var(--text)';
      descStyle  = 'color:var(--text-muted)';
      hoursStyle = '';
    } else if (isPast) {
      nameStyle  = 'text-decoration:line-through;color:#c0c0c0';
      descStyle  = 'color:#d0d0d0';
      hoursStyle = 'color:#d0d0d0';
    } else if (isNext) {
      nameStyle  = 'font-weight:600;color:' + skill.color;
      descStyle  = 'color:' + skill.color + ';opacity:0.75';
      hoursStyle = 'color:' + skill.color;
    } else {
      nameStyle  = 'color:#c8c8c8';
      descStyle  = 'color:#d8d8d8';
      hoursStyle = 'color:#d8d8d8';
    }

    return '<div class="level-row">' +
      '<div class="level-num" style="' + numStyle + '">' + lvl.level + '</div>' +
      '<div class="level-info">' +
        '<div class="level-name" style="' + nameStyle + '">' + lvl.name + '</div>' +
        '<div class="level-desc" style="' + descStyle + '">' + lvl.desc + '</div>' +
      '</div>' +
      '<div class="level-hours" style="' + hoursStyle + '">' + formatLevelThreshold(skill, lvl) + '</div>' +
    '</div>';
  }).join('');
  listEl.innerHTML = html;
}

// --- Plan screens (dynamic) ---
function renderPlanScreens(sections) {
  var planEl = document.getElementById('plan');
  planEl.innerHTML = '';
  sections.forEach(function(s, i) {
    var div = document.createElement('div');
    div.id = s;
    div.className = 'sub-screen' + (i === 0 ? ' active' : '');
    div.innerHTML =
      '<div id="' + s + '-week-stars" class="week-stars"></div>' +
      '<div class="week-nav">' +
        '<button onclick="changeWeek(-1)">←</button>' +
        '<span id="' + s + '-week-label"></span>' +
        '<button onclick="changeWeek(1)">→</button>' +
      '</div>' +
      '<div class="summary-grid">' +
        '<div class="summary-card" style="background:#E1F5EE"><div class="summary-num" id="' + s + '-s-days">—</div><div class="summary-lbl" id="' + s + '-s-days-lbl">дней подряд</div></div>' +
        '<div class="summary-card"><div class="summary-num" id="' + s + '-s-ex">—</div><div class="summary-lbl">упражнений</div></div>' +
        '<div class="summary-card"><div class="summary-num" id="' + s + '-s-pct">—</div><div class="summary-lbl">прогресс</div></div>' +
      '</div>' +
      '<div id="' + s + '-days"><div class="loading">Загрузка...</div></div>';
    planEl.appendChild(div);
  });
}

// --- Init ---
function initWithSections(sections) {
  userSections = sections;
  renderPlanScreens(sections);
  // Render plan tabs (plan is default active screen)
  renderPlanTabs();
  // Show user email in settings
  if (currentUser) {
    var emailEl = document.getElementById('settings-user-email');
    if (emailEl) emailEl.textContent = currentUser.email;
  }
  // Load data
  var loadPromises = [
    loadDayTypes(),
    loadPlanFromFirebase('tests'),
    loadTestsCache(),
    loadAllSkills(),
  ].concat(sections.map(function(s) { return loadPlanFromFirebase(s); }));
  Promise.all(loadPromises).then(function() {
    sections.forEach(function(s) { renderSection(s); });
    renderTestForm();
  });
}

function renderSettingsPlans() {
  var container = document.getElementById('settings-plans-list');
  if (!container) return;

  if (!document.getElementById('toggle-switch-style')) {
    var style = document.createElement('style');
    style.id = 'toggle-switch-style';
    style.textContent =
      '.toggle-switch{position:relative;display:inline-block;width:44px;height:24px;flex-shrink:0}' +
      '.toggle-switch input{opacity:0;width:0;height:0}' +
      '.toggle-slider{position:absolute;cursor:pointer;inset:0;background:#ccc;border-radius:24px;transition:.2s}' +
      '.toggle-slider:before{content:"";position:absolute;width:18px;height:18px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.2s}' +
      '.toggle-switch input:checked+.toggle-slider{background:#1D9E75}' +
      '.toggle-switch input:checked+.toggle-slider:before{transform:translateX(20px)}' +
      '.toggle-switch input:disabled+.toggle-slider{opacity:0.5;cursor:not-allowed}';
    document.head.appendChild(style);
  }

  var togglesHtml =
    '<div class="section-title">Дисциплины</div>' +
    '<div class="settings-group" style="margin-bottom:16px">' +
      SECTIONS.map(function(id) {
        var meta = SECTION_META[id];
        var active = userSections.indexOf(id) !== -1;
        return '<div class="settings-item">' +
          '<span class="settings-item-label">' + meta.label + '</span>' +
          '<label class="toggle-switch">' +
            '<input type="checkbox"' + (active ? ' checked' : '') +
            ' onchange="toggleSection(\'' + id + '\',this.checked,this)">' +
            '<span class="toggle-slider"></span>' +
          '</label>' +
        '</div>';
      }).join('') +
    '</div>';

  var plansHtml = userSections.length > 0
    ? '<div class="section-title">Планы</div>' +
      '<div class="settings-group" style="margin-bottom:16px">' +
      userSections.map(function(section) {
        var meta = getSectionMeta(section);
        var label = meta ? meta.label : section;
        return '<div class="settings-item">' +
          '<div><div class="settings-item-label">' + label + '</div>' +
          '<div class="update-status" id="status-' + section + '"></div></div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
            '<button class="update-btn" onclick="downloadPlan(\'' + section + '\')">Скачать</button>' +
            '<label class="update-btn" style="cursor:pointer">Загрузить' +
              '<input type="file" accept=".xlsx" style="display:none" onchange="uploadPlan(\'' + section + '\', this)">' +
            '</label>' +
          '</div>' +
        '</div>';
      }).join('') +
      '</div>'
    : '';

  container.innerHTML = togglesHtml + plansHtml;
}
