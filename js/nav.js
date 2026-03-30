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
    showProgressTab('skills');
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
    var tmpl = SECTION_TEMPLATES.find(function(t) { return t.id === s; });
    if (!tmpl) return;
    var btn = document.createElement('button');
    btn.className = 'sub-tab' + (i === 0 ? ' active' : '');
    btn.textContent = tmpl.label;
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

var SECTION_LABELS = {
  strength: 'Силовые',
  wingchun: 'Вин Чун',
  qigong:   'Цигун',
};

function renderProgressTabs(sections) {
  var tabsEl = document.getElementById('sub-tabs');
  tabsEl.innerHTML = '';

  var skillsBtn = document.createElement('button');
  skillsBtn.className = 'sub-tab active';
  skillsBtn.textContent = 'Навыки';
  skillsBtn.onclick = function() { showProgressTab('skills', skillsBtn); };
  tabsEl.appendChild(skillsBtn);

  var testBtn = document.createElement('button');
  testBtn.className = 'sub-tab';
  testBtn.textContent = 'Тесты';
  testBtn.onclick = function() { showProgressTab('tests', testBtn); };
  tabsEl.appendChild(testBtn);
}

function showProgressTab(section, btn) {
  // Update active tab button
  document.querySelectorAll('#sub-tabs .sub-tab').forEach(function(b) { b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  else {
    // Activate by section name
    document.querySelectorAll('#sub-tabs .sub-tab').forEach(function(b) {
      var label = SECTION_LABELS[section] || section;
      if (b.textContent === label || (section === 'tests' && b.textContent === 'Тесты')) {
        b.classList.add('active');
      }
    });
  }

  var container = document.getElementById('progress-content');

  if (section === 'tests') {
    renderTestsTab(container);
    return;
  }

  if (section === 'skills') {
    renderAllSkillsGrid(container);
    return;
  }
}

function renderAllSkillsGrid(container) {
  container.innerHTML = '<div class="sk-grid" id="sk-grid"></div>';
  var grid = document.getElementById('sk-grid');
  SKILLS.forEach(function(skill) {
    grid.appendChild(buildSkillCardCompact(skill));
    renderSkillCard(skill);
  });
}

function buildSkillCardCompact(skill) {
  var prefix = getElemPrefix(skill.id);
  var div = document.createElement('div');
  div.className = 'sk-card';
  div.innerHTML =
    '<div class="sk-head">' +
      '<div class="sk-icon" style="background:' + skill.bgColor + '">' +
        getSkillIcon(skill) +
      '</div>' +
      '<div class="sk-info">' +
        '<div class="sk-name">' + skill.name + '</div>' +
        '<div class="sk-level" id="' + prefix + '-level-name">Загрузка...</div>' +
      '</div>' +
      '<button class="sk-q" onclick="showSkillLevels('' + skill.id + '');event.stopPropagation()">?</button>' +
    '</div>' +
    '<div class="sk-amount" id="' + prefix + '-hours"></div>' +
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

function buildSkillCard(skill) {
  var prefix = getElemPrefix(skill.id);
  var div = document.createElement('div');
  div.innerHTML =
    '<div class="section-title">' + skill.name + '</div>' +
    '<div class="tree-card">' +
      '<div class="tree-header">' +
        '<div class="tree-title-wrap">' +
          '<div class="tree-icon" style="background:' + skill.bgColor + '">' +
            getSkillIcon(skill) +
          '</div>' +
          '<div>' +
            '<div class="tree-level-name" id="' + prefix + '-level-name">Загрузка...</div>' +
            '<div class="tree-hours" id="' + prefix + '-hours"></div>' +
          '</div>' +
        '</div>' +
        '<button class="tree-q-btn" onclick="showSkillLevels(\'' + skill.id + '\')">?</button>' +
      '</div>' +
      '<div class="tree-progress-wrap">' +
        '<div class="tree-progress-bar" id="' + prefix + '-progress-bar" style="width:0%;background:' + skill.color + '"></div>' +
      '</div>' +
      '<div class="tree-progress-labels">' +
        '<span id="' + prefix + '-label-left"></span>' +
        '<span id="' + prefix + '-progress-pct"></span>' +
        '<span id="' + prefix + '-label-right"></span>' +
      '</div>' +
    '</div>';
  return div;
}

function getSkillIcon(skill) {
  var icons = {
    tree:     '<svg viewBox="0 0 24 24" fill="none"><path d="M12 20v-8" stroke="#1D9E75" stroke-width="2" stroke-linecap="round"/><path d="M12 12 Q13 6 19 4 Q18 11 12 12Z" fill="#1D9E75"/><path d="M12 15 Q11 9 5 8 Q6 14 12 15Z" fill="#5DCAA5"/></svg>',
    mountain: '<svg width="20" height="20" viewBox="0 0 30 30" fill="none"><path d="M3 25 L15 5 L27 25 Z" fill="#7F77DD"/><path d="M8 25 L15 13 L22 25 Z" fill="#534AB7"/><path d="M12 9 L15 5 L18 9 L15 12 Z" fill="white"/></svg>',
    pushups:  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 12h12M6 12c0-2 1.5-4 4-4M6 12c0 2 1.5 4 4 4M18 12c0-2-1.5-4-4-4M18 12c0 2-1.5 4-4 4" stroke="#993C1D" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="4" r="2" fill="#D85A30"/><circle cx="12" cy="20" r="2" fill="#D85A30"/></svg>',
    pullups:  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 20V8" stroke="#185FA5" stroke-width="1.8" stroke-linecap="round"/><path d="M7 13l5-5 5 5" stroke="#185FA5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 20h14" stroke="#378ADD" stroke-width="1.5" stroke-linecap="round"/></svg>',
    slt:      '<span style="font-size:18px;font-family:serif;color:#534AB7;line-height:1">小</span>',
    ck:       '<span style="font-size:18px;font-family:serif;color:#534AB7;line-height:1">桥</span>',
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

  // Remove existing popup if any
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

  // Fill levels
  var listEl = document.getElementById('dynamic-levels-list');
  var total   = getSkillTotal(skill);
  var levels  = skill.levels;
  var current = getLevelForSkill(skill, total);
  var html = levels.map(function(lvl) {
    var isCur  = lvl.level === current.level;
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

// --- Init ---

function initWithSections(sections) {
  userSections = sections;
  SECTIONS = sections;
  initSkillLevels();

  // Render plan tabs (plan is default active screen)
  renderPlanTabs();

  // Show user email
  if (currentUser) {
    var emailEl = document.getElementById('user-email');
    if (emailEl) emailEl.textContent = currentUser.email;
    var userInfo = document.getElementById('user-info');
    if (userInfo) userInfo.style.display = 'flex';
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
    // Render first progress tab
    showProgressTab('skills');
  });
}
