// Firebase init and data access layer

var db = firebase.firestore();
db.enablePersistence().catch(function() {});

// Helper: returns subcollection scoped to current user
function userCol(name) {
  return db.collection('users').doc(currentUser.uid).collection(name);
}


// In-memory cache: section -> dateKey -> {plan, type, label, checks, values}
var cache = { strength: {}, wingchun: {}, qigong: {} };

// Current plans loaded from Firebase
var plans = { strength: null, wingchun: null, qigong: null, tests: null };

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

function loadTreeMinutes() {
  return userCol('tracker').doc('tree').get().then(function(s) {
    treeTotalMinutes = s.exists ? (s.data().totalMinutes || 0) : 0;
  }).catch(function() { treeTotalMinutes = 0; });
}

function loadMountainSeconds() {
  return userCol('tracker').doc('iron_legs').get().then(function(s) {
    mountainTotalSeconds = s.exists ? (s.data().totalSeconds || 0) : 0;
  }).catch(function() { mountainTotalSeconds = 0; });
}

function recalcTreeMinutes() {
  userCol('qigong').get().then(function(snap) {
    var total = 0;
    snap.forEach(function(doc) {
      var values = doc.data().values || {};
      if (values['Дерево']) total += values['Дерево'];
    });
    treeTotalMinutes = total;
    userCol('tracker').doc('tree').set({ totalMinutes: total }).catch(function() {});
    renderTreeProgress();
  }).catch(function() {});
}

function recalcMountainSeconds() {
  var total = 0;
  Promise.all([
    userCol('wingchun').get(),
    userCol('tests').get()
  ]).then(function(snaps) {
    snaps[0].forEach(function(doc) {
      var values = doc.data().values || {};
      STANCE_EXERCISES.forEach(function(name) {
        if (values[name]) total += values[name];
      });
    });
    snaps[1].forEach(function(doc) {
      var data = doc.data();
      if (data['Всадник у стены']) total += data['Всадник у стены'];
      if (data['Стульчик у стены']) total += data['Стульчик у стены'];
      if (data['Мабу']) total += data['Мабу'];
    });
    mountainTotalSeconds = total;
    userCol('tracker').doc('iron_legs').set({ totalSeconds: total }).catch(function() {});
    renderMountainProgress();
  }).catch(function() {});
}

function loadPushupReps() {
  return userCol('tracker').doc('pushups').get().then(function(s) {
    pushupTotalReps = s.exists ? (s.data().totalReps || 0) : 0;
  }).catch(function() { pushupTotalReps = 0; });
}

function loadPullupReps() {
  return userCol('tracker').doc('pullups').get().then(function(s) {
    pullupTotalReps = s.exists ? (s.data().totalReps || 0) : 0;
  }).catch(function() { pullupTotalReps = 0; });
}

function recalcPushupReps() {
  var total = 0;
  Promise.all([
    userCol('strength').get(),
    userCol('tests').get()
  ]).then(function(snaps) {
    snaps.forEach(function(snap) {
      snap.forEach(function(doc) {
        var values = doc.data().values || {};
        var data = doc.data();
        if (values['Отжимания']) total += values['Отжимания'];
        if (data['Отжимания']) total += data['Отжимания'];
      });
    });
    pushupTotalReps = total;
    userCol('tracker').doc('pushups').set({ totalReps: total }).catch(function() {});
    renderPushupProgress();
  }).catch(function() {});
}

function recalcPullupReps() {
  var total = 0;
  Promise.all([
    userCol('strength').get(),
    userCol('tests').get()
  ]).then(function(snaps) {
    snaps.forEach(function(snap) {
      snap.forEach(function(doc) {
        var values = doc.data().values || {};
        var data = doc.data();
        if (values['Подтягивания']) total += values['Подтягивания'];
        if (data['Подтягивания']) total += data['Подтягивания'];
      });
    });
    pullupTotalReps = total;
    userCol('tracker').doc('pullups').set({ totalReps: total }).catch(function() {});
    renderPullupProgress();
  }).catch(function() {});
}
