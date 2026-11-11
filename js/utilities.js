// language: JavaScript, file: utilities.js
// Shared helpers used across the app

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

/**
 * Robust blob download.
 * Tries Blob + anchor click, dispatches a real MouseEvent (more reliable
 * than .click() in some engines), falls back to data-URL anchor if Blob fails.
 */
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
    a.dispatchEvent(new MouseEvent('click', {
      bubbles: true, cancelable: true, view: window,
    }));
    setTimeout(() => {
      try { document.body.removeChild(a); } catch {}
      URL.revokeObjectURL(url);
    }, 200);
    return true;
  } catch (err) {
    // Fallback: data URL
    try {
      const dataUrl = 'data:' + fullMime + ',' + encodeURIComponent(content);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.dispatchEvent(new MouseEvent('click', {
        bubbles: true, cancelable: true, view: window,
      }));
      setTimeout(() => {
        try { document.body.removeChild(a); } catch {}
      }, 200);
      return true;
    } catch (err2) {
      console.error('[downloadBlob]', err, err2);
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

/* ============ Theme ============ */
const THEME_KEY = 'wordsanalyser-theme';

function getStoredTheme() {
  try { return localStorage.getItem(THEME_KEY); } catch { return null; }
}
function setStoredTheme(theme) {
  try { localStorage.setItem(THEME_KEY, theme); } catch {}
}
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  // Update meta theme-color
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

/* ============ Ripple / Touch Feedback ============ */
function attachRipples(root = document) {
  const selector = [
    '.btn',
    '.nav-btn',
    '.quick-card',
    '.tool-run',
    '.file-remove',
    '.back-to-top',
    '.theme-toggle',
    '.menu-toggle',
    '.footer-link',
    '.dropdown-menu button',
  ].join(', ');

  root.querySelectorAll(selector).forEach(el => {
    if (el.dataset.ripple === 'on') return;
    el.dataset.ripple = 'on';
    el.addEventListener('pointerdown', (e) => {
      // Only left button / touch
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const rect = el.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = (e.clientX || rect.left + rect.width / 2) - rect.left - size / 2;
      const y = (e.clientY || rect.top + rect.height / 2) - rect.top - size / 2;
      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = x + 'px';
      ripple.style.top = y + 'px';
      el.appendChild(ripple);
      setTimeout(() => ripple.remove(), 620);
    });
  });
}

/* ============ App state ============ */
window.AppState = {
  files: [],
  analyses: [],
};