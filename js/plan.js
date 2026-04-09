// Plan rendering and interaction
// TC is now loaded from plans/day-types.json via db.js
var DAY_NAMES = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
var SECTIONS = ['strength', 'wingchun', 'qigong'];
var weekOffset = 0;

function renderSection(section, keepOpen) {
  var label = getWeekLabel(weekOffset);
  SECTIONS.forEach(function(s) {
    document.getElementById(s + '-week-label').textContent = 'Неделя ' + label;
  });
  var dates = getWeekDates(weekOffset);
  var container = document.getElementById(section + '-days');
  container.innerHTML = '<div class="loading">Загрузка...</div>';
  Promise.all(dates.map(function(d) {
    return loadDayData(section, d);
  })).then(function(results) {
    var doneDays = 0, doneEx = 0, totalEx = 0;
    results.forEach(function(r) {
      totalEx += r.plan.length;
    });
    var todayKey = dateKey(new Date());
    container.innerHTML = '';
    results.forEach(function(dayData, i) {
      var date = dates[i], dk = dateKey(date);
      var isToday = dk === todayKey;
      var checks = dayData.checks || {}, values = dayData.values || {}, exs = dayData.plan || [];
      var done = exs.filter(function(ex) { return checks[ex.name]; }).length;
      var total = exs.length;
      if (done === total && total > 0) doneDays++;
      doneEx += done;
      var pct = total > 0 ? Math.round(done / total * 100) : 0;
      var isComplete = done === total && total > 0;
      var isPartial = done > 0 && done < total;
      var markBg = isComplete ? '#1D9E75' : isPartial ? '#FAC775' : 'transparent';
      var markInner = (isComplete || isPartial) ? '<svg viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '';
      var card = document.createElement('div');
      card.className = 'day-card';
      card.style.border = '2px solid ' + (isToday ? '#1D9E75' : 'transparent');
      card.innerHTML =
        '<div class="day-header" onclick="toggleDay(this)">' +
          '<div class="day-left">' +
            '<span class="day-badge ' + getDayTypeCSS(dayData.type) + '">' + getDayTypeLabel(dayData.type) + '</span>' +
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
          '<div class="ex-list">' +
          exs.map(function(ex) {
            var hasValue = ex.trackValue && checks[ex.name] && values[ex.name] > 0;
            var valueLine = hasValue ? '<div class="ex-value">' + values[ex.name] + ' ' + (ex.unit || '') + '</div>' : '';
            var safeExName = ex.name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            var onchange = ex.trackValue
              ? 'onchange="handleExCheck(\'' + section + '\',\'' + dk + '\',\'' + safeExName + '\',\'' + (ex.unit || '') + '\',this)"'
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
          }).join('') +
          '</div>' +
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

function toggleDay(el) {
  el.closest('.day-card').classList.toggle('open');
}

function handleExCheck(section, dk, exName, unit, el) {
  if (el.checked) {
    showValuePopup(section, dk, exName, unit, el);
  } else {
    if (!cache[section][dk]) return;
    cache[section][dk].checks[exName] = false;
    cache[section][dk].values[exName] = 0;
    saveDayData(section, new Date(dk + 'T12:00:00'));
    var skill = findSkillByExercise(exName, section);
    if (skill) recalcSkill(skill);
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
