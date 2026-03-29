// Progress screen — skill cards and level popups

// Value input popup state
var pendingCheck = null;

// --- Value input popup ---

function showValuePopup(section, dk, exName, unit, el) {
  pendingCheck = { section: section, dk: dk, exName: exName, unit: unit, el: el };
  document.getElementById('popup-unit').textContent = unit;
  document.getElementById('popup-ex-name').textContent = exName;
  document.getElementById('popup-value').value = '';
  document.getElementById('value-popup').style.display = 'flex';
  setTimeout(function() { document.getElementById('popup-value').focus(); }, 100);
}

function savePopupValue() {
  if (!pendingCheck) return;
  var val = parseInt(document.getElementById('popup-value').value) || 0;
  var p = pendingCheck;
  if (!cache[p.section][p.dk]) return;
  cache[p.section][p.dk].checks[p.exName] = true;
  cache[p.section][p.dk].values[p.exName] = val;
  saveDayData(p.section, new Date(p.dk + 'T12:00:00'));
  var skill = findSkillByExercise(p.exName, p.section);
  if (skill) recalcSkill(skill);
  closePopup();
  var open = getOpenCards(p.section);
  renderSection(p.section, open);
}

function cancelPopup() {
  if (pendingCheck && pendingCheck.el) pendingCheck.el.checked = false;
  closePopup();
}

function closePopup() {
  document.getElementById('value-popup').style.display = 'none';
  pendingCheck = null;
}

// --- Universal level helpers ---

function skillValueToScale(skill, total) {
  if (skill.valueType === 'minutes') return total / 60;
  if (skill.valueType === 'seconds') return total / 3600;
  return total;
}

function levelField(skill) {
  return skill.valueType === 'reps' ? 'reps' : 'hours';
}

function getLevelForSkill(skill, total) {
  var levels = skill.levels;
  var field = levelField(skill);
  var scaled = skillValueToScale(skill, total);
  var current = levels[0];
  for (var i = 0; i < levels.length; i++) {
    if (scaled >= levels[i][field]) current = levels[i];
    else break;
  }
  return current;
}

function getNextLevelForSkill(skill, total) {
  var levels = skill.levels;
  var field = levelField(skill);
  var scaled = skillValueToScale(skill, total);
  for (var i = 0; i < levels.length; i++) {
    if (scaled < levels[i][field]) return levels[i];
  }
  return null;
}

function getProgressForSkill(skill, total) {
  var field = levelField(skill);
  var scaled = skillValueToScale(skill, total);
  var current = getLevelForSkill(skill, total);
  var next = getNextLevelForSkill(skill, total);
  if (!next) return 100;
  var range = next[field] - current[field];
  var done = scaled - current[field];
  return Math.round(done / range * 100);
}

// --- Universal render ---

function getElemPrefix(skillId) {
  var map = { pushups: 'pushup', pullups: 'pullup' };
  return map[skillId] || skillId;
}

function getSkillTotal(skill) {
  return skillTotals[skill.id] || 0;
}

function formatSkillValue(skill, total) {
  if (skill.valueType === 'minutes') return (total / 60).toFixed(1) + ' ч';
  if (skill.valueType === 'seconds') return (total / 3600).toFixed(1) + ' ч';
  return total.toLocaleString('ru') + ' повт.';
}

function formatLevelThreshold(skill, lvl) {
  var field = lvl.hours !== undefined ? 'hours' : 'reps';
  if (field === 'hours') return lvl.hours + ' ч';
  return lvl.reps.toLocaleString('ru');
}

function renderSkillCard(skill) {
  var prefix = getElemPrefix(skill.id);
  var el = document.getElementById(prefix + '-level-name');
  if (!el) return;
  var total = getSkillTotal(skill);
  var current = getLevelForSkill(skill, total);
  var next = getNextLevelForSkill(skill, total);
  var pct = getProgressForSkill(skill, total);
  document.getElementById(prefix + '-level-name').textContent = 'Ур. ' + current.level + ' — ' + current.name;
  var valueEl = document.getElementById(prefix + '-hours') || document.getElementById(prefix + '-reps');
  if (valueEl) valueEl.textContent = formatSkillValue(skill, total);
  document.getElementById(prefix + '-progress-bar').style.width = pct + '%';
  document.getElementById(prefix + '-progress-pct').textContent = pct + '%';
  document.getElementById(prefix + '-label-left').textContent = formatLevelThreshold(skill, current);
  document.getElementById(prefix + '-label-right').textContent = next ? formatLevelThreshold(skill, next) : '—';
}

// Universal render router — вызывается из recalcSkill
function renderSkillById(id) {
  var skill = getSkillById(id);
  if (skill) renderSkillCard(skill);
}
