// Tree, Mountain stance progress and level popups

var treeTotalMinutes = 0;
var mountainTotalSeconds = 0;
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
  if (p.exName === 'Дерево') recalcTreeMinutes();
  if (STANCE_EXERCISES.indexOf(p.exName) !== -1) recalcMountainSeconds();
  if (p.exName === 'Отжимания') recalcPushupReps();
  if (p.exName === 'Подтягивания') recalcPullupReps();
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

// --- Tree progress ---

function renderTreeProgress() {
  if (!document.getElementById('tree-level-name')) return;
  var current = getTreeLevel(treeTotalMinutes);
  var next = getTreeNextLevel(treeTotalMinutes);
  var pct = getTreeProgress(treeTotalMinutes);
  var hours = (treeTotalMinutes / 60).toFixed(1);
  document.getElementById('tree-level-name').textContent = 'Ур. ' + current.level + ' — ' + current.name;
  document.getElementById('tree-hours').textContent = hours + ' ч';
  document.getElementById('tree-progress-bar').style.width = pct + '%';
  document.getElementById('tree-progress-pct').textContent = pct + '%';
  document.getElementById('tree-label-left').textContent = current.hours + ' ч';
  document.getElementById('tree-label-right').textContent = next ? next.hours + ' ч' : '—';
}

function showTreeLevels() {
  var html = TREE_LEVELS.map(function(lvl) {
    var current = getTreeLevel(treeTotalMinutes);
    var isCur = lvl.level === current.level;
    var isPast = lvl.level < current.level;
    var opacity = lvl.level > current.level + 1 ? '0.45' : '1';
    return '<div class="level-row" style="opacity:' + opacity + '">' +
      '<div class="level-num' + (isCur ? ' cur' : '') + '">' + lvl.level + '</div>' +
      '<div class="level-info">' +
        '<div class="level-name">' + (isPast ? '<s>' : '') + lvl.name + (isPast ? '</s>' : '') + '</div>' +
        '<div class="level-desc">' + lvl.desc + '</div>' +
      '</div>' +
      '<div class="level-hours">' + lvl.hours + ' ч</div>' +
    '</div>';
  }).join('');
  document.getElementById('levels-list').innerHTML = html;
  document.getElementById('levels-popup').style.display = 'flex';
}

function closeLevelsPopup() {
  document.getElementById('levels-popup').style.display = 'none';
}

// --- Mountain progress ---

function renderMountainProgress() {
  if (!document.getElementById('mountain-level-name')) return;
  var current = getMountainLevel(mountainTotalSeconds);
  var next = getMountainNextLevel(mountainTotalSeconds);
  var pct = getMountainProgress(mountainTotalSeconds);
  var hours = (mountainTotalSeconds / 3600).toFixed(1);
  document.getElementById('mountain-level-name').textContent = 'Ур. ' + current.level + ' — ' + current.name;
  document.getElementById('mountain-hours').textContent = hours + ' ч';
  document.getElementById('mountain-progress-bar').style.width = pct + '%';
  document.getElementById('mountain-progress-pct').textContent = pct + '%';
  document.getElementById('mountain-label-left').textContent = current.hours + ' ч';
  document.getElementById('mountain-label-right').textContent = next ? next.hours + ' ч' : '—';
}

function showMountainLevels() {
  var html = MOUNTAIN_LEVELS.map(function(lvl) {
    var current = getMountainLevel(mountainTotalSeconds);
    var isCur = lvl.level === current.level;
    var isPast = lvl.level < current.level;
    var opacity = lvl.level > current.level + 1 ? '0.45' : '1';
    return '<div class="level-row" style="opacity:' + opacity + '">' +
      '<div class="level-num' + (isCur ? ' cur' : '') + '">' + lvl.level + '</div>' +
      '<div class="level-info">' +
        '<div class="level-name">' + (isPast ? '<s>' : '') + lvl.name + (isPast ? '</s>' : '') + '</div>' +
        '<div class="level-desc">' + lvl.desc + '</div>' +
      '</div>' +
      '<div class="level-hours">' + lvl.hours + ' ч</div>' +
    '</div>';
  }).join('');
  document.getElementById('mountain-levels-list').innerHTML = html;
  document.getElementById('mountain-levels-popup').style.display = 'flex';
}

function closeMountainLevelsPopup() {
  document.getElementById('mountain-levels-popup').style.display = 'none';
}

// --- Pushup / Pullup progress ---

var pushupTotalReps = 0;
var pullupTotalReps = 0;

function renderPushupProgress() {
  if (!document.getElementById('pushup-level-name')) return;
  var current = getPushupLevel(pushupTotalReps);
  var next = getPushupNextLevel(pushupTotalReps);
  var pct = getPushupProgress(pushupTotalReps);
  document.getElementById('pushup-level-name').textContent = 'Ур. ' + current.level + ' — ' + current.name;
  document.getElementById('pushup-reps').textContent = pushupTotalReps.toLocaleString('ru') + ' повт.';
  document.getElementById('pushup-progress-bar').style.width = pct + '%';
  document.getElementById('pushup-progress-pct').textContent = pct + '%';
  document.getElementById('pushup-label-left').textContent = current.reps.toLocaleString('ru');
  document.getElementById('pushup-label-right').textContent = next ? next.reps.toLocaleString('ru') : '—';
}

function showPushupLevels() {
  var html = PUSHUP_LEVELS.map(function(lvl) {
    var current = getPushupLevel(pushupTotalReps);
    var isCur = lvl.level === current.level;
    var isPast = lvl.level < current.level;
    var opacity = lvl.level > current.level + 1 ? '0.45' : '1';
    return '<div class="level-row" style="opacity:' + opacity + '">' +
      '<div class="level-num' + (isCur ? ' cur' : '') + '">' + lvl.level + '</div>' +
      '<div class="level-info">' +
        '<div class="level-name">' + (isPast ? '<s>' : '') + lvl.name + (isPast ? '</s>' : '') + '</div>' +
        '<div class="level-desc">' + lvl.desc + '</div>' +
      '</div>' +
      '<div class="level-hours">' + lvl.reps.toLocaleString('ru') + '</div>' +
    '</div>';
  }).join('');
  document.getElementById('pushup-levels-list').innerHTML = html;
  document.getElementById('pushup-levels-popup').style.display = 'flex';
}

function closePushupLevelsPopup() {
  document.getElementById('pushup-levels-popup').style.display = 'none';
}

function renderPullupProgress() {
  if (!document.getElementById('pullup-level-name')) return;
  var current = getPullupLevel(pullupTotalReps);
  var next = getPullupNextLevel(pullupTotalReps);
  var pct = getPullupProgress(pullupTotalReps);
  document.getElementById('pullup-level-name').textContent = 'Ур. ' + current.level + ' — ' + current.name;
  document.getElementById('pullup-reps').textContent = pullupTotalReps.toLocaleString('ru') + ' повт.';
  document.getElementById('pullup-progress-bar').style.width = pct + '%';
  document.getElementById('pullup-progress-pct').textContent = pct + '%';
  document.getElementById('pullup-label-left').textContent = current.reps.toLocaleString('ru');
  document.getElementById('pullup-label-right').textContent = next ? next.reps.toLocaleString('ru') : '—';
}

function showPullupLevels() {
  var html = PULLUP_LEVELS.map(function(lvl) {
    var current = getPullupLevel(pullupTotalReps);
    var isCur = lvl.level === current.level;
    var isPast = lvl.level < current.level;
    var opacity = lvl.level > current.level + 1 ? '0.45' : '1';
    return '<div class="level-row" style="opacity:' + opacity + '">' +
      '<div class="level-num' + (isCur ? ' cur' : '') + '">' + lvl.level + '</div>' +
      '<div class="level-info">' +
        '<div class="level-name">' + (isPast ? '<s>' : '') + lvl.name + (isPast ? '</s>' : '') + '</div>' +
        '<div class="level-desc">' + lvl.desc + '</div>' +
      '</div>' +
      '<div class="level-hours">' + lvl.reps.toLocaleString('ru') + '</div>' +
    '</div>';
  }).join('');
  document.getElementById('pullup-levels-list').innerHTML = html;
  document.getElementById('pullup-levels-popup').style.display = 'flex';
}

function closePullupLevelsPopup() {
  document.getElementById('pullup-levels-popup').style.display = 'none';
}

// --- Сиу Лим Тау / Чам Кью progress ---

var sltTotalReps = 0;
var ckTotalReps = 0;

function renderSltProgress() {
  if (!document.getElementById('slt-level-name')) return;
  var current = getFormsLevel(sltTotalReps);
  var next = getFormsNextLevel(sltTotalReps);
  var pct = getFormsProgress(sltTotalReps);
  document.getElementById('slt-level-name').textContent = 'Ур. ' + current.level + ' — ' + current.name;
  document.getElementById('slt-reps').textContent = sltTotalReps.toLocaleString('ru') + ' повт.';
  document.getElementById('slt-progress-bar').style.width = pct + '%';
  document.getElementById('slt-progress-pct').textContent = pct + '%';
  document.getElementById('slt-label-left').textContent = current.reps.toLocaleString('ru');
  document.getElementById('slt-label-right').textContent = next ? next.reps.toLocaleString('ru') : '—';
}

function showSltLevels() {
  renderFormsLevelsPopup('slt-levels-list', sltTotalReps);
  document.getElementById('slt-levels-popup').style.display = 'flex';
}

function closeSltLevelsPopup() {
  document.getElementById('slt-levels-popup').style.display = 'none';
}

function renderCkProgress() {
  if (!document.getElementById('ck-level-name')) return;
  var current = getFormsLevel(ckTotalReps);
  var next = getFormsNextLevel(ckTotalReps);
  var pct = getFormsProgress(ckTotalReps);
  document.getElementById('ck-level-name').textContent = 'Ур. ' + current.level + ' — ' + current.name;
  document.getElementById('ck-reps').textContent = ckTotalReps.toLocaleString('ru') + ' повт.';
  document.getElementById('ck-progress-bar').style.width = pct + '%';
  document.getElementById('ck-progress-pct').textContent = pct + '%';
  document.getElementById('ck-label-left').textContent = current.reps.toLocaleString('ru');
  document.getElementById('ck-label-right').textContent = next ? next.reps.toLocaleString('ru') : '—';
}

function showCkLevels() {
  renderFormsLevelsPopup('ck-levels-list', ckTotalReps);
  document.getElementById('ck-levels-popup').style.display = 'flex';
}

function closeCkLevelsPopup() {
  document.getElementById('ck-levels-popup').style.display = 'none';
}

function renderFormsLevelsPopup(listId, totalReps) {
  var html = FORMS_LEVELS.map(function(lvl) {
    var current = getFormsLevel(totalReps);
    var isCur = lvl.level === current.level;
    var isPast = lvl.level < current.level;
    var opacity = lvl.level > current.level + 1 ? '0.45' : '1';
    return '<div class="level-row" style="opacity:' + opacity + '">' +
      '<div class="level-num' + (isCur ? ' cur' : '') + '">' + lvl.level + '</div>' +
      '<div class="level-info">' +
        '<div class="level-name">' + (isPast ? '<s>' : '') + lvl.name + (isPast ? '</s>' : '') + '</div>' +
        '<div class="level-desc">' + lvl.desc + '</div>' +
      '</div>' +
      '<div class="level-hours">' + lvl.reps.toLocaleString('ru') + '</div>' +
    '</div>';
  }).join('');
  document.getElementById(listId).innerHTML = html;
}

// Universal render router — вызывается из recalcSkill
function renderSkillById(id) {
  if (id === 'tree')     renderTreeProgress();
  if (id === 'mountain') renderMountainProgress();
  if (id === 'pushups')  renderPushupProgress();
  if (id === 'pullups')  renderPullupProgress();
  if (id === 'slt')      renderSltProgress();
  if (id === 'ck')       renderCkProgress();
}
