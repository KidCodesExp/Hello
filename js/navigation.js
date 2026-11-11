// language: JavaScript, file: navigation.js
// Tab switching, mobile menu, back-to-top

(function () {
  const panels = $$('.tab-panel');
  const navBtns = $$('.nav-btn');
  const footerBtns = $$('.footer-link');
  const menuToggle = $('#menu-toggle');
  const siteNav = $('.site-nav');

  function activateTab(tabName, scrollTop = true) {
    panels.forEach(p => p.classList.toggle('active', p.id === `tab-${tabName}`));
    navBtns.forEach(b => {
      const on = b.dataset.tab === tabName;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
    });
    if (siteNav.classList.contains('open')) {
      siteNav.classList.remove('open');
      menuToggle.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
    }
    if (scrollTop) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  navBtns.forEach(btn => btn.addEventListener('click', () => activateTab(btn.dataset.tab)));
  footerBtns.forEach(btn => btn.addEventListener('click', () => activateTab(btn.dataset.tab)));
  $$('[data-tab-link]').forEach(el => el.addEventListener('click', e => {
    e.preventDefault();
    activateTab(el.dataset.tabLink);
  }));

  // Quick tools from dashboard -> Features tab
  $$('.quick-card').forEach(card => {
    card.addEventListener('click', () => {
      activateTab('features');
      const tool = card.dataset.tool;
      const target = document.querySelector(`.tool-card[data-tool="${tool}"]`);
      if (target) {
        setTimeout(() => {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          target.style.borderColor = 'rgba(255,255,255,0.35)';
          setTimeout(() => { target.style.borderColor = ''; }, 1600);
        }, 350);
      }
    });
  });

  // Mobile menu
  menuToggle.addEventListener('click', () => {
    const open = siteNav.classList.toggle('open');
    menuToggle.classList.toggle('open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
  });

  // Back to top
  const btt = $('#back-to-top');
  if (btt) btt.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  // Keyboard: Esc closes dropdowns
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      $$('.dropdown.open').forEach(d => d.classList.remove('open'));
    }
  });

  window.Navigation = { activateTab };
})();
