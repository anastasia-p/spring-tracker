// Firebase init and data access layer
var db;
if (typeof firebase !== 'undefined' && firebase.firestore) {
  db = firebase.firestore();
  if (db.enablePersistence) db.enablePersistence().catch(function() {});
}

// Helper: returns subcollection scoped to current user
function userCol(name) {
  return db.collection('users').doc(currentUser.uid).collection(name);
}

// Helper: returns reference to current user's main document
function userDoc() {
  return db.collection('users').doc(currentUser.uid);
}

// Helper: returns reference to user's section doc
function sectionRef(section) {
  return db.collection('users').doc(currentUser.uid).collection('sections').doc(section);
}

// =============================================================================
// API-слой для клиентских модулей (auth.js, settings.js, plan-editor.js,
// test-editor.js). Все прямые обращения к Firebase живут здесь.
// =============================================================================

// --- Config ---

function loadConfig() {
  return userDoc().get().then(function(s) {
    return s.exists ? s.data() : null;
  });
}

function saveConfig(partial) {
  return userDoc().set(partial, { merge: true });
}

// --- Section plan (план недели дисциплины) ---
// users/{uid}/sections/{section}/plan/current.days

function loadSectionPlan(section) {
  return sectionRef(section).collection('plan').doc('current').get()
    .then(function(s) { return s.exists ? (s.data().days || []) : null; });
}

function savePlan(section, days) {
  // Обновим и кеш в памяти
  plans[section] = days;
  return sectionRef(section).collection('plan').doc('current').set({
    days: days,
    updatedAt: new Date().toISOString()
  });
}

// --- Section tests (показатели дисциплины, общий список для секции) ---
// users/{uid}/sections/{section}/tests/current.items.

function loadSectionTests(section) {
  return sectionRef(section).collection('tests').doc('current').get()
    .then(function(s) { return s.exists ? (s.data().items || []) : []; });
}

function saveTests(section, items) {
  return sectionRef(section).collection('tests').doc('current').set({
    items: items,
    updatedAt: new Date().toISOString()
  });
}

// Сохраняет общий агрегированный список тестов (как в plans.tests) —
// разносит по секциям через item.section. Используется общим редактором тестов.
// Пишет только в АКТИВНЫЕ секции (userSections). Неактивные не трогаем —
// их данные остаются нетронутыми до повторного включения.
function saveAllTests(items) {
  var activeSections = (typeof userSections !== 'undefined' && userSections) ? userSections : SECTIONS;
  // Группируем только по активным секциям
  var bySection = {};
  activeSections.forEach(function(s) { bySection[s] = []; });
  items.forEach(function(it) {
    var sec = it.section || 'strength';
    if (!bySection[sec]) return; // неактивная секция — пропускаем (не должно случаться,
                                 // но подстрахуемся от мусора в items)
    // Сохраняем без поля section — оно избыточно внутри секции
    var copy = {};
    for (var k in it) if (k !== 'section') copy[k] = it[k];
    bySection[sec].push(copy);
  });
  var now = new Date().toISOString();
  var writes = Object.keys(bySection).map(function(sec) {
    return sectionRef(sec).collection('tests').doc('current').set({
      items: bySection[sec],
      updatedAt: now
    });
  });
  return Promise.all(writes);
}

// --- Создание дефолтов секции при её включении ---
// planDays — days из plans/{section}_default.json (или просто массив)
// testsItems — items из plans/tests_{section}_default.json (или [])

function createSectionDefaults(section, planDays, testsItems) {
  var ref = sectionRef(section);
  var now = new Date().toISOString();
  return Promise.all([
    // plan
    ref.collection('plan').doc('default').set({ days: planDays || [] }),
    ref.collection('plan').doc('current').set({ days: planDays || [], updatedAt: now }),
    // tests
    ref.collection('tests').doc('default').set({ items: testsItems || [] }),
    ref.collection('tests').doc('current').set({ items: testsItems || [], updatedAt: now }),
  ]);
}

// --- Enable / disable section ---
// Хранится параллельно в config.sections[] и sections/{section}.enabled —
// бэкенд/бот читают config.sections, фронт — sections/{section}.

function enableSection(section) {
  return sectionRef(section).set({
    enabled: true,
    updatedAt: new Date().toISOString()
  }, { merge: true }).then(function() {
    return syncSectionsConfigList();
  });
}

function disableSection(section) {
  return sectionRef(section).set({
    enabled: false,
    updatedAt: new Date().toISOString()
  }, { merge: true }).then(function() {
    return syncSectionsConfigList();
  });
}

// Вспомогательная — синхронизирует config.sections[] c enabled флагами в sections/{sec}.
// Нужна в v2, чтобы backend (бот), который смотрит в config.sections, видел актуальный список.
function syncSectionsConfigList() {
  var refs = SECTIONS.map(function(s) { return sectionRef(s).get(); });
  return Promise.all(refs).then(function(snaps) {
    var enabled = [];
    snaps.forEach(function(snap, i) {
      if (snap.exists && snap.data().enabled) enabled.push(SECTIONS[i]);
    });
    return saveConfig({ sections: enabled });
  });
}


// Цвета плашек типов дня — единственное место для добавления нового типа
var DAY_TYPE_STYLES = {
  legs:    { bg: 'var(--green-light)',  color: 'var(--green-text)'  },
  legs2:   { bg: 'var(--green-light)',  color: 'var(--green-text)'  },
  upper:   { bg: 'var(--blue-light)',   color: 'var(--blue-text)'   },
  upper2:  { bg: 'var(--blue-light)',   color: 'var(--blue-text)'   },
  full:    { bg: '#FAECE7',             color: '#712B13'            },
  rest:    { bg: 'var(--gray-light)',   color: 'var(--gray-text)'   },
  test:    { bg: 'var(--gray-light)',   color: 'var(--gray-text)'   },
  wc:      { bg: 'var(--purple-light)', color: 'var(--purple-text)' },
  qi:      { bg: 'var(--amber-light)',  color: 'var(--amber-text)'  },
  cardio:  { bg: '#FCEBEB',             color: '#791F1F'            },
  run:     { bg: '#E1F5EE',             color: '#085041'            },
  stretch: { bg: '#FBEAF0',             color: '#72243E'            },
  yoga:    { bg: '#EAF3DE',             color: '#27500A'            },
};

// Метки типов дня — берём из /config (parser.py), fallback — ключ как есть
var dayTypeLabels = {};
function loadDayTypes() {
  return fetch(API_URL + '/config')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      (data.dayTypes || []).forEach(function(dt) {
        dayTypeLabels[dt.type] = dt.label;
      });
    })
    .catch(function() {});
}

function getDayTypeBadgeStyle(type) {
  var s = DAY_TYPE_STYLES[type] || DAY_TYPE_STYLES['rest'];
  return 'background:' + s.bg + ';color:' + s.color;
}

function getDayTypeLabel(type) {
  return dayTypeLabels[type] || type;
}

// Все секции + тесты — дериватив из SECTION_META (pure.js грузится раньше)
var ALL_DATA_SECTIONS = SECTIONS.concat(['tests']);

// In-memory cache
var cache = {};
ALL_DATA_SECTIONS.forEach(function(s) { cache[s] = {}; });

function resetCache(section) {
  cache[section] = {};
}

// Current plans loaded from Firebase
var plans = {};
ALL_DATA_SECTIONS.forEach(function(s) { plans[s] = null; });

// Skill totals — keyed by skill id
var skillTotals = {};

function loadPlanFromFirebase(section) {
  if (section === 'tests') {
    // Тесты собираются из sections/*/tests/current.items
    var activeSections = (typeof userSections !== 'undefined' && userSections) ? userSections : SECTIONS;
    return Promise.all(activeSections.map(function(sec) {
      return sectionRef(sec).collection('tests').doc('current').get().then(function(s) {
        if (!s.exists) return [];
        var items = s.data().items || [];
        // Проставляем section в памяти
        return items.map(function(it) {
          var copy = {};
          for (var k in it) copy[k] = it[k];
          copy.section = sec;
          return copy;
        });
      }).catch(function() { return []; });
    })).then(function(perSection) {
      var merged = [];
      perSection.forEach(function(arr) { arr.forEach(function(it) { merged.push(it); }); });
      plans.tests = merged;
    });
  }
  return sectionRef(section).collection('plan').doc('current').get().then(function(s) {
    if (s.exists) plans[section] = s.data().days;
  }).catch(function(e) { console.error('loadPlanFromFirebase(' + section + '):', e); });
}

function getDayPlan(section, date) {
  var plan = plans[section];
  if (!plan) return null;
  var idx = getDayPlanIndex(date);
  return plan[idx] || null;
}

// Helper: возвращает ссылку на документ истории дня
function dayDocRef(section, dk) {
  var year = dk.slice(0, 4);
  return sectionRef(section).collection('plan').doc(year).collection('history').doc(dk);
}

function loadDayData(section, date) {
  var dk = dateKey(date);
  if (cache[section][dk]) return Promise.resolve(cache[section][dk]);
  return dayDocRef(section, dk).get().then(function(s) {
    var todayDk = dateKey(new Date());
    var isToday = dk >= todayDk;
    var dayPlan = getDayPlan(section, date);
    if (s.exists) {
      var data = s.data();
      cache[section][dk] = {
        plan:   isToday ? (dayPlan ? dayPlan.exercises : (data.plan || [])) : (data.plan || (dayPlan ? dayPlan.exercises : [])),
        type:   data.type   || (dayPlan ? dayPlan.type  : 'rest'),
        label:  data.label  || (dayPlan ? dayPlan.label : ''),
        checks: data.checks || {},
        values: data.values || {}
      };
    } else {
      cache[section][dk] = {
        plan:   dayPlan ? dayPlan.exercises : [],
        type:   dayPlan ? dayPlan.type  : 'rest',
        label:  dayPlan ? dayPlan.label : '',
        checks: {},
        values: {}
      };
    }
    return cache[section][dk];
  }).catch(function() {
    var dayPlan = getDayPlan(section, date);
    cache[section][dk] = {
      plan:   dayPlan ? dayPlan.exercises : [],
      type:   dayPlan ? dayPlan.type  : 'rest',
      label:  dayPlan ? dayPlan.label : '',
      checks: {},
      values: {}
    };
    return cache[section][dk];
  });
}

function saveDayData(section, date) {
  var dk = dateKey(date), data = cache[section][dk];
  if (!data) return Promise.resolve();
  return dayDocRef(section, dk).set({
    plan: data.plan, type: data.type, label: data.label,
    checks: data.checks, values: data.values
  }).catch(function(e) { console.error('saveDayData(' + section + ',' + dk + '):', e); });
}

// Склеиваем историю тестов всех активных секций по датам.
// Например, для одной даты "2026-04-18" пользователь мог ввести:
//   sections/strength/tests/2026/history/2026-04-18 → { "Отжимания": 25 }
//   sections/wingchun/tests/2026/history/2026-04-18 → { "Мабу": 60 }
// Результат в cache.tests["2026-04-18"] = { "Отжимания": 25, "Мабу": 60 }
function loadTestsCache() {
  var activeSections = (typeof userSections !== 'undefined' && userSections) ? userSections : SECTIONS;
  return Promise.all(activeSections.map(function(sec) {
    return loadTestsHistoryForSection(sec);
  })).then(function(perSection) {
    perSection.forEach(function(docs) {
      docs.forEach(function(d) {
        if (!cache.tests[d.id]) cache.tests[d.id] = {};
        Object.keys(d.data).forEach(function(k) { cache.tests[d.id][k] = d.data[k]; });
      });
    });
  }).catch(function(e) { console.error('loadTestsCache:', e); });
}

function saveTestData(dk, data) {
  cache.tests[dk] = data;
  // Значения показателей хранятся отдельно по секциям.
  // Для записи идём по ВСЕМ активным секциям — чтобы удалённые поля тоже стёрлись.
  // (Если бы шли только по секциям у которых есть значения — старые записи в
  // других секциях остались бы жить.)
  var activeSections = (typeof userSections !== 'undefined' && userSections) ? userSections : SECTIONS;
  var bySection = {};
  activeSections.forEach(function(s) { bySection[s] = {}; });
  (plans.tests || []).forEach(function(item) {
    var sec = item.section || 'strength';
    if (!bySection.hasOwnProperty(sec)) return;
    if (data[item.name] !== undefined) {
      bySection[sec][item.name] = data[item.name];
    }
    // Если в data нет значения (удалено) — ничего не добавляем в bySection[sec].
    // При .set() документ перезапишется без этого поля.
  });
  var year = dk.slice(0, 4);
  var writes = Object.keys(bySection).map(function(sec) {
    return sectionRef(sec).collection('tests').doc(year).collection('history').doc(dk)
      .set(bySection[sec]).catch(function(e) { console.error('saveTestData(' + sec + ',' + dk + '):', e); });
  });
  return Promise.all(writes);
}

// --- Universal skill load/recalc ---

function loadSkill(skill) {
  var ref = sectionRef(skill.section).collection('skills').doc(skill.id);
  return ref.get().then(function(s) {
    skillTotals[skill.id] = s.exists ? (s.data()[skill.trackerField] || 0) : 0;
  }).catch(function() { skillTotals[skill.id] = 0; });
}

// Загружает всю историю дней секции (массив { id, data } где id = date).
// Читает коллекции sections/{section}/plan/{year}/history для каждого года в диапазоне
// [createdAt.year .. currentYear], объединяет.
function loadSectionHistoryAll(section, opts) {
  var getOpts = (opts && opts.fromServer) ? { source: 'server' } : undefined;
  var years = listYearsToRead();
  return Promise.all(years.map(function(y) {
    return sectionRef(section).collection('plan').doc(y).collection('history').get(getOpts);
  })).then(function(snaps) {
    var out = [];
    snaps.forEach(function(snap) {
      snap.forEach(function(doc) { out.push({ id: doc.id, data: doc.data() }); });
    });
    return out;
  });
}

// То же самое для тестов. sections/{section}/tests/*/history/*.
function loadTestsHistoryForSection(section, opts) {
  var getOpts = (opts && opts.fromServer) ? { source: 'server' } : undefined;
  var years = listYearsToRead();
  return Promise.all(years.map(function(y) {
    return sectionRef(section).collection('tests').doc(y).collection('history').get(getOpts);
  })).then(function(snaps) {
    var out = [];
    snaps.forEach(function(snap) {
      snap.forEach(function(doc) { out.push({ id: doc.id, data: doc.data() }); });
    });
    return out;
  });
}

// Возвращает список годов-строк для чтения истории: от года createdAt до текущего.
function listYearsToRead() {
  var currentYear = new Date().getFullYear();
  var fromYear = currentYear;
  if (typeof userCreatedAt !== 'undefined' && userCreatedAt) {
    fromYear = new Date(userCreatedAt).getFullYear();
  }
  var years = [];
  for (var y = fromYear; y <= currentYear; y++) years.push(String(y));
  return years;
}

// Сериализация recalcSkill по skill.id: каждый новый вызов ждёт окончания
// предыдущего для того же скила. Это защищает от race condition при быстрых
// кликах (поставил/снял галочку), когда параллельные пересчёты могут записать
// старое значение поверх свежего.
// Инкрементальное обновление навыка — delta прибавляется к текущему total.
// Используется при изменении отдельного значения (галочка/ввод в плане, тест).
// Не читает историю из базы → нет race conditions.
// Предполагается что skillTotals[skill.id] — актуальный baseline
// (был загружен при loadSkill/loadAllSkills в момент входа в приложение).
function adjustSkillTotal(skill, delta) {
  if (!delta) return Promise.resolve();
  var current = skillTotals[skill.id] || 0;
  var next = Math.max(0, current + delta);
  skillTotals[skill.id] = next;
  if (typeof renderSkillById === 'function') renderSkillById(skill.id);
  var doc = {};
  doc[skill.trackerField] = next;
  return sectionRef(skill.section).collection('skills').doc(skill.id).set(doc)
    .catch(function(e) { console.error('adjustSkillTotal(' + skill.id + '):', e); });
}

// Полный пересчёт навыка из всей истории. Используется:
// — при редакторе тестов (меняется состав тестов — нужен полный пересчёт)
// — при явной команде «пересчитать»
// Не используется при обычных изменениях (там adjustSkillTotal).
// Fire-and-forget: запускается и не мешает UI.
function recalcSkill(skill) {
  var sources = [];
  var src = skill.source;
  var fields = src.fields || (src.field ? [src.field] : []);
  sources.push(loadSectionHistoryAll(src.collection).then(function(docs) {
    var total = 0;
    docs.forEach(function(d) {
      var data = d.data;
      var values = data.values || {};
      fields.forEach(function(f) {
        if (values[f]) total += values[f];
        else if (data[f]) total += data[f];
      });
    });
    return total;
  }));
  if (skill.sourceExtra) {
    var ext = skill.sourceExtra;
    var extFields = ext.fields || (ext.field ? [ext.field] : []);
    // В текущих SKILLS все sourceExtra имеют collection === 'tests'.
    // Для tests используем in-memory cache.tests (всегда актуален —
    // обновляется в saveTestData/loadTestsCache синхронно)
    var cachedDocs = cache[ext.collection];
    if (cachedDocs && Object.keys(cachedDocs).length > 0) {
      var cachedTotal = 0;
      Object.keys(cachedDocs).forEach(function(dk) {
        var data = cachedDocs[dk];
        extFields.forEach(function(f) { if (data[f]) cachedTotal += data[f]; });
      });
      sources.push(Promise.resolve(cachedTotal));
    } else {
      // Кеш пуст — собираем из sections/{skill.section}/tests/*/history
      sources.push(loadTestsHistoryForSection(skill.section).then(function(docs) {
        var total = 0;
        docs.forEach(function(d) {
          extFields.forEach(function(f) { if (d.data[f]) total += d.data[f]; });
        });
        return total;
      }));
    }
  }
  return Promise.all(sources).then(function(totals) {
    var total = totals.reduce(function(a, b) { return a + b; }, 0);
    skillTotals[skill.id] = total;
    var doc = {};
    doc[skill.trackerField] = total;
    var writePromise = sectionRef(skill.section).collection('skills').doc(skill.id).set(doc)
      .catch(function(e) { console.error('recalcSkill write(' + skill.id + '):', e); });
    if (typeof renderSkillById === 'function') renderSkillById(skill.id);
    return writePromise;
  }).catch(function(e) { console.error('recalcSkill(' + skill.id + '):', e); });
}

// Find skill by exercise name (used in plan.js)
function findSkillByExercise(exName, collection) {
  return SKILLS.find(function(s) {
    var src = s.source;
    if (src.collection !== collection) return false;
    var fields = src.fields || (src.field ? [src.field] : []);
    return fields.indexOf(exName) !== -1;
  }) || null;
}

// Подсчёт непрерывного streak для секции.
// Идём от вчерашнего дня назад, до даты регистрации.
// День засчитывается в streak если:
//   — plan.length === 0 (отдых)
//   — или хотя бы одно упражнение из плана отмечено (полностью или частично сделано)
// Streak прерывается только если в плане дня были упражнения, но не сделано ни одного.
// Сегодняшний день в подсчёт не входит — он «ещё идёт».
//
// Результат кешируется по секции — при листании недель не пересчитывается.
// Инвалидация — через invalidateStreakCache(section) при изменении галочек.
var streakCache = {};

function invalidateStreakCache(section) {
  delete streakCache[section];
}

function calcDailyStreak(section) {
  if (streakCache[section] !== undefined) {
    return Promise.resolve(streakCache[section]);
  }
  return loadSectionHistoryAll(section).then(function(docs) {
    var docsByDate = {};
    docs.forEach(function(d) { docsByDate[d.id] = d.data; });

    var createdKey = userCreatedAt ? userCreatedAt.slice(0, 10) : null;
    var weekPlan = plans[section];

    var d = new Date();
    d.setDate(d.getDate() - 1); // начинаем со вчера

    var streak = 0;
    for (var i = 0; i < 3650; i++) { // hard-лимит 10 лет
      var dk = dateKey(d);
      if (createdKey && dk < createdKey) break;

      var dayData = docsByDate[dk];
      var plan, checks;
      if (dayData) {
        plan = dayData.plan || [];
        checks = dayData.checks || {};
      } else if (weekPlan) {
        var idx = getDayPlanIndex(d);
        var slot = weekPlan[idx];
        plan = slot && slot.exercises ? slot.exercises : [];
        checks = {};
      } else {
        plan = [];
        checks = {};
      }

      if (plan.length === 0) {
        // день отдыха — streak продолжается
        streak++;
      } else {
        var done = plan.filter(function(ex) { return checks[ex.name]; }).length;
        if (done > 0) {
          // хотя бы одно упражнение сделано (полностью или частично) — streak продолжается
          streak++;
        } else {
          break; // день был запланирован, но ничего не сделано — стоп
        }
      }

      d.setDate(d.getDate() - 1);
    }

    streakCache[section] = streak;
    return streak;
  }).catch(function() { return 0; });
}

function loadAllSkills() {
  // initSkillLevels() удалён — уровни теперь инлайн в SKILLS (pure.js)
  return Promise.all(SKILLS.map(function(skill) {
    return loadSkill(skill);
  }));
}

// Node.js экспорт (для юнит-тестов) — в браузере module не определён
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    userCol: userCol,
    sectionRef: sectionRef,
    // API-слой
    loadConfig: loadConfig,
    saveConfig: saveConfig,
    loadSectionPlan: loadSectionPlan,
    savePlan: savePlan,
    loadSectionTests: loadSectionTests,
    saveTests: saveTests,
    saveAllTests: saveAllTests,
    createSectionDefaults: createSectionDefaults,
    enableSection: enableSection,
    disableSection: disableSection,
    syncSectionsConfigList: syncSectionsConfigList,
    DAY_TYPE_STYLES: DAY_TYPE_STYLES,
    getDayTypeBadgeStyle: getDayTypeBadgeStyle,
    getDayTypeLabel: getDayTypeLabel,
    ALL_DATA_SECTIONS: ALL_DATA_SECTIONS,
    cache: cache,
    resetCache: resetCache,
    plans: plans,
    skillTotals: skillTotals,
    loadPlanFromFirebase: loadPlanFromFirebase,
    getDayPlan: getDayPlan,
    dayDocRef: dayDocRef,
    loadDayData: loadDayData,
    saveDayData: saveDayData,
    loadTestsCache: loadTestsCache,
    saveTestData: saveTestData,
    loadSkill: loadSkill,
    recalcSkill: recalcSkill,
    adjustSkillTotal: adjustSkillTotal,
    findSkillByExercise: findSkillByExercise,
    streakCache: streakCache,
    invalidateStreakCache: invalidateStreakCache,
    calcDailyStreak: calcDailyStreak,
    loadAllSkills: loadAllSkills,
    loadSectionHistoryAll: loadSectionHistoryAll,
    loadTestsHistoryForSection: loadTestsHistoryForSection,
    listYearsToRead: listYearsToRead,
    // Доступ к db для ручной инициализации под Node
    _setDb: function(newDb) { db = newDb; },
  };
}
