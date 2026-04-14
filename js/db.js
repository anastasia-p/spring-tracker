// Firebase init and data access layer
var db = firebase.firestore();
db.enablePersistence().catch(function() {});

// Helper: returns subcollection scoped to current user
function userCol(name) {
  return db.collection('users').doc(currentUser.uid).collection(name);
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
  var field = section === 'tests' ? 'items' : 'days';
  return userDoc().collection('plan').doc(section).get().then(function(s) {
    if (s.exists) plans[section] = s.data()[field];
  }).catch(function() {});
}

function getDayPlan(section, date) {
  var plan = plans[section];
  if (!plan) return null;
  var idx = getDayPlanIndex(date);
  return plan[idx] || null;
}

function loadDayData(section, date) {
  var dk = dateKey(date);
  if (cache[section][dk]) return Promise.resolve(cache[section][dk]);
  return userCol(section).doc(dk).get().then(function(s) {
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
  if (!data) return;
  userCol(section).doc(dk).set({
    plan: data.plan, type: data.type, label: data.label,
    checks: data.checks, values: data.values
  }).catch(function() {});
}

function loadTestsCache() {
  return userCol('tests').get().then(function(snap) {
    snap.forEach(function(doc) { cache.tests[doc.id] = doc.data(); });
  }).catch(function() {});
}

function saveTestData(dk, data) {
  cache.tests[dk] = data;
  userCol('tests').doc(dk).set(data).catch(function() {});
}

// --- Universal skill load/recalc ---

function loadSkill(skill) {
  return userCol('tracker').doc(skill.tracker).get().then(function(s) {
    skillTotals[skill.id] = s.exists ? (s.data()[skill.trackerField] || 0) : 0;
  }).catch(function() { skillTotals[skill.id] = 0; });
}

function recalcSkill(skill) {
  var sources = [];
  var src = skill.source;
  var fields = src.fields || (src.field ? [src.field] : []);
  sources.push(userCol(src.collection).get().then(function(snap) {
    var total = 0;
    snap.forEach(function(doc) {
      var values = doc.data().values || {};
      var data = doc.data();
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
    var cachedDocs = cache[ext.collection];
    if (cachedDocs && Object.keys(cachedDocs).length > 0) {
      var total = 0;
      Object.keys(cachedDocs).forEach(function(dk) {
        var data = cachedDocs[dk];
        extFields.forEach(function(f) { if (data[f]) total += data[f]; });
      });
      sources.push(Promise.resolve(total));
    } else {
      sources.push(userCol(ext.collection).get().then(function(snap) {
        var total = 0;
        snap.forEach(function(doc) {
          var data = doc.data();
          extFields.forEach(function(f) { if (data[f]) total += data[f]; });
        });
        return total;
      }));
    }
  }
  Promise.all(sources).then(function(totals) {
    var total = totals.reduce(function(a, b) { return a + b; }, 0);
    skillTotals[skill.id] = total;
    var doc = {};
    doc[skill.trackerField] = total;
    userCol('tracker').doc(skill.tracker).set(doc).catch(function() {});
    renderSkillById(skill.id);
  }).catch(function() {});
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

function loadAllSkills() {
  // initSkillLevels() удалён — уровни теперь инлайн в SKILLS (pure.js)
  return Promise.all(SKILLS.map(function(skill) {
    return loadSkill(skill);
  }));
}
