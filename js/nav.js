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
  }
}

function showSubTab(name, btn) {
  document.querySelectorAll('.sub-screen').forEach(function(s) { s.classList.remove('active'); });
  document.querySelectorAll('.sub-tab').forEach(function(b) { b.classList.remove('active'); });
  document.getElementById(name).classList.add('active');
  btn.classList.add('active');
}

function init() {
  Promise.all([
    loadPlanFromFirebase('strength'),
    loadPlanFromFirebase('wingchun'),
    loadPlanFromFirebase('qigong'),
    loadPlanFromFirebase('tests'),
    loadTreeMinutes(),
    loadMountainSeconds(),
  ]).then(function() {
    SECTIONS.forEach(function(s) { renderSection(s); });
    renderTestForm();
    renderTreeProgress();
    renderMountainProgress();
  });
}

init();
