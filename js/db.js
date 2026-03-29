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
        { type: 'legs',    label: 'Ноги + таз',   css: 'b-legs'   },
        { type: 'upper',   label: 'Верх + кор',   css: 'b-upper'  },
        { type: 'rest',    label: 'Отдых',         css: 'b-rest'   },
        { type: 'test',    label: 'Отдых + тест',  css: 'b-rest'   },
        { type: 'wc',      label: 'Вин Чун',       css: 'b-wc'     },
        { type: 'qi',      label: 'Цигун',         css: 'b-qi'     },
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

// In-memory cache: section -> dateKey -> {plan, type, label, checks, values}
var cache = { strength: {}, wingchun: {}, qigong: {} };

// Current plans loaded from Firebase
var plans = { strength: null, wingchun: null, qigong: null, tests: null };

// Skill totals state — keyed by skill id
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

// --- Universal skill load/recalc ---

function loadSkill(skill) {
  return userCol('tracker').doc(skill.tracker).get().then(function(s) {
    skillTotals[skill.id] = s.exists ? (s.data()[skill.trackerField] || 0) : 0;
    // sync legacy vars for backward compat with progress.js
    syncLegacyVar(skill);
  }).catch(function() {
    skillTotals[skill.id] = 0;
    syncLegacyVar(skill);
  });
}

function syncLegacyVar(skill) {
  if (skill.id === 'tree')     treeTotalMinutes    = skillTotals[skill.id];
  if (skill.id === 'mountain') mountainTotalSeconds = skillTotals[skill.id];
  if (skill.id === 'pushups')  pushupTotalReps      = skillTotals[skill.id];
  if (skill.id === 'pullups')  pullupTotalReps      = skillTotals[skill.id];
  if (skill.id === 'slt')      sltTotalReps         = skillTotals[skill.id];
  if (skill.id === 'ck')       ckTotalReps          = skillTotals[skill.id];
}

function recalcSkill(skill) {
  var sources = [];

  // Primary source
  var src = skill.source;
  var fields = src.fields || (src.field ? [src.field] : []);
  sources.push(userCol(src.collection).get().then(function(snap) {
    var total = 0;
    snap.forEach(function(doc) {
      var values = doc.data().values || {};
      var data   = doc.data();
      fields.forEach(function(f) {
        if (values[f]) total += values[f];
        else if (data[f]) total += data[f];
      });
    });
    return total;
  }));

  // Extra source (tests etc.)
  if (skill.sourceExtra) {
    var ext = skill.sourceExtra;
    var extFields = ext.fields || (ext.field ? [ext.field] : []);
    sources.push(userCol(ext.collection).get().then(function(snap) {
      var total = 0;
      snap.forEach(function(doc) {
        var data = doc.data();
        extFields.forEach(function(f) { if (data[f]) total += data[f]; });
      });
      return total;
    }));
  }

  Promise.all(sources).then(function(totals) {
    var total = totals.reduce(function(a, b) { return a + b; }, 0);
    skillTotals[skill.id] = total;
    syncLegacyVar(skill);
    userCol('tracker').doc(skill.tracker).set({ [skill.trackerField]: total }).catch(function() {});
    renderSkillById(skill.id);
  }).catch(function() {});
}

function loadAllSkills() {
  initSkillLevels();
  return Promise.all(SKILLS.map(function(skill) { return loadSkill(skill); }));
}

// --- Legacy wrappers (used by plan.js onchange handlers) ---

function recalcTreeMinutes()     { recalcSkill(getSkillById('tree')); }
function recalcMountainSeconds() { recalcSkill(getSkillById('mountain')); }
function recalcPushupReps()      { recalcSkill(getSkillById('pushups')); }
function recalcPullupReps()      { recalcSkill(getSkillById('pullups')); }
function recalcSltReps()         { recalcSkill(getSkillById('slt')); }
function recalcCkReps()          { recalcSkill(getSkillById('ck')); }

// Legacy load wrappers (used by nav.js until step 4)
function loadTreeMinutes()     { return loadSkill(getSkillById('tree')); }
function loadMountainSeconds() { return loadSkill(getSkillById('mountain')); }
function loadPushupReps()      { return loadSkill(getSkillById('pushups')); }
function loadPullupReps()      { return loadSkill(getSkillById('pullups')); }
function loadSltReps()         { return loadSkill(getSkillById('slt')); }
function loadCkReps()          { return loadSkill(getSkillById('ck')); }
