// language: JavaScript, file: js/analyzer.js
(function () {
  'use strict';

  if (!window.WordHelpers) return;
  const WH = window.WordHelpers;

  let input, statsGrid, freqTable, pasteLive, copyBtn, resetBtn, downloadToggle, downloadDropdown;
  let lastMetrics = null;

  function resolveDOM() {
    input = document.getElementById('analysis-input');
    statsGrid = document.getElementById('stats-grid');
    freqTable = document.getElementById('freq-table');
    pasteLive = document.getElementById('paste-live');
    copyBtn = document.getElementById('analysis-copy');
    resetBtn = document.getElementById('analysis-reset');
    downloadToggle = document.getElementById('download-toggle');
    downloadDropdown = document.getElementById('download-dropdown');
    return !!(input && statsGrid && freqTable);
  }

  function analyze(text) {
    const raw = String(text == null ? '' : text);
    const trimmed = raw.trim();
    const words = trimmed.length ? WH.extractWords(trimmed) : [];
    const chars = raw.length;
    const charsNoSpaces = raw.replace(/\s/g, '').length;
    
    let sentences = 0;
    if (trimmed.length > 0) {
      const chunks = WH.splitSentences(trimmed);
      sentences = chunks.length > 0 ? chunks.length : 1;
    }

    let paragraphs = 0;
    if (trimmed.length > 0) {
      const parts = trimmed.split(/\n\s*\n/).filter(p => p.trim().length > 0);
      paragraphs = Math.max(1, parts.length);
    }

    const wordCount = words.length;
    const avgWordLen = wordCount ? +(words.reduce((s, w) => s + w.length, 0) / wordCount).toFixed(2) : 0;
    const avgSentenceLen = sentences ? +(wordCount / sentences).toFixed(2) : 0;
    const readingTime = Math.round((wordCount / 200) * 60);
    const speakingTime = Math.round((wordCount / 130) * 60);

    const freq = Object.create(null);
    for (let i = 0; i < words.length; i++) {
      const key = words[i].toLowerCase();
      freq[key] = (freq[key] || 0) + 1;
    }
    const uniqueWords = Object.keys(freq).length;

    const topWords = Object.keys(freq)
      .map(k => ({ word: k, count: freq[k] }))
      .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
      .slice(0, 20)
      .map(t => ({
        word: t.word,
        count: t.count,
        percent: wordCount ? +(t.count / wordCount * 100).toFixed(2) : 0,
        stop: false
      }));

    let longestWord = '', longestLen = 0;
    let shortestWord = '', shortestLen = Infinity;
    for (let i = 0; i < words.length; i++) {
      const clean = WH.cleanWord(words[i]);
      if (!clean) continue;
      const len = clean.length;
      if (len > longestLen) { longestLen = len; longestWord = words[i]; }
      if (len < shortestLen) { shortestLen = len; shortestWord = words[i]; }
    }

    return {
      words: wordCount, chars, charsNoSpaces, sentences, paragraphs,
      avgWordLen, avgSentenceLen, readingTime, speakingTime, uniqueWords,
      longestWord: longestWord || '—', shortestWord: shortestWord || '—',
      topWords, wordFrequency: freq,
    };
  }

  function setStat(key, val) {
    if (!statsGrid) return;
    const el = statsGrid.querySelector('[data-stat="' + key + '"]');
    if (el) el.textContent = val;
  }

  function renderStats(m) {
    setStat('words', formatNumber(m.words));
    setStat('chars', formatNumber(m.chars));
    setStat('charsNoSpaces', formatNumber(m.charsNoSpaces));
    setStat('sentences', formatNumber(m.sentences));
    setStat('paragraphs', formatNumber(m.paragraphs));
    setStat('avgWordLen', String(m.avgWordLen));
    setStat('avgSentenceLen', String(m.avgSentenceLen));
    setStat('readingTime', formatDuration(m.readingTime));
    setStat('speakingTime', formatDuration(m.speakingTime));
    setStat('uniqueWords', formatNumber(m.uniqueWords));
    setStat('longestWord', m.longestWord);
    setStat('shortestWord', m.shortestWord);
  }

  function renderFreq(m) {
    if (!freqTable) return;
    if (!m.topWords.length) {
      freqTable.innerHTML = '<p class="empty-state">Upload a file or paste text to see word frequency.</p>';
      return;
    }
    let html = '';
    for (let i = 0; i < m.topWords.length; i++) {
      const t = m.topWords[i];
      html += '<div class="freq-row"><span class="freq-rank">#' + (i + 1) + '</span><span class="freq-word">' + escapeHTML(t.word) + '</span><span class="freq-count">' + t.count + '×</span><span class="freq-pct">' + t.percent + '%</span></div>';
    }
    freqTable.innerHTML = html;
  }

  function run(text) {
    try {
      const m = analyze(text);
      lastMetrics = m;
      renderStats(m);
      renderFreq(m);
      if (pasteLive) pasteLive.textContent = formatNumber(m.words) + ' words · ' + formatNumber(m.chars) + ' chars';
      return m;
    } catch (err) {
      console.error('[WordsAnalyser] Analysis failed:', err);
      return null;
    }
  }

  function exportReport(format) {
    const m = lastMetrics;
    if (!m) return toast('Nothing to export yet', 'error');
    let content, filename, mime;
    
    if (format === 'txt') {
      content = 'Words: ' + m.words + '\nChars: ' + m.chars + '\nSentences: ' + m.sentences;
      filename = 'wordsanalyser-report.txt'; mime = 'text/plain';
    } else if (format === 'csv') {
      content = 'Metric,Value\nWords,' + m.words + '\nChars,' + m.chars;
      filename = 'wordsanalyser-report.csv'; mime = 'text/csv';
    } else if (format === 'json') {
      content = JSON.stringify(m, null, 2);
      filename = 'wordsanalyser-report.json'; mime = 'application/json';
    }
    
    const ok = downloadBlob(content, filename, mime);
    toast(ok ? 'Report downloaded' : 'Download failed', ok ? 'success' : 'error');
  }

  function init() {
    if (!resolveDOM()) { setTimeout(init, 50); return; }

    if (input) input.addEventListener('input', debounce(() => run(input.value), 100));
    
    if (copyBtn) copyBtn.addEventListener('click', () => {
      if (!lastMetrics) return;
      copyToClipboard(JSON.stringify(lastMetrics, null, 2)).then(ok => toast(ok ? 'Copied' : 'Failed', ok ? 'success' : 'error'));
    });

    if (resetBtn) resetBtn.addEventListener('click', () => { if(input) input.value = ''; run(''); });

    if (downloadToggle && downloadDropdown) {
      downloadToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        downloadDropdown.classList.toggle('open');
      });
      downloadDropdown.querySelectorAll('[data-export]').forEach(btn => {
        btn.addEventListener('click', () => { exportReport(btn.dataset.export); downloadDropdown.classList.remove('open'); });
      });
      document.addEventListener('click', () => downloadDropdown.classList.remove('open'));
    }

    run(input ? input.value : '');
    console.log('[WordsAnalyser] Analyzer API ready');
  }

  window.Analyzer = { run, analyze, getLast: () => lastMetrics };
  
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
