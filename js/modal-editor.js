// modal-editor.js — общие утилиты для plan-editor.js и test-editor.js
// Не использовать напрямую — только через plan-editor / test-editor.

// ─── Загрузка конфига ─────────────────────────────────────────────────────────
// holder: { value: null } — объект-держатель кеша, уникальный для каждого редактора

function meLoadConfig(holder, cb) {
  if (holder.value) { cb(holder.value); return; }
  fetch(API_URL + '/config')
    .then(function(r) { return r.json(); })
    .then(function(d) { holder.value = d; cb(d); })
    .catch(function() {
      cb({ units: ['мин', 'сек', 'раз', 'км', 'кг'], dayTypes: [] });
    });
}

// ─── Открытие оверлея ─────────────────────────────────────────────────────────
// Удаляет предыдущий оверлей с тем же id, создаёт новый, возвращает sheet-элемент.

function meOpen(overlayId, sheetId, onBackdropClick) {
  var prev = document.getElementById(overlayId);
  if (prev) prev.remove();

  var overlay = document.createElement('div');
  overlay.id = overlayId;
  overlay.style.cssText = [
    'position:fixed;top:0;left:0;right:0;bottom:0',
    'background:rgba(0,0,0,0.5)',
    'z-index:9000',
    'display:flex;align-items:flex-end;justify-content:center'
  ].join(';');
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) onBackdropClick();
  });

  var sheet = document.createElement('div');
  sheet.id = sheetId;
  sheet.style.cssText = [
    'background:#fff',
    'border-radius:16px 16px 0 0',
    'width:100%;max-width:480px',
    'max-height:85vh',
    'display:flex;flex-direction:column',
    'overflow:hidden'
  ].join(';');

  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
  return sheet;
}

// ─── Рендер оболочки модалки ──────────────────────────────────────────────────
// Рисует header + body + footer; вызывает opts.renderBody(body) для уникального содержимого.
// opts: {
//   closeBtnId, footerId, saveBtnId,
//   subtitle, title,
//   isForm, editIdx,
//   onClose, onBack, onApply, onSave,
//   renderBody: function(bodyEl)
// }
// Возвращает body-элемент (для управления скроллом из _peRenderList/_teRenderList).

function meRender(sheet, opts) {
  sheet.innerHTML = '';

  // Заголовок
  var header = document.createElement('div');
  header.style.cssText = 'padding:16px 20px 12px;border-bottom:0.5px solid #e5e5e5;display:flex;align-items:center;justify-content:space-between;flex-shrink:0';
  header.innerHTML =
    '<div>' +
      '<div style="font-size:12px;color:#999;margin-bottom:2px">' + opts.subtitle + '</div>' +
      '<div style="font-size:16px;font-weight:500;color:#222">' + opts.title + '</div>' +
    '</div>' +
    '<button id="' + opts.closeBtnId + '" style="background:none;border:none;font-size:22px;color:#aaa;cursor:pointer;padding:2px 8px;line-height:1">×</button>';
  sheet.appendChild(header);
  document.getElementById(opts.closeBtnId).onclick = opts.onClose;

  // Тело
  var body = document.createElement('div');
  body.style.cssText = 'flex:1;overflow-y:auto;padding:12px 20px;-webkit-overflow-scrolling:touch';
  sheet.appendChild(body);
  opts.renderBody(body);

  // Нижняя панель
  var footer = document.createElement('div');
  footer.id = opts.footerId;
  footer.style.cssText = 'padding:12px 20px;border-top:0.5px solid #e5e5e5;display:flex;gap:8px;flex-shrink:0';
  sheet.appendChild(footer);

  if (opts.isForm) {
    var btnBack = meBtn('Назад', 'secondary');
    btnBack.onclick = opts.onBack;
    var btnApply = meBtn(opts.editIdx === null ? 'Добавить' : 'Применить', 'primary');
    btnApply.onclick = opts.onApply;
    footer.appendChild(btnBack);
    footer.appendChild(btnApply);
  } else {
    var btnClose = meBtn('Закрыть', 'secondary');
    btnClose.onclick = opts.onClose;
    var btnSave = meBtn('Сохранить', 'primary');
    btnSave.id = opts.saveBtnId;
    btnSave.onclick = opts.onSave;
    footer.appendChild(btnClose);
    footer.appendChild(btnSave);
  }

  return body;
}

// ─── Анимация кнопки сохранения ───────────────────────────────────────────────
// btnId     — id кнопки «Сохранить»
// promise   — промис сохранения (savePlan / saveAllTests / saveTests)
// onSuccess — вызывается после resolve, до смены текста кнопки
// onFailure — вызывается после reject (необязательный, для console.error)

function meSaveFeedback(btnId, promise, onSuccess, onFailure) {
  var btn = document.getElementById(btnId);
  if (btn) {
    btn.style.width  = btn.offsetWidth  + 'px';
    btn.style.height = btn.offsetHeight + 'px';
    btn.disabled     = true;
    btn.textContent  = 'Сохранение...';
  }
  promise
    .then(function() {
      if (onSuccess) onSuccess();
      if (btn) {
        btn.disabled         = false;
        btn.textContent      = 'Сохранено ✓';
        btn.style.background = '#0F6E56';
        setTimeout(function() {
          if (btn) {
            btn.textContent      = 'Сохранить';
            btn.style.background = '#1D9E75';
            btn.style.width      = '';
            btn.style.height     = '';
          }
        }, 2000);
      }
    })
    .catch(function(e) {
      if (onFailure) onFailure(e);
      alert('Ошибка при сохранении');
      if (btn) {
        btn.disabled     = false;
        btn.textContent  = 'Сохранить';
        btn.style.width  = '';
        btn.style.height = '';
      }
    });
}

// ─── Закрытие с подтверждением ────────────────────────────────────────────────

function meConfirmClose(state, closeFn) {
  if (state && state.dirty) {
    if (!confirm('Есть несохраненные изменения. Выйти без сохранения?')) return;
  }
  closeFn();
}

// ─── UI-примитивы ─────────────────────────────────────────────────────────────

function meBtn(text, type) {
  var btn = document.createElement('button');
  if (type === 'primary') {
    btn.style.cssText = 'flex:1;padding:11px;min-height:42px;border:none;border-radius:10px;background:#1D9E75;color:#fff;font-size:14px;font-weight:500;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1';
  } else {
    btn.style.cssText = 'flex:1;padding:11px;border:0.5px solid #ccc;border-radius:10px;background:none;color:#555;font-size:14px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center';
  }
  btn.textContent = text;
  return btn;
}

function meIconBtn(icon, title) {
  var btn = document.createElement('button');
  btn.textContent   = icon;
  btn.title         = title;
  btn.style.cssText = [
    'background:none',
    'border:0.5px solid #e0e0e0',
    'border-radius:8px',
    'padding:5px 9px',
    'font-size:13px;color:#888',
    'cursor:pointer;flex-shrink:0',
    'display:inline-flex;align-items:center;justify-content:center'
  ].join(';');
  return btn;
}

var _meSelectCSS = [
  'width:100%;box-sizing:border-box',
  'padding:10px 36px 10px 12px',
  'border:0.5px solid #ddd;border-radius:10px',
  'font-size:14px;color:#222',
  'outline:none;cursor:pointer',
  'appearance:none;-webkit-appearance:none',
  'background:#fff url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23999%27 stroke-width=%272%27%3E%3Cpolyline points=%276 9 12 15 18 9%27/%3E%3C/svg%3E") no-repeat right 12px center'
].join(';');

function meInput(val, placeholder, maxLen) {
  var el = document.createElement('input');
  el.type        = 'text';
  el.value       = val || '';
  el.placeholder = placeholder || '';
  if (maxLen) el.maxLength = maxLen;
  el.style.cssText = [
    'width:100%;box-sizing:border-box',
    'padding:10px 12px',
    'border:0.5px solid #ddd;border-radius:10px',
    'font-size:14px;color:#222;background:#fff',
    'outline:none'
  ].join(';');
  el.addEventListener('focus', function() { this.style.borderColor = '#1D9E75'; });
  el.addEventListener('blur',  function() { this.style.borderColor = '#ddd'; });
  return el;
}

// options: массив строк ИЛИ массив объектов { value, label }
function meSelect(currentVal, options) {
  var el = document.createElement('select');
  el.style.cssText = _meSelectCSS;
  el.addEventListener('focus', function() { this.style.borderColor = '#1D9E75'; });
  el.addEventListener('blur',  function() { this.style.borderColor = '#ddd'; });
  options.forEach(function(opt) {
    var o = document.createElement('option');
    if (typeof opt === 'string') {
      o.value = o.textContent = opt;
      if (opt === currentVal) o.selected = true;
    } else {
      o.value       = opt.value;
      o.textContent = opt.label;
      if (opt.value === currentVal) o.selected = true;
    }
    el.appendChild(o);
  });
  return el;
}

// Обёртка поля с подписью и счётчиком символов; добавляет результат в bodyEl.
function meFieldWrap(labelText, el, maxLen, bodyEl) {
  var wrap = document.createElement('div');
  wrap.style.marginBottom = '14px';

  var hdr = document.createElement('div');
  hdr.style.cssText = 'display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px';

  var lbl = document.createElement('label');
  lbl.textContent   = labelText;
  lbl.style.cssText = 'font-size:12px;color:#999';
  hdr.appendChild(lbl);

  if (maxLen) {
    var counter   = document.createElement('span');
    var threshold = Math.floor(maxLen * 0.8);
    function updateCounter() {
      var len       = el.value.length;
      var remaining = maxLen - len;
      counter.textContent = len >= threshold ? remaining + ' / ' + maxLen : '';
      counter.style.color = remaining <= 10 ? '#e24b4a' : '#bbb';
    }
    updateCounter();
    el.addEventListener('input', updateCounter);
    counter.style.cssText = 'font-size:11px;min-width:48px;text-align:right';
    hdr.appendChild(counter);
  }

  wrap.appendChild(hdr);
  wrap.appendChild(el);
  bodyEl.appendChild(wrap);
}
