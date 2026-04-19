// Firebase Auth — login, register, onboarding
var currentUser = null;

// Sentinel: отличает "ошибку загрузки" от "конфига нет (новый пользователь)".
var CONFIG_ERROR = { __configError: true };

function hideSplash() {
  var el = document.getElementById('splash-screen');
  if (el) {
    el.classList.add('hidden');
    setTimeout(function() { el.style.display = 'none'; }, 400);
  }
}

// --- Auth state ---
firebase.auth().onAuthStateChanged(function(user) {
  if (user) {
    currentUser = user;
    setAuthLoading(false);
    document.getElementById('auth-screen').style.display = 'none';
    loadUserConfig().then(function(config) {
      if (config === CONFIG_ERROR) {
        showAuthScreen();
        showAuthError('Не удалось загрузить данные. Проверь соединение и войди снова', 'login');
      } else if (!config) {
        showOnboarding();
      } else {
        userCreatedAt = config.createdAt || null;
        startApp(config.sections || ['strength']);
      }
    });
  } else {
    currentUser = null;
    showAuthScreen();
  }
});

// --- Show/hide screens ---
function showAuthScreen() {
  hideSplash();
  var authEl    = document.getElementById('auth-screen');
  var onboardEl = document.getElementById('onboarding-screen');
  var mainEl    = document.getElementById('main-app');
  if (authEl)    authEl.style.display    = 'flex';
  if (onboardEl) onboardEl.style.display = 'none';
  if (mainEl)    mainEl.style.display    = 'none';
  showLoginForm();
}

function showLoginForm() {
  document.getElementById('auth-login').style.display    = 'block';
  document.getElementById('auth-register').style.display = 'none';
  clearAuthError();
}

function showRegisterForm() {
  document.getElementById('auth-login').style.display    = 'none';
  document.getElementById('auth-register').style.display = 'block';
  clearAuthError();
}

function showOnboarding() {
  hideSplash();
  var authEl    = document.getElementById('auth-screen');
  var onboardEl = document.getElementById('onboarding-screen');
  var mainEl    = document.getElementById('main-app');
  if (authEl)    authEl.style.display    = 'none';
  if (onboardEl) onboardEl.style.display = 'flex';
  if (mainEl)    mainEl.style.display    = 'none';
  renderOnboarding();
}

function startApp(sections) {
  hideSplash();
  var authEl    = document.getElementById('auth-screen');
  var onboardEl = document.getElementById('onboarding-screen');
  var mainEl    = document.getElementById('main-app');
  if (authEl)    authEl.style.display    = 'none';
  if (onboardEl) onboardEl.style.display = 'none';
  if (mainEl)    mainEl.style.display    = 'block';
  initWithSections(sections);
}

// --- Auth actions ---
function doLogin() {
  clearAuthError();
  var email    = document.getElementById('login-email').value.trim();
  var password = document.getElementById('login-password').value;
  if (!email)    { showAuthError('Введите email',  'login'); return; }
  if (!password) { showAuthError('Введите пароль', 'login'); return; }
  setAuthLoading(true);
  firebase.auth().signInWithEmailAndPassword(email, password)
    .catch(function(e) { setAuthLoading(false); showAuthError(getAuthErrorMessage(e.code), 'login'); });
}

function doRegister() {
  clearAuthError();
  var email     = document.getElementById('reg-email').value.trim();
  var password  = document.getElementById('reg-password').value;
  var password2 = document.getElementById('reg-password2').value;
  if (!email)                { showAuthError('Введите email',                                          'register'); return; }
  if (!password)             { showAuthError('Введите пароль',                                         'register'); return; }
  if (password !== password2){ showAuthError('Пароли не совпадают',                                    'register'); return; }
  if (password.length < 6)   { showAuthError('Пароль минимум 6 символов',                             'register'); return; }
  if (!document.getElementById('reg-privacy').checked) {
    showAuthError('Необходимо согласие с политикой конфиденциальности', 'register'); return;
  }
  setAuthLoading(true);
  firebase.auth().createUserWithEmailAndPassword(email, password)
    .catch(function(e) { setAuthLoading(false); showAuthError(getAuthErrorMessage(e.code), 'register'); });
}

function doLogout()        { firebase.auth().signOut(); }

function doResetPassword() {
  var email = document.getElementById('login-email').value.trim();
  if (!email) { showAuthError('Введите email для восстановления пароля', 'login'); return; }
  firebase.auth().sendPasswordResetEmail(email)
    .then(function()  { showAuthError('Письмо отправлено на ' + email, 'login'); })
    .catch(function(e){ showAuthError(getAuthErrorMessage(e.code), 'login'); });
}

function setAuthLoading(loading) {
  document.querySelectorAll('.auth-btn').forEach(function(b) { b.disabled = loading; });
}

function showAuthError(msg, form) {
  var id = form === 'register' ? 'auth-error-register' : 'auth-error-login';
  var el = document.getElementById(id);
  if (el) el.textContent = msg;
}

function clearAuthError() {
  var login = document.getElementById('auth-error-login');
  var reg   = document.getElementById('auth-error-register');
  if (login) login.textContent = '\u200b';
  if (reg)   reg.textContent   = '\u200b';
}

function getAuthErrorMessage(code) {
  var messages = {
    'auth/user-not-found':        'Неверный email или пароль',
    'auth/wrong-password':        'Неверный email или пароль',
    'auth/invalid-credential':    'Неверный email или пароль',
    'auth/internal-error':        'Неверный email или пароль',
    'auth/invalid-email':         'Неверный формат email',
    'auth/email-already-in-use':  'Этот email уже зарегистрирован',
    'auth/weak-password':         'Пароль слишком короткий — минимум 6 символов',
    'auth/too-many-requests':     'Слишком много попыток. Попробуй позже',
    'auth/network-request-failed':'Ошибка сети. Проверь подключение к интернету',
    'auth/operation-not-allowed': 'Этот способ входа не разрешён',
    'auth/requires-recent-login': 'Войди в аккаунт заново',
    'auth/user-disabled':         'Аккаунт заблокирован',
  };
  return messages[code] || 'Что-то пошло не так. Попробуй ещё раз';
}

// --- User config ---
var userCreatedAt = null;
var SCHEMA_V2 = false;  // выставляется в loadUserConfig — используется в db.js (isSchemaV2())

function userDoc() {
  return db.collection('users').doc(currentUser.uid);
}

function loadUserConfig() {
  var timeout = new Promise(function(resolve) {
    setTimeout(function() { resolve(CONFIG_ERROR); }, 5000);
  });
  return Promise.race([
    userDoc().get().then(function(s) {
      if (!s.exists) return null;
      var cfg = s.data();
      SCHEMA_V2 = cfg && cfg.schema_version >= 2;
      return cfg;
    }).catch(function(e) {
      console.error('loadUserConfig error:', e);
      return CONFIG_ERROR;
    }),
    timeout
  ]);
}

function saveUserConfig(sections) {
  return userDoc().set({ sections: sections, email: currentUser.email }, { merge: true });
}

// --- Определение платформы ---
function detectPlatform() {
  var ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua))          return 'android';
  return 'desktop';
}

// --- Onboarding ---
function renderOnboarding() {
  var html = SECTIONS.map(function(id) {
    var meta = SECTION_META[id];
    return '<label class="onboard-item">' +
      '<input type="checkbox" class="onboard-check" value="' + id + '" onchange="updateOnboardingBtn()">' +
      '<span>' + meta.label + '</span>' +
    '</label>';
  }).join('');
  document.getElementById('onboarding-list').innerHTML = html;
  updateOnboardingBtn();
}

function updateOnboardingBtn() {
  var checked = document.querySelectorAll('.onboard-check:checked').length;
  var btn = document.getElementById('onboarding-btn');
  btn.disabled     = checked === 0;
  btn.style.opacity = checked === 0 ? '0.5' : '1';
}

function finishOnboarding() {
  var selected = [];
  document.querySelectorAll('.onboard-check:checked').forEach(function(cb) {
    selected.push(cb.value);
  });
  if (!selected.length) selected = ['strength'];

  var btn = document.getElementById('onboarding-btn');
  btn.disabled    = true;
  btn.textContent = 'Загрузка...';

  var baseUrl = location.origin + location.pathname.replace(/[^/]*$/, '');

  // Загружаем дефолтные планы
  var planPromises = selected.map(function(sectionId) {
    var meta = SECTION_META[sectionId];
    if (!meta) return Promise.resolve();
    return userDoc().collection('plan').doc(sectionId).get().then(function(snap) {
      if (snap.exists) return;
      var url = baseUrl + meta.defaultPlan + '?t=' + Date.now();
      return fetch(url).then(function(r) { return r.json(); }).then(function(data) {
        return userDoc().collection('plan').doc(sectionId).set({
          days: data,
          updatedAt: new Date().toISOString()
        });
      });
    });
  });

  // Загружаем тесты (только для секций у которых есть defaultTests)
  var testFiles = selected
    .map(function(id) { return SECTION_META[id]; })
    .filter(function(meta) { return meta && meta.defaultTests; })
    .map(function(meta) { return baseUrl + meta.defaultTests + '?t=' + Date.now(); });

  planPromises.push(
    userDoc().collection('plan').doc('tests').get().then(function(snap) {
      if (snap.exists) return;
      if (!testFiles.length) return;
      return Promise.all(testFiles.map(function(url) {
        return fetch(url).then(function(r) { return r.ok ? r.json() : []; });
      })).then(function(results) {
        var seen = {}, merged = [];
        results.forEach(function(items) {
          items.forEach(function(item) {
            if (!seen[item.name]) { seen[item.name] = true; merged.push(item); }
          });
        });
        return userDoc().collection('plan').doc('tests').set({
          items: merged,
          updatedAt: new Date().toISOString()
        });
      });
    })
  );

  Promise.all(planPromises).then(function() {
    var platform = detectPlatform();
    var createdAt = new Date().toISOString();
    userCreatedAt = createdAt;
    return userDoc().set({
      sections:  selected,
      email:     currentUser.email,
      createdAt: createdAt,
      platform:  platform
    }, { merge: true });
  }).then(function() {
    return currentUser.getIdToken().then(function(token) {
      return fetch('https://api.spring-tracker.ru:8080/notify/new-user', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token }
      });
    }).catch(function(e) { console.warn('notify-new-user failed:', e); });
  }).then(function() {
    startApp(selected);
  }).catch(function(e) {
    btn.disabled    = false;
    btn.textContent = 'Начать';
    console.error(e);
  });
}

function togglePassword(inputId, btn) {
  var input = document.getElementById(inputId);
  var show  = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.innerHTML = show
    ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
    : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
}
