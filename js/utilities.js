// language: JavaScript, file: utilities.js
// Shared helpers. All Unicode-aware regexes are built at RUNTIME so this file
// parses safely on every browser — no lookbehind, no \p{} literals.

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1) + ' ' + sizes[i];
}

function formatNumber(n) {
  return Number(n || 0).toLocaleString('en-US');
}

function formatDuration(seconds) {
  const s = Number(seconds || 0);
  if (!s || s < 1) return '0s';
  if (s < 60) return Math.ceil(s) + 's';
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return sec > 0 ? `${m}m ${sec}s` : `${m}m`;
}

function debounce(fn, delay = 200) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function downloadBlob(content, filename, mime = 'text/plain') {
  const fullMime = mime + ';charset=utf-8';
  try {
    const blob = new Blob([content], { type: fullMime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    setTimeout(() => {
      try { document.body.removeChild(a); } catch {}
      URL.revokeObjectURL(url);
    }, 200);
    return true;
  } catch (err) {
    try {
      const dataUrl = 'data:' + fullMime + ',' + encodeURIComponent(content);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      setTimeout(() => { try { document.body.removeChild(a); } catch {} }, 200);
      return true;
    } catch (err2) {
      console.error('[WordsAnalyser] downloadBlob failed:', err, err2);
      return false;
    }
  }
}

async function copyToClipboard(text) {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch {}
    document.body.removeChild(ta);
    return ok;
  }
}

function toast(message, type = 'info', duration = 2600) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 280);
  }, duration);
}

// ============================================================
// WordHelpers — safe cross-browser text primitives
// ============================================================
(function () {
  let WORD_RE, NON_WORD_CHAR_RE;
  let unicodeSupported = false;

  try {
    WORD_RE = new RegExp("[\\p{L}\\p{N}][\\p{L}\\p{N}'’\\-]*", 'gu');
    // Verify actual Unicode matching, not just successful construction
    const probe = 'café hello 123';
    const got = probe.match(WORD_RE);
    if (!got || got.indexOf('café') === -1) throw new Error('unicode match failed');
    NON_WORD_CHAR_RE = new RegExp('[^\\p{L}\\p{N}]', 'gu');
    unicodeSupported = true;
  } catch (e) {
    WORD_RE = /[A-Za-z0-9][A-Za-z0-9'’\-]*/g;
    NON_WORD_CHAR_RE = /[^A-Za-z0-9]/g;
    unicodeSupported = false;
  }

  window.WordHelpers = {
    WORD_RE: WORD_RE,
    NON_WORD_CHAR_RE: NON_WORD_CHAR_RE,
    unicodeSupported: unicodeSupported,

    extractWords: function (text) {
      if (text == null) return [];
      const m = String(text).match(WORD_RE);
      return m || [];
    },

    // Manual sentence splitter — no lookbehind required anywhere
    splitSentences: function (text) {
      if (text == null) return [];
      const s = String(text);
      const result = [];
      let start = 0;
      const len = s.length;
      for (let i = 0; i < len; i++) {
        const code = s.charCodeAt(i);
        // 46='.'  33='!'  63='?'
        if (code === 46 || code === 33 || code === 63) {
          const next = i + 1 < len ? s.charCodeAt(i + 1) : 0;
          // 0=EOF  32=space  9=tab  10=LF  13=CR
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
    },

    cleanWord: function (w) {
      return String(w).replace(NON_WORD_CHAR_RE, '');
    },
  };

  console.log(
    '[WordsAnalyser] utilities.js loaded — WordHelpers: ' +
    (unicodeSupported ? 'Unicode' : 'ASCII fallback')
  );
})();

// ============================================================
// Theme
// ============================================================
const THEME_KEY = 'wordsanalyser-theme';

function getStoredTheme() {
  try { return localStorage.getItem(THEME_KEY); } catch { return null; }
}
function setStoredTheme(theme) {
  try { localStorage.setItem(THEME_KEY, theme); } catch {}
}
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]:not([media])') ||
               document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#ffffff' : '#08080a');
}
function initTheme() {
  const stored = getStoredTheme();
  let initial = stored;
  if (!initial) {
    initial = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  applyTheme(initial);
  return initial;
}
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  setStoredTheme(next);
  return next;
}

// ============================================================
// Ripple / touch feedback
// ============================================================
function attachRipples(root) {
  root = root || document;
  const selector = [
    '.btn', '.nav-btn', '.quick-card', '.tool-run', '.file-remove',
    '.back-to-top', '.theme-toggle', '.menu-toggle', '.footer-link',
    '.dropdown-menu button',
  ].join(', ');

  root.querySelectorAll(selector).forEach(el => {
    if (el.dataset.ripple === 'on') return;
    el.dataset.ripple = 'on';
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const size = Math.max(rect.width, rect.height) * 1.1;
      const x = (e.clientX || rect.left + rect.width / 2) - rect.left - size / 2;
      const y = (e.clientY || rect.top + rect.height / 2) - rect.top - size / 2;
      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = x + 'px';
      ripple.style.top = y + 'px';
      el.appendChild(ripple);
      setTimeout(() => ripple.remove(), 650);
    });
  });
}

// ============================================================
// App state
// ============================================================
window.AppState = window.AppState || { files: [], analyses: [] };