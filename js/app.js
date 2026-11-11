// language: JavaScript, file: app.js
// Bootstrap. Version logged, global error handler, self-verification.

(function () {
  'use strict';

  const VERSION = '3.0.0';

  window.addEventListener('error', function (e) {
    const file = e.filename || '';
    if (file.indexOf('/js/') !== -1 || (e.message || '').indexOf('WordsAnalyser') !== -1) {
      console.error('[WordsAnalyser] JS error:', e.message, 'at', file + ':' + e.lineno);
    }
  });

  initTheme();

  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      const next = toggleTheme();
      toast(next === 'light' ? 'Light theme' : 'Dark theme', 'info', 1400);
    });
  }

  attachRipples();
  const toolsGrid = document.getElementById('tools-grid');
  if (toolsGrid && typeof MutationObserver !== 'undefined') {
    new MutationObserver(function () { attachRipples(toolsGrid); })
      .observe(toolsGrid, { childList: true, subtree: true });
  }

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

  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  if (window.Statistics) window.Statistics.renderRecent();

  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (window.Navigation) window.Navigation.activateTab('home');
      const ta = document.getElementById('analysis-input');
      if (ta) ta.focus();
    }
  });

  // ============================================================
  // Feedback Form AJAX Submission (No Redirect)
  // ============================================================
  const feedbackForm = document.getElementById('feedback-form');
  const submitBtn = document.getElementById('submit-btn');

  if (feedbackForm && submitBtn) {
    feedbackForm.addEventListener('submit', function (e) {
      e.preventDefault();
      
      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'Sending...';
      submitBtn.disabled = true;
      submitBtn.style.opacity = '0.7';

      const formData = new FormData(feedbackForm);

      fetch(feedbackForm.action, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json'
        }
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          toast('Feedback sent successfully!', 'success');
          feedbackForm.reset();
        } else {
          toast('Something went wrong. Please try again.', 'error');
        }
      })
      .catch(error => {
        console.error('Error submitting form:', error);
        toast('Failed to send. Check your connection.', 'error');
      })
      .finally(() => {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
      });
    });
  }

  console.log('[WordsAnalyser] ═════════════════════════════════');
  console.log('[WordsAnalyser]  v' + VERSION + ' booted');
})();