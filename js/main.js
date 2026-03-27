// Firebase init
firebase.initializeApp({
  apiKey: 'AIzaSyB0898njk5wWWEZgTYdQcg0Rv_loFIcH2c',
  authDomain: 'spring-tracker.firebaseapp.com',
  projectId: 'spring-tracker',
  storageBucket: 'spring-tracker.firebasestorage.app',
  messagingSenderId: '192640819831',
  appId: '1:192640819831:web:34ecfca0a22434f0271c72'
});
var db = firebase.firestore();
db.enablePersistence().catch(function() {});

// Constants
var TC = { legs: 'b-legs', upper: 'b-upper', rest: 'b-rest', wc: 'b-wc', qi: 'b-qi' };
var DAY_NAMES = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
var SECTIONS = ['strength', 'wingchun', 'qigong'];

var TREE_LEVELS = [
  { level: 0, name: 'Спящее семя',    hours: 0,     desc: 'Пора проснуться' },
  { level: 1, name: 'Семя',           hours: 10,    desc: 'Зерно посажено' },
  { level: 2, name: 'Росток',         hours: 30,    desc: 'Пробился сквозь землю' },
  { level: 3, name: 'Саженец',        hours: 60,    desc: 'Корни уходят вглубь' },
  { level: 4, name: 'Молодое дерево', hours: 100,   desc: 'Ствол окреп, ветви расправились' },
  { level: 5, name: 'Дерево',         hours: 300,   desc: 'Регулярная практика' },
  { level: 6, name: 'Зрелое дерево',  hours: 600,   desc: 'Корни в подземных водах' },
  { level: 7, name: 'Священное дерево', hours: 1000, desc: 'Птицы сами прилетают' },
  { level: 8, name: 'Мировое дерево', hours: 5000,  desc: 'Ветви касаются неба' },
  { level: 9, name: 'Иггдрасиль',     hours: 10000, desc: 'Соединяешь миры' },
];

// State
var weekOffset = 0;
var cache = { strength: {}, wingchun: {}, qigong: {} };
var plans = { strength: null, wingchun: null, qigong: null, tests: null };
var treeTotalMinutes = 0;

// Popup state
var pendingCheck = null; // {section, dk, exName, el}

// --- Date utils ---

function dateKey(date) {
  return date.getFullYear() + '-' +
    String(date.getMonth() + 1).padStart(2, '0') + '-' +
    String(date.getDate()).padStart(2, '0');
}

function getWeekDates(offset) {
  var now = new Date(), mon = new Date(now);
  mon.setDate(now.getDate() - now.getDay() + 1 + offset * 7);
  var dates = [];
  for (var i = 0; i < 7; i++) {
    var d = new Date(mon);
    d.setDate(mon.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function getWeekLabel(offset) {
  var dates = getWeekDates(offset);
  var f = function(d) { return d.getDate() + '.' + String(d.getMonth() + 1).padStart(2, '0'); };
  return f(dates[0]) + ' — ' + f(dates[6]);
}

// --- Plan loading ---

function loadPlanFromFirebase(section) {
  var field = section === 'tests' ? 'items' : 'days';
  return db.collection('plan').doc(section).get().then(function(s) {
    if (s.exists) plans[section] = s.data()[field];
  }).catch(function() {});
}

function getDayPlan(section, date) {
  var plan = plans[section];
  if (!plan) return null;
  var dow = date.getDay();
  var idx = dow === 0 ? 6 : dow - 1;
  return plan[idx] || null;
}

// --- Day data ---

function loadDayData(section, date) {
  var dk = dateKey(date);
  if (cache[section][dk]) return Promise.resolve(cache[section][dk]);
  return db.collection(section).doc(dk).get().then(function(s) {
    var dayPlan = getDayPlan(section, date);
    var todayDk = dateKey(new Date());
    var isToday = dk >= todayDk;
    if (s.exists) {
      var data = s.data();
      cache[section][dk] = {
        plan: isToday ? (dayPlan ? dayPlan.exercises : (data.plan || [])) : (data.plan || (dayPlan ? dayPlan.exercises : [])),
        type: data.type || (dayPlan ? dayPlan.type : 'rest'),
        label: data.label || (dayPlan ? dayPlan.label : ''),
        checks: data.checks || {},
        values: data.values || {}
      };
    } else {
      cache[section][dk] = {
        plan: dayPlan ? dayPlan.exercises : [],
        type: dayPlan ? dayPlan.type : 'rest',
        label: dayPlan ? dayPlan.label : '',
        checks: {},
        values: {}
      };
    }
    return cache[section][dk];
  }).catch(function() {
    var dayPlan = getDayPlan(section, date);
    cache[section][dk] = {
      plan: dayPlan ? dayPlan.exercises : [],
      type: dayPlan ? dayPlan.type : 'rest',
      label: dayPlan ? dayPlan.label : '',
      checks: {},
      values: {}
    };
    return cache[section][dk];
  });
}

function saveDayData(section, date) {
  var dk = dateKey(date), data = cache[section][dk];
  if (!data) return;
  db.collection(section).doc(dk).set({
    plan: data.plan,
    type: data.type,
    label: data.label,
    checks: data.checks,
    values: data.values
  }).catch(function() {});
}

// --- Tree minutes ---

function loadTreeMinutes() {
  return db.collection('tracker').doc('tree').get().then(function(s) {
    treeTotalMinutes = s.exists ? (s.data().totalMinutes || 0) : 0;
  }).catch(function() { treeTotalMinutes = 0; });
}

function recalcTreeMinutes() {
  db.collection('qigong').get().then(function(snap) {
    var total = 0;
    snap.forEach(function(doc) {
      var values = doc.data().values || {};
      if (values['Дерево']) total += values['Дерево'];
    });
    treeTotalMinutes = total;
    db.collection('tracker').doc('tree').set({ totalMinutes: total }).catch(function() {});
    renderTreeProgress();
  }).catch(function() {});
}

// --- Tree level ---

function getTreeLevel(totalMinutes) {
  var hours = totalMinutes / 60;
  var current = TREE_LEVELS[0];
  for (var i = 0; i < TREE_LEVELS.length; i++) {
    if (hours >= TREE_LEVELS[i].hours) current = TREE_LEVELS[i];
    else break;
  }
  return current;
}

function getNextLevel(totalMinutes) {
  var hours = totalMinutes / 60;
  for (var i = 0; i < TREE_LEVELS.length; i++) {
    if (hours < TREE_LEVELS[i].hours) return TREE_LEVELS[i];
  }
  return null;
}

function getTreeProgress(totalMinutes) {
  var hours = totalMinutes / 60;
  var current = getTreeLevel(totalMinutes);
  var next = getNextLevel(totalMinutes);
  if (!next) return 100;
  var range = next.hours - current.hours;
  var done = hours - current.hours;
  return Math.round(done / range * 100);
}

// --- Value popup ---

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
  closePopup();
  var open = getOpenCards(p.section);
  renderSection(p.section, open);
}

function cancelPopup() {
  if (pendingCheck && pendingCheck.el) {
    pendingCheck.el.checked = false;
  }
  closePopup();
}

function closePopup() {
  document.getElementById('value-popup').style.display = 'none';
  pendingCheck = null;
}

// --- Render plan ---

function renderSection(section, keepOpen) {
  var label = getWeekLabel(weekOffset);
  SECTIONS.forEach(function(s) {
    document.getElementById(s + '-week-label').textContent = 'Неделя ' + label;
  });
  var dates = getWeekDates(weekOffset);
  var container = document.getElementById(section + '-days');
  container.innerHTML = '<div class="loading">Загрузка...</div>';

  Promise.all(dates.map(function(d) { return loadDayData(section, d); })).then(function(results) {
    var doneDays = 0, doneEx = 0, totalEx = 0;
    results.forEach(function(r) { if (r.type !== 'rest') totalEx += r.plan.length; });
    container.innerHTML = '';
    results.forEach(function(dayData, i) {
      var date = dates[i], dk = dateKey(date);
      var checks = dayData.checks || {}, values = dayData.values || {}, exs = dayData.plan || [];
      var done = exs.filter(function(ex) { return checks[ex.name]; }).length;
      var total = exs.length;
      if (done === total && total > 0 && dayData.type !== 'rest') doneDays++;
      if (dayData.type !== 'rest') doneEx += done;
      var pct = total > 0 ? Math.round(done / total * 100) : 0;
      var isComplete = done === total && total > 0 && dayData.type !== 'rest';
      var isPartial = done > 0 && done < total && dayData.type !== 'rest';
      var markBg = isComplete ? '#1D9E75' : isPartial ? '#FAC775' : 'transparent';
      var markInner = (isComplete || isPartial)
        ? '<svg viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        : '';
      var card = document.createElement('div');
      card.className = 'day-card';
      card.innerHTML =
        '<div class="day-header" onclick="toggleDay(this)">' +
          '<div class="day-left">' +
            '<span class="day-badge ' + TC[dayData.type] + '">' + dayData.label + '</span>' +
            '<span class="day-name">' + DAY_NAMES[date.getDay()] + '</span>' +
          '</div>' +
          '<div class="day-right">' +
            '<div class="done-mark" style="background:' + markBg + '">' + markInner + '</div>' +
            '<span class="day-count">' + done + '/' + total + '</span>' +
            '<svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>' +
          '</div>' +
        '</div>' +
        '<div class="day-body">' +
          '<div class="progress-bar-wrap"><div class="progress-bar" style="width:' + pct + '%"></div></div>' +
          '<div class="ex-list">' + exs.map(function(ex) {
            var hasValue = ex.trackValue && checks[ex.name] && values[ex.name] > 0;
            var valueLine = hasValue
              ? '<div class="ex-value">' + values[ex.name] + ' ' + (ex.unit || '') + '</div>'
              : '';
            var safeExName = ex.name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            var onchange = ex.trackValue
              ? 'onchange="handleExCheck(\'' + section + '\',\'' + dk + '\',\'' + safeExName + '\',\'' + (ex.unit||'') + '\',this)"'
              : 'onchange="toggleCheck(\'' + section + '\',\'' + dk + '\',\'' + safeExName + '\',this)"';
            return '<div class="ex-item">' +
              '<input type="checkbox" class="ex-check" ' + (checks[ex.name] ? 'checked' : '') + ' ' + onchange + '>' +
              '<div class="ex-info">' +
                '<div class="ex-name">' + ex.name + '</div>' +
                '<div class="ex-desc">' + ex.desc + '</div>' +
                (ex.note ? '<div class="ex-note">' + ex.note + '</div>' : '') +
                valueLine +
              '</div>' +
            '</div>';
          }).join('') + '</div>' +
        '</div>';
      container.appendChild(card);
    });
    var tp = totalEx > 0 ? Math.round(doneEx / totalEx * 100) : 0;
    document.getElementById(section + '-s-days').textContent = doneDays;
    document.getElementById(section + '-s-ex').textContent = doneEx;
    document.getElementById(section + '-s-pct').textContent = tp + '%';
    if (keepOpen) {
      var cards = document.querySelectorAll('#' + section + '-days .day-card');
      keepOpen.forEach(function(i) { if (cards[i]) cards[i].classList.add('open'); });
    }
  });
}

function getOpenCards(section) {
  var open = [];
  document.querySelectorAll('#' + section + '-days .day-card').forEach(function(c, i) {
    if (c.classList.contains('open')) open.push(i);
  });
  return open;
}

function toggleDay(el) { el.closest('.day-card').classList.toggle('open'); }

function handleExCheck(section, dk, exName, unit, el) {
  if (el.checked) {
    showValuePopup(section, dk, exName, unit, el);
  } else {
    if (!cache[section][dk]) return;
    cache[section][dk].checks[exName] = false;
    cache[section][dk].values[exName] = 0;
    saveDayData(section, new Date(dk + 'T12:00:00'));
    if (exName === 'Дерево') recalcTreeMinutes();
    var open = getOpenCards(section);
    renderSection(section, open);
  }
}

function toggleCheck(section, dk, exName, el) {
  if (!cache[section][dk]) return;
  cache[section][dk].checks[exName] = el.checked;
  saveDayData(section, new Date(dk + 'T12:00:00'));
  var open = getOpenCards(section);
  renderSection(section, open);
}

function changeWeek(d) {
  weekOffset += d;
  SECTIONS.forEach(function(s) { renderSection(s); });
}

// --- Tests ---

function renderTestForm() {
  var items = plans.tests || [];
  var grid = document.getElementById('test-grid');
  if (!items.length) { grid.innerHTML = '<div class="loading">Загрузка теста...</div>'; return; }
  grid.innerHTML = items.map(function(item, i) {
    return '<div class="test-item">' +
      '<div class="test-label">' + item.name + '</div>' +
      '<input class="test-input" type="number" id="ti_' + i + '" placeholder="—">' +
      '<div class="test-unit">' + item.unit + '</div>' +
    '</div>';
  }).join('');
}

function saveTest() {
  var items = plans.tests || [];
  var now = new Date(), dk = dateKey(now);
  var data = { date: now.toLocaleDateString('ru'), plan: items };
  var hasVal = false;
  items.forEach(function(item, i) {
    var v = document.getElementById('ti_' + i);
    if (v && v.value !== '') { data[item.name] = parseInt(v.value); hasVal = true; }
  });
  if (!hasVal) return;
  db.collection('tests').doc(dk).set(data).catch(function() {});
  document.getElementById('saved-msg').style.display = 'block';
  setTimeout(function() { document.getElementById('saved-msg').style.display = 'none'; }, 2000);
  items.forEach(function(_, i) { var v = document.getElementById('ti_' + i); if (v) v.value = ''; });
  loadAndRenderHistory();
}

// --- History ---

function loadAndRenderHistory() {
  var c = document.getElementById('history-container');
  c.innerHTML = '<div class="loading">Загрузка...</div>';
  db.collection('tests').get().then(function(snap) {
    var entries = [];
    snap.forEach(function(doc) { entries.push({ dk: doc.id, data: doc.data() }); });
    entries.sort(function(a, b) { return a.dk < b.dk ? -1 : 1; });
    var items = plans.tests || [];
    if (!entries.length) {
      c.innerHTML = '<div class="empty">Пока нет ни одного теста.<br>Пройди первый тест в воскресенье.</div>';
      return;
    }
    var html = '<div class="history-wrap"><table class="history-table"><thead><tr><th>Дата</th>';
    items.forEach(function(item) { html += '<th>' + item.name.split(' ').pop() + '</th>'; });
    html += '</tr></thead><tbody>';
    entries.forEach(function(e, i) {
      html += '<tr><td>' + (e.data.date || e.dk) + '</td>';
      items.forEach(function(item) {
        var v = e.data[item.name], delta = '';
        if (i > 0) {
          var prev = entries[i - 1].data[item.name];
          if (v != null && prev != null) {
            var diff = v - prev;
            if (diff > 0) delta = '<span class="delta up">+' + diff + '</span>';
            else if (diff < 0) delta = '<span class="delta down">' + diff + '</span>';
          }
        }
        html += '<td>' + (v != null ? v : '—') + delta + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    c.innerHTML = html;
  }).catch(function() { c.innerHTML = '<div class="empty">Ошибка загрузки.</div>'; });
}

// --- Tree progress ---

function renderTreeProgress() {
  var current = getTreeLevel(treeTotalMinutes);
  var next = getNextLevel(treeTotalMinutes);
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

// --- Navigation ---

function showTab(name, btn) {
  document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
  document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
  document.getElementById('settings-btn').style.color = '';
  document.getElementById(name).classList.add('active');
  if (btn.classList.contains('tab-btn')) btn.classList.add('active');
  else btn.style.color = 'var(--green)';
  document.getElementById('sub-tabs').style.visibility = name === 'plan' ? 'visible' : 'hidden';
  if (name === 'progress') { loadAndRenderHistory(); renderTreeProgress(); }
}

function showSubTab(name, btn) {
  document.querySelectorAll('.sub-screen').forEach(function(s) { s.classList.remove('active'); });
  document.querySelectorAll('.sub-tab').forEach(function(b) { b.classList.remove('active'); });
  document.getElementById(name).classList.add('active');
  btn.classList.add('active');
}

// --- Init ---

function init() {
  Promise.all([
    loadPlanFromFirebase('strength'),
    loadPlanFromFirebase('wingchun'),
    loadPlanFromFirebase('qigong'),
    loadPlanFromFirebase('tests'),
    loadTreeMinutes(),
  ]).then(function() {
    SECTIONS.forEach(function(s) { renderSection(s); });
    renderTestForm();
    renderTreeProgress();
  });
}

init();
