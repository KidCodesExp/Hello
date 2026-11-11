// language: JavaScript, file: statistics.js
// Recently analysed list, dashboard stats

(function () {
  const recentList = $('#recent-list');
  const clearBtn = $('#clear-dashboard');

  function recordAnalysis(fileItem) {
    if (!window.Analyzer) return;
    const m = window.Analyzer.analyze(fileItem.text);
    window.AppState.analyses.unshift({
      id: fileItem.id,
      name: fileItem.name,
      timestamp: Date.now(),
      metrics: {
        words: m.words,
        chars: m.chars,
        sentences: m.sentences,
      },
    });
    // Cap session history
    if (window.AppState.analyses.length > 20) window.AppState.analyses.length = 20;
    renderRecent();
  }

  function renderRecent() {
    const list = window.AppState.analyses;
    if (list.length === 0) {
      recentList.innerHTML = '<p class="empty-state">No files analysed yet this session.</p>';
      return;
    }
    recentList.innerHTML = list.map(a => `
      <div class="recent-item">
        <span class="recent-name">${escapeHTML(a.name)}</span>
        <span class="recent-meta">${formatNumber(a.metrics.words)} words · ${formatNumber(a.metrics.chars)} chars</span>
      </div>
    `).join('');
  }

  clearBtn.addEventListener('click', () => {
    if (window.AppState.analyses.length === 0 && window.AppState.files.length === 0) {
      return toast('Dashboard already clear', 'info');
    }
    window.AppState.analyses = [];
    if (window.Uploader) window.Uploader.clearAll();
    renderRecent();
    toast('Dashboard cleared', 'success');
  });

  window.Statistics = { recordAnalysis, renderRecent };
})();
