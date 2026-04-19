// Общий setup для тестов db.js
'use strict';

var path = require('path');
var createMockFirestore = require('./firestore-mock').createMockFirestore;
var pure = require('../../js/pure.js');

var DB_PATH = path.resolve(__dirname, '../../js/db.js');

function setup(opts) {
  opts = opts || {};
  var schemaV2 = !!opts.schemaV2;
  var uid = opts.uid || 'u1';
  var seed = opts.seed || {};

  var mock = createMockFirestore();

  var configPath = 'users/' + uid;
  var config = Object.assign({ email: 'test@test', createdAt: '2026-01-01T00:00:00.000Z' },
                             opts.config || {});
  if (schemaV2) config.schema_version = 2;
  mock.seed(configPath, config);

  Object.keys(seed).forEach(function(p) { mock.seed(p, seed[p]); });

  global.firebase = {
    firestore: function() { return mock.db; },
    auth: function() { return { currentUser: { uid: uid } }; },
  };
  global.currentUser = { uid: uid };
  global.userCreatedAt = config.createdAt;
  global.SECTIONS = pure.SECTIONS;
  global.SECTION_META = pure.SECTION_META;
  global.SKILLS = pure.SKILLS;
  global.pluralize = pure.pluralize;
  global.dateKey = pure.dateKey;
  global.getDayPlanIndex = pure.getDayPlanIndex;
  global.getWeekDates = pure.getWeekDates;
  global.getSkillById = pure.getSkillById;
  global.API_URL = 'http://mock.api';
  global.fetch = function() { return Promise.reject(new Error('fetch disabled in tests')); };
  global.userDoc = function() { return mock.db.collection('users').doc(uid); };
  global.renderSkillById = function() {};

  delete require.cache[DB_PATH];
  var dbMod = require(DB_PATH);

  return { mock: mock, api: dbMod, uid: uid };
}

function teardown() {
  ['firebase', 'currentUser', 'userCreatedAt',
   'SECTIONS', 'SECTION_META', 'SKILLS', 'pluralize', 'dateKey',
   'getDayPlanIndex', 'getWeekDates', 'getSkillById',
   'API_URL', 'fetch', 'userDoc', 'renderSkillById',
  ].forEach(function(name) { delete global[name]; });
}

module.exports = { setup: setup, teardown: teardown };
