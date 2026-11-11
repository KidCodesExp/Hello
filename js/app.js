// language: JavaScript, file: app.js
// Bootstrap: loader animation, year, wiring

(function () {
  // Startup loader
  const loader = $('#startup-loader');
  const fill = $('#loader-fill');
  const pct = $('#loader-percent');
  let progress = 0;
  let finished = false;

  function finishLoading() {
    if (finished) return;
    finished = true;
    clearInterval(tick);
    fill.style.width = '100%';
    pct.textContent = '100%';
    setTimeout(() => {
      loader.classList.add('loader-out');
      document.body.classList.remove('no-scroll');
      setTimeout(() => loader.remove(), 700);
    }, 250);
  }

  document.body.classList.add('no-scroll');
  const tick = setInterval(() => {
    progress += Math.random() * 12 + 6;
    if (progress >= 95) progress = 95;
    fill.style.width = progress + '%';
    pct.textContent = Math.round(progress) + '%';
    if (progress >= 90) {
      // Small pause before final
      setTimeout(finishLoading, 300);
    }
  }, 140);

  window.addEventListener('load', () => {
    // Whatever's loaded, force finish
    setTimeout(finishLoading, 400);
  });

  // Year
  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Init empty analysis
  if (window.Analyzer) window.Analyzer.run('');
  if (window.Statistics) window.Statistics.renderRecent();

  // Keyboard shortcut: focus textarea on home with Cmd/Ctrl+K
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      if (window.Navigation) window.Navigation.activateTab('home');
      const ta = document.getElementById('analysis-input');
      if (ta) { ta.focus(); }
    }
  });
})();
