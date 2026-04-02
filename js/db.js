// Firebase init and data access layer

var db = firebase.firestore();
db.enablePersistence().catch(function() {});

// Helper: returns subcollection scoped to current user
function userCol(name) {
  return db.collection('users').doc(currentUser.uid).collection(name);
}

// Day types loaded from day-types.json
var dayTypes = [];

function loadDayTypes() {
  var baseUrl = location.origin + location.pathname.replace('index.html', '');
  return fetch(baseUrl + 'plans/day-types.json?v=' + Date.now())
    .then(function(r) { return r.json(); })
    .then(function(data) { dayTypes = data; })
    .catch(function() {
      dayTypes = [
        { type: 'legs',    label: 'Ноги + таз',  css: 'b-legs'  },
        { type: 'upper',   label: 'Верх + кор',  css: 'b-upper' },
        { type: 'rest',    label: 'Отдых',        css: 'b-rest'  },
        { type: 'test',    label: 'Отдых + тест', css: 'b-rest'  },
        { type: 'wc',      label: 'Вин Чун',      css: 'b-wc'    },
        { type: 'qi',      label: 'Цигун',        css: 'b-qi'    },
      ];
    });
}

function getDayTypeCSS(type) {
  var found = dayTypes.find(function(t) { return t.type === type; });
  return found ? found.css : 'b-rest';
}

function getDayTypeLabel(type) {
  var found = dayTypes.find(function(t) { return t.type === type; });
  return found ? found.label : type;
}

// In-memory cache
var cache = { strength: {}, wingchun: {}, qigong: {}, tests: {} };

function resetCache(section) {
  if (section === 'tests') {
    cache.tests = {};
  } else {
    cache[section] = {};
  }
}

// Current plans loaded from Firebase
var plans = { strength: null, wingchun: null, qigong: null, tests: null };

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
  userCol(section).doc(dk).set({
    plan: data.plan,
    type: data.type,
    label: data.label,
    checks: data.checks,
    values: data.values
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
  }).catch(function() {
    skillTotals[skill.id] = 0;
  });
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
    // Читаем из кеша если есть (как plan.js), иначе из Firebase
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
  initSkillLevels();
  return Promise.all(SKILLS.map(function(skill) { return loadSkill(skill); }));
}
