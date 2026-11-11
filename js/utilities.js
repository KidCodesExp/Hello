// language: JavaScript, file: js/utilities.js
// All functions explicitly attached to window to prevent "Can't find variable" errors.

window.$ = function (sel, root) { return (root || document).querySelector(sel); };
window.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

window.escapeHTML = function (str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};

window.formatBytes = function (bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1) + ' ' + sizes[i];
};

window.formatNumber = function (n) { return Number(n || 0).toLocaleString('en-US'); };

window.formatDuration = function (seconds) {
  const s = Number(seconds || 0);
  if (!s || s < 1) return '0s';
  if (s < 60) return Math.ceil(s) + 's';
  const m = Math.floor(s / 60), sec = Math.round(s % 60);
  return sec > 0 ? m + 'm ' + sec + 's' : m + 'm';
};

window.debounce = function (fn, delay) {
  delay = delay || 200;
  let timer;
  return function () {
    const args = arguments, ctx = this;
    clearTimeout(timer);
    timer = setTimeout(function () { fn.apply(ctx, args); }, delay);
  };
};

window.downloadBlob = function (content, filename, mime) {
  mime = mime || 'text/plain';
  const fullMime = mime + ';charset=utf-8';
  try {
    const blob = new Blob([content], { type: fullMime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.style.display = 'none';
    document.body.appendChild(a);
    a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 200);
    return true;
  } catch (err) {
    console.error('Download failed:', err);
    return false;
  }
};

window.copyToClipboard = function (text) {
  if (!text) return Promise.resolve(false);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).then(function(){ return true; }).catch(function(){ return fallback(); });
  }
  return fallback();
  function fallback() {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    ta.remove();
    return Promise.resolve(ok);
  }
};

window.toast = function (message, type, duration) {
  type = type || 'info'; duration = duration || 2600;
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(function () {
    el.classList.add('out');
    setTimeout(function () { el.remove(); }, 280);
  }, duration);
};

// ---- Theme ----
const THEME_KEY = 'wordsanalyser-theme';

window.initTheme = function () {
  let stored = null;
  try { stored = localStorage.getItem(THEME_KEY); } catch (e) {}
  if (!stored) {
    stored = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  document.documentElement.setAttribute('data-theme', stored);
  return stored;
};

window.toggleTheme = function () {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
  return next;
};

// ---- Ripples ----
window.attachRipples = function (root) {
  root = root || document;
  const selector = '.btn, .nav-btn, .quick-card, .tool-run, .file-remove, .back-to-top, .theme-toggle, .menu-toggle, .footer-link, .dropdown-menu button';
  root.querySelectorAll(selector).forEach(function (el) {
    if (el.dataset.ripple === 'on') return;
    el.dataset.ripple = 'on';
    el.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const rect = el.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 1.1;
      const x = (e.clientX || rect.left + rect.width / 2) - rect.left - size / 2;
      const y = (e.clientY || rect.top + rect.height / 2) - rect.top - size / 2;
      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = x + 'px'; ripple.style.top = y + 'px';
      el.appendChild(ripple);
      setTimeout(function () { ripple.remove(); }, 650);
    });
  });
};

// ---- WordHelpers ----
(function () {
  let WORD_RE, NON_WORD_CHAR_RE, unicodeSupported = false;
  try {
    WORD_RE = new RegExp("[\\p{L}\\p{N}][\\p{L}\\p{N}'’\\-]*", 'gu');
    if (!WORD_RE.test('café')) throw new Error();
    NON_WORD_CHAR_RE = new RegExp('[^\\p{L}\\p{N}]', 'gu');
    unicodeSupported = true;
  } catch (e) {
    WORD_RE = /[A-Za-z0-9][A-Za-z0-9'’\-]*/g;
    NON_WORD_CHAR_RE = /[^A-Za-z0-9]/g;
    unicodeSupported = false;
  }

  window.WordHelpers = {
    unicodeSupported: unicodeSupported,
    extractWords: function (text) { return text ? (String(text).match(WORD_RE) || []) : []; },
    cleanWord: function (w) { return String(w).replace(NON_WORD_CHAR_RE, ''); },
    splitSentences: function (text) {
      if (!text) return [];
      const s = String(text), result = [];
      let start = 0;
      for (let i = 0; i < s.length; i++) {
        const code = s.charCodeAt(i);
        if (code === 46 || code === 33 || code === 63) {
          const next = i + 1 < s.length ? s.charCodeAt(i + 1) : 0;
          if (next === 0 || next === 32 || next === 9 || next === 10 || next === 13) {
            const chunk = s.slice(start, i + 1).trim();
            if (chunk) result.push(chunk);
            start = i + 1;
          }
        }
      }
      const tail = s.slice(start).trim();
      if (tail) result.push(tail);
      return result;
    }
  };
  console.log('[WordsAnalyser] utilities.js loaded — ' + (unicodeSupported ? 'Unicode' : 'ASCII'));
})();

window.AppState = window.AppState || { files: [], analyses: [] };