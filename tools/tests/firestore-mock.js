// Мини-мок Firestore для тестов db.js
// Имитирует цепочку collection().doc().collection()...get()/set()/delete()/batch()
// Хранит данные в плоской мапе по путям. Пути ВСЕГДА чётной длины (doc path).
//
// Использование:
//   var mock = createMockFirestore();
//   mock.seed('users/u1/sections/strength', { enabled: true });
//   mock.db.collection('users').doc('u1').get().then(...)
//
// После запуска теста можно проверить:
//   mock.log — список всех операций [['GET', path], ['SET', path, data], ['DELETE', path], ...]
//   mock.store — итоговое состояние хранилища

'use strict';

function createMockFirestore() {
  var store = {};  // path -> data
  var log = [];

  function pathOf(segments) { return segments.join('/'); }

  function isDocPath(segments) { return segments.length % 2 === 0; }
  function isCollPath(segments) { return segments.length % 2 === 1; }

  function makeDocRef(segments) {
    if (!isDocPath(segments)) {
      throw new Error('Invalid doc path (must be even): ' + pathOf(segments));
    }
    var p = pathOf(segments);
    return {
      _isDoc: true,
      _segments: segments,
      id: segments[segments.length - 1],
      path: p,
      collection: function(name) {
        return makeCollRef(segments.concat([name]));
      },
      get: function() {
        log.push(['GET', p]);
        var exists = Object.prototype.hasOwnProperty.call(store, p);
        var data = exists ? store[p] : undefined;
        return Promise.resolve({
          exists: exists,
          id: segments[segments.length - 1],
          data: function() { return data; },
        });
      },
      set: function(data, opts) {
        var merge = !!(opts && opts.merge);
        log.push([merge ? 'SET_MERGE' : 'SET', p, data]);
        if (merge && Object.prototype.hasOwnProperty.call(store, p)) {
          store[p] = Object.assign({}, store[p], data);
        } else {
          store[p] = JSON.parse(JSON.stringify(data));
        }
        return Promise.resolve();
      },
      update: function(data) {
        log.push(['UPDATE', p, data]);
        store[p] = Object.assign({}, store[p] || {}, data);
        return Promise.resolve();
      },
      delete: function() {
        log.push(['DELETE', p]);
        delete store[p];
        return Promise.resolve();
      },
    };
  }

  function makeCollRef(segments) {
    if (!isCollPath(segments)) {
      throw new Error('Invalid collection path (must be odd): ' + pathOf(segments));
    }
    var p = pathOf(segments);
    return {
      _isColl: true,
      _segments: segments,
      id: segments[segments.length - 1],
      path: p,
      doc: function(id) {
        return makeDocRef(segments.concat([id]));
      },
      get: function() {
        log.push(['GET_COLL', p]);
        // Возвращаем snapshot со всеми прямыми детьми
        var docs = [];
        var prefix = p + '/';
        for (var k in store) {
          if (!Object.prototype.hasOwnProperty.call(store, k)) continue;
          if (k.indexOf(prefix) !== 0) continue;
          var rest = k.slice(prefix.length);
          if (rest.indexOf('/') !== -1) continue; // глубже лежащие — не наши
          docs.push({ id: rest, data: makeDataFn(k) });
        }
        return Promise.resolve({
          size: docs.length,
          empty: docs.length === 0,
          docs: docs,
          forEach: function(cb) { docs.forEach(cb); },
        });
      },
    };
  }

  function makeDataFn(path) {
    return function() { return store[path]; };
  }

  function makeBatch() {
    var ops = [];
    return {
      set: function(ref, data, opts) {
        ops.push({ type: 'set', ref: ref, data: data, opts: opts });
        return this;
      },
      update: function(ref, data) {
        ops.push({ type: 'update', ref: ref, data: data });
        return this;
      },
      delete: function(ref) {
        ops.push({ type: 'delete', ref: ref });
        return this;
      },
      commit: function() {
        log.push(['BATCH_COMMIT', ops.length]);
        ops.forEach(function(op) {
          if (op.type === 'set') return op.ref.set(op.data, op.opts);
          if (op.type === 'update') return op.ref.update(op.data);
          if (op.type === 'delete') return op.ref.delete();
        });
        return Promise.resolve();
      },
    };
  }

  var db = {
    collection: function(name) { return makeCollRef([name]); },
    batch: makeBatch,
    enablePersistence: function() { return Promise.resolve(); },
  };

  return {
    db: db,
    store: store,
    log: log,
    // Удобный сеттер — кладёт в store без логирования
    seed: function(path, data) {
      var segs = path.split('/');
      if (!isDocPath(segs)) {
        throw new Error('seed: path must be doc path (even length): ' + path);
      }
      store[path] = JSON.parse(JSON.stringify(data));
    },
    // Сброс лога
    clearLog: function() { log.length = 0; },
  };
}

module.exports = { createMockFirestore: createMockFirestore };
