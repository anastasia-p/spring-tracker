// Trophies — вкладка "Трофеи" внутри прогресса.
// Сейчас содержит один блок: "Путь навыков" — карточки навыков, разложенные по
// уровням 9 → 1, отдельная секция Уровень 0 для активных дисциплин с не начатыми
// навыками. В будущем здесь могут появиться другие блоки (стрики, объёмы и т.д.).

// CSS для вкладки и попапа. Инжектится один раз при загрузке скрипта.
// Вся стилевая часть фичи живёт здесь, рядом с рендером — чтобы менять трофеи
// можно было в одном файле, не лазая в app.html.
(function injectTrophiesStyles() {
  if (typeof document === 'undefined') return; // node тесты
  if (document.getElementById('trophies-styles')) return;
  var css = ''
    + '.tr-counter{font-size:13px;color:var(--text-muted);margin-bottom:14px}'
    + '.tr-block-title{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text-muted);margin-bottom:12px}'
    + '.tr-empty{font-size:14px;color:var(--text-muted);text-align:center;padding:18px 8px;line-height:1.5}'
    + '.tr-level-section{margin-bottom:18px}'
    + '.tr-level-section-zero{margin-top:24px;padding-top:18px;border-top:1px solid var(--border)}'
    + '.tr-level-section-zero .tr-cards{grid-template-columns:repeat(4,1fr);gap:6px}'
    + '.tr-level-head{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:10px}'
    + '.tr-level-title{font-size:15px;font-weight:500;color:var(--text)}'
    + '.tr-level-title-zero{color:var(--text-muted)}'
    + '.tr-level-tier{font-size:11px;font-weight:500}'
    + '.tr-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}'
    + '.tr-card{background:var(--card);border-radius:10px;padding:10px 8px;display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;text-align:center;transition:transform .12s}'
    + '.tr-card:active{transform:scale(0.97)}'
    + '.tr-card-icon{--icon-size:48px}'
    + '.tr-card-icon-zero{--icon-size:36px}'
    + '.tr-card-name{font-size:11px;font-weight:500;line-height:1.2;word-break:break-word}'
    + '.tr-card-date{font-size:11px}'
    + '.tr-card-zero{background:var(--bg);padding:8px 6px;color:var(--text-hint)}'
    + '.tr-card-zero .tr-card-name{color:var(--text-hint);font-size:10px}'
    + '.tr-card-zero .tr-card-icon{filter:grayscale(1) opacity(0.55)}'
    + '.tr-card-muted{background:var(--bg);color:var(--text-hint)}'
    + '.tr-card-muted .tr-card-icon{filter:grayscale(1) opacity(0.55)}'
    + '.tr-card-muted .tr-card-name,.tr-card-muted .tr-card-date{color:var(--text-hint)}'
    + '.trophy-popup-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:300;display:flex;align-items:flex-end;justify-content:center;padding:0;padding-bottom:env(safe-area-inset-bottom)}'
    + '.trophy-popup-sheet{width:100%;max-width:640px;border-radius:24px 24px 0 0;padding:12px 24px 32px;text-align:center;max-height:90vh;overflow-y:auto;-webkit-overflow-scrolling:touch;box-sizing:border-box}'
    + '.trophy-drag-handle{width:36px;height:4px;border-radius:999px;margin:0 auto 18px;opacity:0.35}'
    + '.trophy-icon{margin:0 auto 16px}'
    + '.trophy-name{font-size:22px;font-weight:500;margin-bottom:2px}'
    + '.trophy-discipline{font-size:12px;margin-bottom:14px}'
    + '.trophy-badge{display:inline-block;padding:5px 14px;border-radius:999px;font-size:12px;font-weight:500;margin-bottom:18px}'
    + '.trophy-level-name{font-size:18px;font-weight:500;margin-bottom:6px}'
    + '.trophy-level-desc{font-size:14px;line-height:1.5;margin-bottom:22px}'
    + '.trophy-current-date{margin-bottom:20px;padding-bottom:20px;border-bottom:0.5px solid}'
    + '.trophy-date-label{font-size:11px;margin-bottom:4px}'
    + '.trophy-date-value{font-size:16px;font-weight:500}'
    + '.trophy-history{text-align:left}'
    + '.trophy-history-title{font-size:13px;font-weight:500;margin-bottom:10px}'
    + '.trophy-history-row{display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px}';
  var style = document.createElement('style');
  style.id = 'trophies-styles';
  style.textContent = css;
  document.head.appendChild(style);
})();

// Порядок дисциплин внутри секций уровней.
// Применяется к Уровню 0 и ко всем остальным секциям одинаково.
var TROPHY_DISCIPLINE_ORDER = ['strength', 'cardio', 'wingchun', 'qigong'];

// Тиры по уровням — палитра подложек, акцентов и текста.
// Возвращает null для уровня 0 (он рисуется отдельной мини-секцией без тира).
//
// Цвета взяты из CSS-переменных приложения (var(--amber-light) и т.д.) и
// дублирующих токенов Anthropic-палитры. Менять имеет смысл только все вместе:
// бронза должна оставаться теплее серебра, золото — насыщеннее бронзы,
// иначе теряется визуальная градация тиров.
function trophyTier(level) {
  if (level >= 7) return {
    id: 'gold',   label: 'Золото',
    cardBg: '#FAC775', textPrimary: '#412402', textSecondary: '#854F0B',
    accentBg: '#633806', accentText: '#FAEEDA',
  };
  if (level >= 4) return {
    id: 'silver', label: 'Серебро',
    cardBg: '#C8D4DE', textPrimary: '#2C2C2A', textSecondary: '#444441',
    accentBg: '#2C2C2A', accentText: '#F1EFE8',
  };
  if (level >= 1) return {
    id: 'bronze', label: 'Бронза',
    cardBg: '#FAEEDA', textPrimary: '#633806', textSecondary: '#854F0B',
    accentBg: '#854F0B', accentText: '#FAEEDA',
  };
  return null;
}

function trophySkillLevel(skill) {
  var total = (typeof skillTotals !== 'undefined' && skillTotals[skill.id]) || 0;
  return getSkillLevel(skill, total).level;
}

// Сортировка навыков: сначала по дисциплине из TROPHY_DISCIPLINE_ORDER,
// внутри дисциплины — в порядке объявления в SKILLS (pure.js).
function trophySortSkills(a, b) {
  var ai = TROPHY_DISCIPLINE_ORDER.indexOf(a.section);
  var bi = TROPHY_DISCIPLINE_ORDER.indexOf(b.section);
  if (ai === -1) ai = TROPHY_DISCIPLINE_ORDER.length;
  if (bi === -1) bi = TROPHY_DISCIPLINE_ORDER.length;
  if (ai !== bi) return ai - bi;
  return SKILLS.indexOf(a) - SKILLS.indexOf(b);
}

// Форматы дат: "5 апр 2025" для карточек и "5 апреля 2025" для попапа.
var TROPHY_MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
var TROPHY_MONTHS_LONG  = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

function trophyDateShort(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.getDate() + ' ' + TROPHY_MONTHS_SHORT[d.getMonth()] + ' ' + d.getFullYear();
}

function trophyDateLong(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.getDate() + ' ' + TROPHY_MONTHS_LONG[d.getMonth()] + ' ' + d.getFullYear();
}

// ─── Рендер вкладки ─────────────────────────────────────────────────────────

function renderTrophiesTab(container) {
  var sections = (typeof userSections !== 'undefined' && userSections) ? userSections : [];

  // Какие навыки показываем:
  // — активная дисциплина: всегда (включая уровень 0)
  // — отключённая дисциплина: только если уровень > 0 (серая карточка в нужной секции)
  var visibleSkills = SKILLS.filter(function(skill) {
    if (sections.indexOf(skill.section) !== -1) return true;
    return trophySkillLevel(skill) > 0;
  });

  // Группируем по уровню
  var byLevel = {};
  for (var i = 0; i <= 9; i++) byLevel[i] = [];
  visibleSkills.forEach(function(skill) {
    byLevel[trophySkillLevel(skill)].push(skill);
  });
  for (var k in byLevel) byLevel[k].sort(trophySortSkills);

  // Счётчик. X — открыто (уровень >= 1), Y — все возможные карточки на экране.
  var totalY = visibleSkills.length;
  var totalX = visibleSkills.filter(function(s) { return trophySkillLevel(s) > 0; }).length;
  var hasAnyAchievement = totalX > 0;

  var html = '';
  html += '<div class="tr-block-title">Путь навыков</div>';
  html += '<div class="tr-counter">Открыто ' + totalX + ' из ' + totalY + '</div>';
  if (!hasAnyAchievement) {
    html += '<div class="tr-empty">Начните тренировки, чтобы открыть трофеи</div>';
  }

  // Уровни 9 → 1, пустые секции пропускаем.
  for (var lvl = 9; lvl >= 1; lvl--) {
    if (byLevel[lvl].length === 0) continue;
    html += renderTrophyLevelSection(lvl, byLevel[lvl], sections);
  }

  // Уровень 0 — мини-карточки внизу (только активные дисциплины попадают сюда).
  if (byLevel[0].length > 0) {
    html += renderTrophyLevelZeroSection(byLevel[0]);
  }

  container.innerHTML = html;
}

function renderTrophyLevelSection(level, skills, activeSections) {
  var tier = trophyTier(level);
  var head = '<div class="tr-level-head">'
    + '<div class="tr-level-title">Уровень ' + level + '</div>'
    + '<div class="tr-level-tier" style="color:' + tier.textSecondary + '">' + tier.label + '</div>'
    + '</div>';
  var cards = skills.map(function(skill) {
    var isMuted = activeSections.indexOf(skill.section) === -1;
    return buildTrophyCard(skill, level, tier, isMuted);
  }).join('');
  return '<div class="tr-level-section">' + head + '<div class="tr-cards">' + cards + '</div></div>';
}

function renderTrophyLevelZeroSection(skills) {
  var head = '<div class="tr-level-head">'
    + '<div class="tr-level-title tr-level-title-zero">Уровень 0</div>'
    + '</div>';
  var cards = skills.map(buildTrophyCardZero).join('');
  return '<div class="tr-level-section tr-level-section-zero">' + head + '<div class="tr-cards">' + cards + '</div></div>';
}

function buildTrophyCard(skill, level, tier, isMuted) {
  var dates = (typeof skillLevelDates !== 'undefined' && skillLevelDates[skill.id]) || {};
  var dateStr = dates[String(level)] ? trophyDateShort(dates[String(level)]) : '';
  var iconHtml = '<div class="sk-icon tr-card-icon" style="background:' + skill.bgColor + '">' + (skill.icon || '') + '</div>';

  if (isMuted) {
    // Серая карточка — отключённая дисциплина с достижением.
    return '<div class="tr-card tr-card-muted" onclick="showTrophyPopup(\'' + skill.id + '\')">'
      + iconHtml
      + '<div class="tr-card-name">' + escapeHtml(skill.name) + '</div>'
      + (dateStr ? '<div class="tr-card-date">' + dateStr + '</div>' : '')
      + '</div>';
  }

  var style = 'background:' + tier.cardBg + ';color:' + tier.textPrimary;
  var dateStyle = 'color:' + tier.textSecondary;
  return '<div class="tr-card" style="' + style + '" onclick="showTrophyPopup(\'' + skill.id + '\')">'
    + iconHtml
    + '<div class="tr-card-name">' + escapeHtml(skill.name) + '</div>'
    + (dateStr ? '<div class="tr-card-date" style="' + dateStyle + '">' + dateStr + '</div>' : '')
    + '</div>';
}

function buildTrophyCardZero(skill) {
  var iconHtml = '<div class="sk-icon tr-card-icon tr-card-icon-zero" style="background:' + skill.bgColor + '">' + (skill.icon || '') + '</div>';
  return '<div class="tr-card tr-card-zero" onclick="showTrophyPopup(\'' + skill.id + '\')">'
    + iconHtml
    + '<div class="tr-card-name">' + escapeHtml(skill.name) + '</div>'
    + '</div>';
}

// ─── Попап ─────────────────────────────────────────────────────────────────
//
// Bottom sheet с фоном по тиру (для уровня 0 — белый). Содержит:
// — иконку навыка (128px, на родной подложке skill.bgColor)
// — название навыка и дисциплину
// — бейдж "Уровень N · Тир" (для уровня 0 — просто "Уровень 0")
// — название и описание текущего уровня (берём из skill.levels[level])
// — дату текущего уровня (только при level > 0)
// — историю предыдущих уровней с датами (только при level > 1)

function showTrophyPopup(skillId) {
  var skill = getSkillById(skillId);
  if (!skill) return;
  var level = trophySkillLevel(skill);
  var levelData = (skill.levels && skill.levels[level]) || {};
  var tier = trophyTier(level);
  var dates = (typeof skillLevelDates !== 'undefined' && skillLevelDates[skill.id]) || {};
  var sectionMeta = getSectionMeta(skill.section) || { label: '' };

  var existing = document.getElementById('trophy-popup');
  if (existing) existing.remove();

  // Палитра попапа. Уровень 0 — нейтральный белый, без тира.
  var palette;
  if (tier) {
    palette = {
      bg: tier.cardBg, textPrimary: tier.textPrimary, textSecondary: tier.textSecondary,
      accentBg: tier.accentBg, accentText: tier.accentText,
      divider: 'rgba(0,0,0,0.12)', drag: tier.textSecondary,
    };
  } else {
    palette = {
      bg: '#FFFFFF', textPrimary: '#1a1a18', textSecondary: '#888780',
      accentBg: '#444441', accentText: '#F1EFE8',
      divider: 'rgba(0,0,0,0.08)', drag: '#888780',
    };
  }

  var badgeText = tier ? ('Уровень ' + level + ' · ' + tier.label) : 'Уровень 0';

  var currentDateBlock = '';
  if (level > 0 && dates[String(level)]) {
    currentDateBlock = '<div class="trophy-current-date" style="border-color:' + palette.divider + '">'
      + '<div class="trophy-date-label" style="color:' + palette.textSecondary + '">Достигнут</div>'
      + '<div class="trophy-date-value" style="color:' + palette.textPrimary + '">' + trophyDateLong(dates[String(level)]) + '</div>'
      + '</div>';
  }

  var historyBlock = '';
  if (level > 1) {
    var rows = '';
    for (var L = level - 1; L >= 1; L--) {
      var dt = dates[String(L)] ? trophyDateLong(dates[String(L)]) : '—';
      rows += '<div class="trophy-history-row" style="color:' + palette.textSecondary + '">'
        + '<span>Уровень ' + L + '</span>'
        + '<span>' + dt + '</span>'
        + '</div>';
    }
    historyBlock = '<div class="trophy-history">'
      + '<div class="trophy-history-title" style="color:' + palette.textSecondary + '">История</div>'
      + rows
      + '</div>';
  }

  var iconHtml = '<div class="sk-icon trophy-icon" style="--icon-size:128px;background:' + skill.bgColor + ';border-radius:24px">' + (skill.icon || '') + '</div>';

  var popup = document.createElement('div');
  popup.id = 'trophy-popup';
  popup.className = 'trophy-popup-overlay';
  popup.onclick = function() { popup.remove(); };
  var sheetStyle = 'background:' + palette.bg + ';color:' + palette.textPrimary;
  popup.innerHTML = '<div class="trophy-popup-sheet" style="' + sheetStyle + '">'
    + '<div class="trophy-drag-handle" style="background:' + palette.drag + '"></div>'
    + iconHtml
    + '<div class="trophy-name">' + escapeHtml(skill.name) + '</div>'
    + '<div class="trophy-discipline" style="color:' + palette.textSecondary + '">' + escapeHtml(sectionMeta.label) + '</div>'
    + '<div class="trophy-badge" style="background:' + palette.accentBg + ';color:' + palette.accentText + '">' + badgeText + '</div>'
    + '<div class="trophy-level-name">' + escapeHtml(levelData.name || '') + '</div>'
    + '<div class="trophy-level-desc" style="color:' + palette.textSecondary + '">' + escapeHtml(levelData.desc || '') + '</div>'
    + currentDateBlock
    + historyBlock
    + '</div>';
  popup.querySelector('.trophy-popup-sheet').onclick = function(e) { e.stopPropagation(); };
  document.body.appendChild(popup);
}
