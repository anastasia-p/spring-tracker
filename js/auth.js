// Firebase Auth — login, register, onboarding

var currentUser = null;

function hideSplash() {
  var el = document.getElementById('splash-screen');
  if (el) {
    el.classList.add('hidden');
    setTimeout(function() { el.style.display = 'none'; }, 400);
  }
}

var SECTION_TEMPLATES = [
  { id: 'strength', label: 'Силовые',   planFile: 'strength_default.json' },
  { id: 'wingchun', label: 'Вин Чун',   planFile: 'wingchun_default.json' },
  { id: 'qigong',   label: 'Цигун',     planFile: 'qigong_default.json'   },
];

// --- Auth state ---

firebase.auth().onAuthStateChanged(function(user) {
  if (user) {
    currentUser = user;
    setAuthLoading(false);
    document.getElementById('auth-screen').style.display = 'none';
    loadUserConfig().then(function(config) {
      if (!config) {
        showOnboarding();
      } else {
        startApp(config.sections || ['strength']);
      }
    }).catch(function() {
      showOnboarding();
    });
  } else {
    currentUser = null;
    showAuthScreen();
  }
});

// --- Show/hide screens ---

function showAuthScreen() {
  hideSplash();
  var authEl = document.getElementById('auth-screen');
  var onboardEl = document.getElementById('onboarding-screen');
  var mainEl = document.getElementById('main-app');
  if (authEl) authEl.style.display = 'flex';
  if (onboardEl) onboardEl.style.display = 'none';
  if (mainEl) mainEl.style.display = 'none';
  showLoginForm();
}

function showLoginForm() {
  document.getElementById('auth-login').style.display = 'block';
  document.getElementById('auth-register').style.display = 'none';
  clearAuthError();
}

function showRegisterForm() {
  document.getElementById('auth-login').style.display = 'none';
  document.getElementById('auth-register').style.display = 'block';
  clearAuthError();
}

function showOnboarding() {
  hideSplash();
  var authEl = document.getElementById('auth-screen');
  var onboardEl = document.getElementById('onboarding-screen');
  var mainEl = document.getElementById('main-app');
  if (authEl) authEl.style.display = 'none';
  if (onboardEl) onboardEl.style.display = 'flex';
  if (mainEl) mainEl.style.display = 'none';
  renderOnboarding();
}

function startApp(sections) {
  hideSplash();
  var authEl = document.getElementById('auth-screen');
  var onboardEl = document.getElementById('onboarding-screen');
  var mainEl = document.getElementById('main-app');
  if (authEl) authEl.style.display = 'none';
  if (onboardEl) onboardEl.style.display = 'none';
  if (mainEl) mainEl.style.display = 'block';
  initWithSections(sections);
}

// --- Auth actions ---

function doLogin() {
  clearAuthError();
  var email = document.getElementById('login-email').value.trim();
  var password = document.getElementById('login-password').value;
  if (!email) { showAuthError('Введите email', 'login'); return; }
  if (!password) { showAuthError('Введите пароль', 'login'); return; }
  setAuthLoading(true);
  firebase.auth().signInWithEmailAndPassword(email, password)
    .catch(function(e) {
      setAuthLoading(false);
      showAuthError(getAuthErrorMessage(e.code), 'login');
    });
}

function doRegister() {
  clearAuthError();
  var email = document.getElementById('reg-email').value.trim();
  var password = document.getElementById('reg-password').value;
  var password2 = document.getElementById('reg-password2').value;
  if (!email) { showAuthError('Введите email', 'register'); return; }
  if (!password) { showAuthError('Введите пароль', 'register'); return; }
  if (password !== password2) { showAuthError('Пароли не совпадают', 'register'); return; }
  if (password.length < 6) { showAuthError('Пароль минимум 6 символов', 'register'); return; }
  setAuthLoading(true);
  firebase.auth().createUserWithEmailAndPassword(email, password)
    .then(function() {
      // onAuthStateChanged will handle navigation
      // just show loading state
    })
    .catch(function(e) {
      setAuthLoading(false);
      showAuthError(getAuthErrorMessage(e.code), 'register');
    });
}

function doLogout() {
  firebase.auth().signOut();
}

function doResetPassword() {
  var email = document.getElementById('login-email').value.trim();
  if (!email) { showAuthError('Введите email для восстановления пароля', 'login'); return; }
  firebase.auth().sendPasswordResetEmail(email).then(function() {
    showAuthError('Письмо отправлено на ' + email, 'login');
  }).catch(function(e) {
    showAuthError(getAuthErrorMessage(e.code), 'login');
  });
}

function setAuthLoading(loading) {
  var btns = document.querySelectorAll('.auth-btn');
  btns.forEach(function(b) { b.disabled = loading; });
}

function showAuthError(msg, form) {
  var id = form === 'register' ? 'auth-error-register' : 'auth-error-login';
  var el = document.getElementById(id);
  if (el) el.textContent = msg;
}

function clearAuthError() {
  var login = document.getElementById('auth-error-login');
  var reg = document.getElementById('auth-error-register');
  if (login) login.textContent = '​';
  if (reg) reg.textContent = '​';
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

function userDoc() {
  return db.collection('users').doc(currentUser.uid);
}

function loadUserConfig() {
  return userDoc().get().then(function(s) {
    return s.exists ? s.data() : null;
  }).catch(function() { return null; });
}

function saveUserConfig(sections) {
  return userDoc().set({ sections: sections, email: currentUser.email }, { merge: true });
}

// --- Onboarding ---

function renderOnboarding() {
  var html = SECTION_TEMPLATES.map(function(s) {
    return '<label class="onboard-item">' +
      '<input type="checkbox" class="onboard-check" value="' + s.id + '" onchange="updateOnboardingBtn()">' +
      '<span>' + s.label + '</span>' +
    '</label>';
  }).join('');
  document.getElementById('onboarding-list').innerHTML = html;
  updateOnboardingBtn();
}

function updateOnboardingBtn() {
  var checked = document.querySelectorAll('.onboard-check:checked').length;
  var btn = document.getElementById('onboarding-btn');
  btn.disabled = checked === 0;
  btn.style.opacity = checked === 0 ? '0.5' : '1';
}

function finishOnboarding() {
  var selected = [];
  document.querySelectorAll('.onboard-check:checked').forEach(function(cb) {
    selected.push(cb.value);
  });
  if (!selected.length) selected = ['strength'];
  var btn = document.getElementById('onboarding-btn');
  btn.disabled = true;
  btn.textContent = 'Загрузка...';

  // Load plans for selected sections
  var baseUrl = location.origin + location.pathname.replace('index.html', '');
  var planPromises = selected.map(function(sectionId) {
    var tmpl = SECTION_TEMPLATES.find(function(t) { return t.id === sectionId; });
    if (!tmpl) return Promise.resolve();
    var url = baseUrl + 'plans/' + tmpl.planFile + '?t=' + Date.now();
    return fetch(url).then(function(r) { return r.json(); }).then(function(data) {
      return userDoc().collection('plan').doc(sectionId).set({
        days: data, updatedAt: new Date().toISOString()
      });
    });
  });

  // Load tests plan
  var testsUrl = baseUrl + 'plans/tests.json?t=' + Date.now();
  planPromises.push(
    fetch(testsUrl).then(function(r) { return r.json(); }).then(function(data) {
      return userDoc().collection('plan').doc('tests').set({
        items: data, updatedAt: new Date().toISOString()
      });
    })
  );

  Promise.all(planPromises).then(function() {
    return saveUserConfig(selected);
  }).then(function() {
    startApp(selected);
  }).catch(function(e) {
    btn.disabled = false;
    btn.textContent = 'Начать';
    console.error(e);
  });
}

function togglePassword(inputId, btn) {
  var input = document.getElementById(inputId);
  var show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.innerHTML = show
    ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
    : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
}
