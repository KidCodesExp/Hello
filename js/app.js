// language: JavaScript, file: app.js
// Bootstrap: theme, loader animation, ripple, year, safe init

(function () {
  // ---- Theme: apply before paint to avoid flash
  initTheme();

  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const next = toggleTheme();
      toast(next === 'light' ? 'Light theme' : 'Dark theme', 'info', 1400);
    });
  }

  // ---- Ripple on all interactive controls
  attachRipples();
  // Re-scan if tools are rendered dynamically later
  const toolsGrid = document.getElementById('tools-grid');
  if (toolsGrid) {
    new MutationObserver(() => attachRipples(toolsGrid))
      .observe(toolsGrid, { childList: true, subtree: true });
  }

  // ---- Startup loader
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
    setTimeout(() => {
      if (loader) {
        loader.classList.add('loader-out');
        setTimeout(() => loader.remove(), 700);
      }
      document.body.classList.remove('no-scroll');
    }, 200);
  }

  if (loader) {
    document.body.classList.add('no-scroll');
    tickHandle = setInterval(() => {
      progress += Math.random() * 10 + 5;
      if (progress >= 95) progress = 95;
      if (fill) fill.style.width = progress + '%';
      if (pct) pct.textContent = Math.round(progress) + '%';
    }, 140);

    window.addEventListener('load', () => {
      setTimeout(finishLoading, 400);
    });

    // Safety net: if load never fires (broken image, stalled font), force finish
    setTimeout(finishLoading, 2600);
  }

  // ---- Year
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ---- Ensure analysis & recent are populated (analyzer already inits)
  if (window.Statistics) window.Statistics.renderRecent();

  // ---- Keyboard shortcut
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (window.Navigation) window.Navigation.activateTab('home');
      const ta = document.getElementById('analysis-input');
      if (ta) ta.focus();
    }
  });
})();