// Navigation and app init

function showTab(name, btn) {
  document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
  document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
  document.getElementById('settings-btn').style.color = '';
  document.getElementById(name).classList.add('active');
  if (btn.classList.contains('tab-btn')) btn.classList.add('active');
  else btn.style.color = 'var(--green)';
  document.getElementById('sub-tabs').style.visibility = name === 'plan' ? 'visible' : 'hidden';
  if (name === 'progress') {
    loadAndRenderHistory();
    renderTreeProgress();
    renderMountainProgress();
    renderPushupProgress();
    renderPullupProgress();
  }
}

function showSubTab(name, btn) {
  document.querySelectorAll('.sub-screen').forEach(function(s) { s.classList.remove('active'); });
  document.querySelectorAll('.sub-tab').forEach(function(b) { b.classList.remove('active'); });
  document.getElementById(name).classList.add('active');
  btn.classList.add('active');
}

function initWithSections(sections) {
  // Update active sections
  SECTIONS = sections;

  // Show/hide sub-tabs
  var subTabsEl = document.getElementById('sub-tabs');
  subTabsEl.innerHTML = '';
  sections.forEach(function(s, i) {
    var tmpl = SECTION_TEMPLATES.find(function(t) { return t.id === s; });
    if (!tmpl) return;
    var btn = document.createElement('button');
    btn.className = 'sub-tab' + (i === 0 ? ' active' : '');
    btn.textContent = tmpl.label;
    btn.onclick = function() { showSubTab(s, btn); };
    subTabsEl.appendChild(btn);
  });

  // Show/hide sub-screens
  document.querySelectorAll('.sub-screen').forEach(function(el) { el.classList.remove('active'); });
  if (sections[0]) {
    var first = document.getElementById(sections[0]);
    if (first) first.classList.add('active');
  }

  // Show user email in header
  if (currentUser) {
    var emailEl = document.getElementById('user-email');
    if (emailEl) emailEl.textContent = currentUser.email;
  }

  Promise.all([
    loadPlanFromFirebase('tests'),
    loadTreeMinutes(),
    loadMountainSeconds(),
    loadPushupReps(),
    loadPullupReps(),
  ].concat(sections.map(function(s) { return loadPlanFromFirebase(s); })))
  .then(function() {
    sections.forEach(function(s) { renderSection(s); });
    renderTestForm();
    renderTreeProgress();
    renderMountainProgress();
    renderPushupProgress();
    renderPullupProgress();
  });
}
