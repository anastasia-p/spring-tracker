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
  var icons = {
    tree:    '<svg viewBox="0 0 24 24" fill="none"><path d="M12 20v-8" stroke="#1D9E75" stroke-width="2" stroke-linecap="round"/><path d="M12 12 Q13 6 19 4 Q18 11 12 12Z" fill="#1D9E75"/><path d="M12 15 Q11 9 5 8 Q6 14 12 15Z" fill="#5DCAA5"/></svg>',
    mountain:'<svg width="20" height="20" viewBox="0 0 30 30" fill="none"><path d="M3 25 L15 5 L27 25 Z" fill="#7F77DD"/><path d="M8 25 L15 13 L22 25 Z" fill="#534AB7"/><path d="M12 9 L15 5 L18 9 L15 12 Z" fill="white"/></svg>',
    pushups: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 12h12M6 12c0-2 1.5-4 4-4M6 12c0 2 1.5 4 4 4M18 12c0-2-1.5-4-4-4M18 12c0 2-1.5 4-4 4" stroke="#993C1D" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="4" r="2" fill="#D85A30"/><circle cx="12" cy="20" r="2" fill="#D85A30"/></svg>',
    pullups: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 20V8" stroke="#185FA5" stroke-width="1.8" stroke-linecap="round"/><path d="M7 13l5-5 5 5" stroke="#185FA5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 20h14" stroke="#378ADD" stroke-width="1.5" stroke-linecap="round"/></svg>',
    slt:     '<span style="font-size:18px;font-family:serif;color:#534AB7;line-height:1">小</span>',
    ck:      '<span style="font-size:18px;font-family:serif;color:#534AB7;line-height:1">桥</span>',
    lotus:        '<svg viewBox="0 0 24 24" fill="none"><ellipse cx="12" cy="16" rx="10" ry="3" fill="#E8C8F0" opacity="0.4"/><path d="M12 16 Q6 10 9 1 Q13 8 12 16Z" fill="#D4A0E0"/><path d="M12 16 Q18 10 15 1 Q11 8 12 16Z" fill="#B06FC4"/><path d="M12 16 Q2 12 3 5 Q8 11 12 16Z" fill="#C880D8"/><path d="M12 16 Q22 12 21 5 Q16 11 12 16Z" fill="#9B4FB5"/><path d="M12 16 Q4 17 1 11 Q7 14 12 16Z" fill="#D4A0E0" opacity="0.7"/><path d="M12 16 Q20 17 23 11 Q17 14 12 16Z" fill="#B06FC4" opacity="0.7"/><circle cx="12" cy="15" r="2.5" fill="#F3E8FA"/><circle cx="12" cy="15" r="1.2" fill="#E8C8F0"/></svg>',
    forest_gump:  '<svg viewBox="-25 -58 50 92" fill="none"><polygon points="0,-48 -11,-24 11,-24" fill="#2E7D3F"/><polygon points="0,-32 -17,-4 17,-4" fill="#1D9E75"/><polygon points="0,-16 -23,20 23,20" fill="#2E7D3F"/><rect x="-5" y="20" width="10" height="10" rx="2" fill="#7B4F2E"/><polygon points="0,-54 2,-49 7,-49 3,-46 5,-41 0,-44 -5,-41 -3,-46 -7,-49 -2,-49" fill="#F5C842"/></svg>',
  };
  return icons[skill.id] || '';
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
    var isCur = lvl.level === current.level;
    var isPast = lvl.level < current.level;
    var opacity = lvl.level > current.level + 1 ? '0.45' : '1';
    return '<div class="level-row" style="opacity:' + opacity + '">' +
      '<div class="level-num' + (isCur ? ' cur' : '') + '">' + lvl.level + '</div>' +
      '<div class="level-info">' +
        '<div class="level-name">' + (isPast ? '<s>' : '') + lvl.name + (isPast ? '</s>' : '') + '</div>' +
        '<div class="level-desc">' + lvl.desc + '</div>' +
      '</div>' +
      '<div class="level-hours">' + formatLevelThreshold(skill, lvl) + '</div>' +
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
        '<div class="summary-card"><div class="summary-num" id="' + s + '-s-days">—</div><div class="summary-lbl">дней</div></div>' +
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
