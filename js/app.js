// language: JavaScript, file: app.js
// Bootstrap. Version logged, global error handler, hidden email AJAX submission.

(function () {
  'use strict';

  const VERSION = '3.2.0';

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
  // Obfuscated Email & Feedback Form AJAX Submission
  // ============================================================
  
  // Hidden email (ih5z@proton.me) encoded in Base64 to prevent scraping
  const _b64 = "aWg1ekBwcm90b24ubWU=";
  const hiddenEmail = atob(_b64);

  // Safely inject the email into the contact card
  const emailLink = document.getElementById('obfuscated-email-link');
  if (emailLink) {
    emailLink.textContent = hiddenEmail;
    emailLink.href = "mailto:" + hiddenEmail;
  }

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
      const endpoint = "https://formsubmit.co/ajax/" + hiddenEmail;

      fetch(endpoint, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json'
        }
      })
      .then(response => response.json())
      .then(data => {
        // FormSubmit returns success:"true" or success:"false"
        if (String(data.success) === 'true') {
          toast('Message sent! Check your inbox.', 'success');
          feedbackForm.reset();
        } else {
          // If it's the first time, it will require activation
          toast('Check your inbox/spam to activate the form!', 'info', 6000);
          console.warn('[WordsAnalyser] FormSubmit response:', data);
        }
      })
      .catch(error => {
        console.error('[WordsAnalyser] Form submission error:', error);
        toast('Failed to send. Check console for details.', 'error');
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