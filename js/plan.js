// Plan rendering and interaction
// TC is now loaded from plans/day-types.json via db.js
var DAY_NAMES = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
var weekOffset = 0;

function renderSection(section, keepOpen) {
  var label = getWeekLabel(weekOffset);
  userSections.forEach(function(s) {
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
      if (isToday) { card.style.outline = '2px solid #1D9E75'; card.style.outlineOffset = '-1px'; }
      card.innerHTML =
        '<div class="day-header" onclick="toggleDay(this)">' +
          '<div class="day-left">' +
            '<span class="day-badge" style="' + getDayTypeBadgeStyle(dayData.type) + '">' + getDayTypeLabel(dayData.type) + '</span>' +
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
                (ex.desc ? '<div class="ex-desc">' + ex.desc + '</div>' : '') +
                (ex.note ? '<div class="ex-note">' + ex.note + '</div>' : '') +
                valueLine +
              '</div>' +
            '</div>';
          }).join('') +
          '</div>' +
          '<div style="border-top:0.5px solid #f0f0f0;text-align:center;padding:6px 0">' +
            '<button onclick="editDay(\'' + section + '\',' + i + ')" ' +
              'style="background:none;border:none;color:#bbb;font-size:12px;cursor:pointer;padding:4px 0">' +
              '✏ редактировать план' +
            '</button>' +
          '</div>' +
        '</div>';
      container.appendChild(card);
    });
    var tp = totalEx > 0 ? Math.round(doneEx / totalEx * 100) : 0;
    calcDailyStreak(section).then(function(streak) {
      document.getElementById(section + '-s-days').textContent = streak;
      document.getElementById(section + '-s-days-lbl').textContent =
        pluralize(streak, ['день', 'дня', 'дней']) + ' подряд';
    });
    document.getElementById(section + '-s-ex').textContent = doneEx;
    document.getElementById(section + '-s-pct').textContent = tp + '%';
    renderWeekStars(section, results, dates);
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
    var oldVal = cache[section][dk].values[exName] || 0;
    cache[section][dk].checks[exName] = false;
    cache[section][dk].values[exName] = 0;
    saveDayData(section, new Date(dk + 'T12:00:00'));
    invalidateStreakCache(section);
    // Инкрементальное обновление навыка: было oldVal, стало 0 → delta = -oldVal
    var skill = findSkillByExercise(exName, section);
    if (skill) adjustSkillTotal(skill, -oldVal);
    var open = getOpenCards(section);
    renderSection(section, open);
  }
}

function toggleCheck(section, dk, exName, el) {
  if (!cache[section][dk]) return;
  cache[section][dk].checks[exName] = el.checked;
  saveDayData(section, new Date(dk + 'T12:00:00'));
  invalidateStreakCache(section);
  var open = getOpenCards(section);
  renderSection(section, open);
}

function changeWeek(d) {
  weekOffset += d;
  userSections.forEach(function(s) { renderSection(s); });
}

function computeWeekStars(results, dates) {
  var todayKey = dateKey(new Date());
  var createdKey = userCreatedAt ? dateKey(new Date(userCreatedAt)) : null;
  var hasGreen = false, hasOrange = false, hasRed = false;
  results.forEach(function(dayData, i) {
    var dk = dateKey(dates[i]);
    if (dk >= todayKey) return;
    if (createdKey && dk < createdKey) return;
    var exs = dayData.plan || [], checks = dayData.checks || {};
    var total = exs.length;
    var done = exs.filter(function(ex) { return checks[ex.name]; }).length;
    if (total === 0) { hasGreen = true; return; }
    if (done === total) hasGreen = true;
    else if (done > 0) hasOrange = true;
    else hasRed = true;
  });
  if (!hasGreen && !hasOrange && !hasRed) return { count: 3, color: '#1D9E75' };
  if (hasGreen && !hasOrange && !hasRed)  return { count: 3, color: '#1D9E75' };
  if (hasGreen && hasOrange && !hasRed)   return { count: 2, color: '#FAC775' };
  if (hasGreen && hasRed)                 return { count: 1, color: '#FAC775' };
  if (!hasGreen && hasOrange && !hasRed)  return { count: 2, color: '#FAC775' };
  if (!hasGreen && hasOrange && hasRed)   return { count: 1, color: '#FAC775' };
  return { count: 1, color: '#E24B4A' };
}

function editDay(section, dayIndex) {
  var open = getOpenCards(section);
  openPlanEditor({
    section:      section,
    dayIndex:     dayIndex,
    sectionLabel: getSectionMeta(section).label,
    onSave:       function() { renderSection(section, open); }
  });
}

function renderWeekStars(section, results, dates) {
  var container = document.getElementById(section + '-week-stars');
  if (!container) return;
  var s = computeWeekStars(results, dates);
  var pts = '8,1 9.8,5.6 14.7,5.8 10.9,8.9 12.1,13.7 8,11 3.9,13.7 5.1,8.9 1.3,5.8 6.2,5.6';
  var html = '';
  for (var i = 0; i < 3; i++) {
    var fill = i < s.count ? s.color : 'none';
    var strokeOpacity = i < s.count ? '1' : '0.25';
    html += '<svg width="20" height="20" viewBox="0 0 16 16" style="display:inline-block;margin:0 3px">' +
      '<polygon points="' + pts + '" fill="' + fill + '" stroke="' + s.color + '" stroke-width="1" stroke-opacity="' + strokeOpacity + '"/>' +
      '</svg>';
  }
  container.innerHTML = html;
}
