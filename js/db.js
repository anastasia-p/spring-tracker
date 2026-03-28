// Firebase init and data access layer

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


// In-memory cache: section -> dateKey -> {plan, type, label, checks, values}
var cache = { strength: {}, wingchun: {}, qigong: {} };

// Current plans loaded from Firebase
var plans = { strength: null, wingchun: null, qigong: null, tests: null };

function loadPlanFromFirebase(section) {
  var field = section === 'tests' ? 'items' : 'days';
  return db.collection('plan').doc(section).get().then(function(s) {
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
  return db.collection(section).doc(dk).get().then(function(s) {
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
  db.collection(section).doc(dk).set({
    plan: data.plan,
    type: data.type,
    label: data.label,
    checks: data.checks,
    values: data.values
  }).catch(function() {});
}

function loadTreeMinutes() {
  return db.collection('tracker').doc('tree').get().then(function(s) {
    treeTotalMinutes = s.exists ? (s.data().totalMinutes || 0) : 0;
  }).catch(function() { treeTotalMinutes = 0; });
}

function loadMountainSeconds() {
  return db.collection('tracker').doc('iron_legs').get().then(function(s) {
    mountainTotalSeconds = s.exists ? (s.data().totalSeconds || 0) : 0;
  }).catch(function() { mountainTotalSeconds = 0; });
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

function recalcMountainSeconds() {
  db.collection('wingchun').get().then(function(snap) {
    var total = 0;
    snap.forEach(function(doc) {
      var values = doc.data().values || {};
      STANCE_EXERCISES.forEach(function(name) {
        if (values[name]) total += values[name];
      });
    });
    mountainTotalSeconds = total;
    db.collection('tracker').doc('iron_legs').set({ totalSeconds: total }).catch(function() {});
    renderMountainProgress();
  }).catch(function() {});
}
