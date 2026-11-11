// language: JavaScript, file: app.js
// Bootstrap. Version logged, global error handler, self-verification.

(function () {
  'use strict';

  const VERSION = '2.2.0';

  // ============================================================
  // Global error handler — silent failures become visible
  // ============================================================
  window.addEventListener('error', function (e) {
    const file = e.filename || '';
    if (file.indexOf('/js/') !== -1 || (e.message || '').indexOf('WordsAnalyser') !== -1) {
      console.error('[WordsAnalyser] JS error:', e.message, 'at', file + ':' + e.lineno);
      if (typeof toast === 'function') {
        toast('Script error — open console for details', 'error', 6000);
      }
    }
  });
  window.addEventListener('unhandledrejection', function (e) {
    console.error('[WordsAnalyser] Unhandled rejection:', e.reason);
  });

  // ============================================================
  // Theme — applied before paint
  // ============================================================
  initTheme();

  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      const next = toggleTheme();
      toast(next === 'light' ? 'Light theme' : 'Dark theme', 'info', 1400);
    });
  }

  // ============================================================
  // Ripples
  // ============================================================
  attachRipples();
  const toolsGrid = document.getElementById('tools-grid');
  if (toolsGrid && typeof MutationObserver !== 'undefined') {
    new MutationObserver(function () { attachRipples(toolsGrid); })
      .observe(toolsGrid, { childList: true, subtree: true });
  }

  // ============================================================
  // Startup loader
  // ============================================================
  const loader = document.getElementById('startup-loader');
  const fill = document.getElementById('loader-fill');
  const pct = document.getElementById('loader-percent');
  let progress = 0;
  let finished = false;
  let tickHandle = null;

  function finishLoading() {
    if (finished) return;
    finished = true;
    if (tickHandle) clearInterval(tickHandle);
    if (fill) fill.style.width = '100%';
    if (pct) pct.textContent = '100%';
    setTimeout(function () {
      if (loader) {
        loader.classList.add('loader-out');
        setTimeout(function () { loader.remove(); }, 700);
      }
      document.body.classList.remove('no-scroll');
    }, 200);
  }

  if (loader) {
    document.body.classList.add('no-scroll');
    tickHandle = setInterval(function () {
      progress += Math.random() * 10 + 5;
      if (progress >= 95) progress = 95;
      if (fill) fill.style.width = progress + '%';
      if (pct) pct.textContent = Math.round(progress) + '%';
    }, 140);

    window.addEventListener('load', function () { setTimeout(finishLoading, 400); });
    setTimeout(finishLoading, 2600);
  }

  // ============================================================
  // Year
  // ============================================================
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ============================================================
  // Recent
  // ============================================================
  if (window.Statistics) window.Statistics.renderRecent();

  // ============================================================
  // Keyboard shortcut
  // ============================================================
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (window.Navigation) window.Navigation.activateTab('home');
      const ta = document.getElementById('analysis-input');
      if (ta) ta.focus();
    }
  });

  // ============================================================
  // Boot banner
  // ============================================================
  console.log('[WordsAnalyser] ═════════════════════════════════');
  console.log('[WordsAnalyser]  v' + VERSION + ' booted');
  console.log('[WordsAnalyser]  WordHelpers: ' + (window.WordHelpers ? (window.WordHelpers.unicodeSupported ? 'Unicode ✓' : 'ASCII fallback') : 'MISSING ✗'));
  console.log('[WordsAnalyser]  Analyzer: ' + (window.Analyzer ? 'v' + window.Analyzer.version + ' ✓' : 'MISSING ✗'));
  console.log('[WordsAnalyser]  Uploader: ' + (window.Uploader ? '✓' : 'MISSING ✗'));
  console.log('[WordsAnalyser]  Tools: ' + (window.Tools ? '✓' : 'MISSING ✗'));
  console.log('[WordsAnalyser]  Statistics: ' + (window.Statistics ? '✓' : 'MISSING ✗'));
  console.log('[WordsAnalyser]  Navigation: ' + (window.Navigation ? '✓' : 'MISSING ✗'));
  console.log('[WordsAnalyser] ═════════════════════════════════');

  if (!window.Analyzer) {
    console.error('[WordsAnalyser] FATAL: Analyzer not loaded. Check the browser console above for the parse error.');
    if (typeof toast === 'function') {
      toast('Analyzer failed to load — see console', 'error', 10000);
    }
  }
})();