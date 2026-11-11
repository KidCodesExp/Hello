// language: JavaScript, file: analyzer.js
// Analysis engine. No lookbehind literals. No \p{} literals.
// All Unicode-aware regexes come from window.WordHelpers (runtime-built)..

(function () {
  'use strict';

  const VERSION = '2.2.0';
  console.log('[WordsAnalyser] analyzer.js v' + VERSION + ' loading');

  if (!window.WordHelpers) {
    console.error('[WordsAnalyser] WordHelpers not loaded — utilities.js failed?');
    return;
  }

  const WH = window.WordHelpers;

  const STOP_WORDS = new Set((
    'a an the and or but if of to in on at by for with from as is are was were be been being ' +
    'this that these those it its i you he she we they them his her their our your my ' +
    'have has had do does did not no nor so than too very can will would should could may might must ' +
    'about over under into onto out up down off then once also just only'
  ).split(' '));

  // ============================================================
  // DOM refs — resolved at init, not at module load
  // ============================================================
  let input, statsGrid, freqTable, pasteLive, copyBtn, resetBtn,
      downloadToggle, downloadDropdown;

  function resolveDOM() {
    input           = document.getElementById('analysis-input');
    statsGrid       = document.getElementById('stats-grid');
    freqTable       = document.getElementById('freq-table');
    pasteLive       = document.getElementById('paste-live');
    copyBtn         = document.getElementById('analysis-copy');
    resetBtn        = document.getElementById('analysis-reset');
    downloadToggle  = document.getElementById('download-toggle');
    downloadDropdown = document.getElementById('download-dropdown');
    return !!(input && statsGrid && freqTable);
  }

  let lastMetrics = null;

  // ============================================================
  // Core analysis
  // ============================================================
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
    const avgWordLen = wordCount
      ? +(words.reduce((s, w) => s + w.length, 0) / wordCount).toFixed(2)
      : 0;
    const avgSentenceLen = sentences
      ? +(wordCount / sentences).toFixed(2)
      : 0;
    const readingTime = Math.round((wordCount / 200) * 60);
    const speakingTime = Math.round((wordCount / 130) * 60);

    // Frequency
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
        stop: STOP_WORDS.has(t.word),
      }));

    // Longest / shortest — track clean length separately to avoid a bug
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
      words: wordCount,
      chars,
      charsNoSpaces,
      sentences,
      paragraphs,
      avgWordLen,
      avgSentenceLen,
      readingTime,
      speakingTime,
      uniqueWords,
      longestWord: longestWord || '—',
      shortestWord: shortestWord || '—',
      topWords,
      wordFrequency: freq,
    };
  }

  // ============================================================
  // Rendering
  // ============================================================
  function setStat(key, val) {
    if (!statsGrid) return;
    const el = statsGrid.querySelector('[data-stat="' + key + '"]');
    if (el) el.textContent = val;
    // A missing element never breaks the entire update
  }

  function renderStats(m) {
    setStat('words',           formatNumber(m.words));
    setStat('chars',           formatNumber(m.chars));
    setStat('charsNoSpaces',   formatNumber(m.charsNoSpaces));
    setStat('sentences',       formatNumber(m.sentences));
    setStat('paragraphs',      formatNumber(m.paragraphs));
    setStat('avgWordLen',      String(m.avgWordLen));
    setStat('avgSentenceLen',  String(m.avgSentenceLen));
    setStat('readingTime',     formatDuration(m.readingTime));
    setStat('speakingTime',    formatDuration(m.speakingTime));
    setStat('uniqueWords',     formatNumber(m.uniqueWords));
    setStat('longestWord',     m.longestWord);
    setStat('shortestWord',    m.shortestWord);
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
      html += '<div class="freq-row">' +
        '<span class="freq-rank">#' + (i + 1) + '</span>' +
        '<span class="freq-word">' + escapeHTML(t.word) + '</span>' +
        '<span class="freq-count">' + t.count + '×</span>' +
        '<span class="freq-pct">' + t.percent + '%</span>' +
        '</div>';
    }
    freqTable.innerHTML = html;
  }

  function renderPasteLive(m) {
    if (!pasteLive) return;
    pasteLive.textContent = formatNumber(m.words) + ' words · ' + formatNumber(m.chars) + ' chars';
  }

  // ============================================================
  // Main entry
  // ============================================================
  function run(text) {
    try {
      const m = analyze(text);
      lastMetrics = m;
      renderStats(m);
      renderFreq(m);
      renderPasteLive(m);
      return m;
    } catch (err) {
      console.error('[WordsAnalyser] Analysis failed:', err);
      if (typeof toast === 'function') toast('Analysis error: ' + err.message, 'error', 5000);
      return null;
    }
  }

  // ============================================================
  // Report builders
  // ============================================================
  function metricsToText(m) {
    return [
      'WordsAnalyser Report',
      'Generated: ' + new Date().toLocaleString(),
      '',
      'Total Words: ' + m.words,
      'Total Characters: ' + m.chars,
      'Characters (no spaces): ' + m.charsNoSpaces,
      'Sentences: ' + m.sentences,
      'Paragraphs: ' + m.paragraphs,
      'Average Word Length: ' + m.avgWordLen,
      'Average Sentence Length: ' + m.avgSentenceLen,
      'Reading Time: ' + formatDuration(m.readingTime),
      'Speaking Time: ' + formatDuration(m.speakingTime),
      'Unique Words: ' + m.uniqueWords,
      'Longest Word: ' + m.longestWord,
      'Shortest Word: ' + m.shortestWord,
      '',
      'Top Words:',
    ].concat(m.topWords.map((t, i) => '  ' + (i + 1) + '. ' + t.word + ' — ' + t.count + '× (' + t.percent + '%)')).join('\n');
  }

  function metricsToCSV(m) {
    const rows = [
      ['Metric', 'Value'],
      ['Total Words', m.words],
      ['Total Characters', m.chars],
      ['Characters (no spaces)', m.charsNoSpaces],
      ['Sentences', m.sentences],
      ['Paragraphs', m.paragraphs],
      ['Average Word Length', m.avgWordLen],
      ['Average Sentence Length', m.avgSentenceLen],
      ['Reading Time (s)', m.readingTime],
      ['Speaking Time (s)', m.speakingTime],
      ['Unique Words', m.uniqueWords],
      ['Longest Word', m.longestWord],
      ['Shortest Word', m.shortestWord],
      [],
      ['Rank', 'Word', 'Count', 'Percent'],
    ].concat(m.topWords.map((t, i) => [i + 1, t.word, t.count, t.percent + '%']));

    return rows.map(r => r.map(c => {
      const s = String(c == null ? '' : c);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',')).join('\n');
  }

  function metricsToJSON(m) {
    return JSON.stringify({
      generatedAt: new Date().toISOString(),
      metrics: {
        words: m.words,
        chars: m.chars,
        charsNoSpaces: m.charsNoSpaces,
        sentences: m.sentences,
        paragraphs: m.paragraphs,
        avgWordLen: m.avgWordLen,
        avgSentenceLen: m.avgSentenceLen,
        readingTimeSeconds: m.readingTime,
        speakingTimeSeconds: m.speakingTime,
        uniqueWords: m.uniqueWords,
        longestWord: m.longestWord,
        shortestWord: m.shortestWord,
        topWords: m.topWords.map(t => ({ word: t.word, count: t.count, percent: t.percent })),
      },
    }, null, 2);
  }

  function exportReport(format) {
    const m = lastMetrics;
    if (!m) { toast('Nothing to export yet', 'error'); return; }
    let content, filename, mime;
    if (format === 'txt')       { content = metricsToText(m); filename = 'wordsanalyser-report.txt';  mime = 'text/plain'; }
    else if (format === 'csv')  { content = metricsToCSV(m);  filename = 'wordsanalyser-report.csv';  mime = 'text/csv'; }
    else if (format === 'json') { content = metricsToJSON(m); filename = 'wordsanalyser-report.json'; mime = 'application/json'; }
    else { toast('Unknown format', 'error'); return; }

    const ok = downloadBlob(content, filename, mime);
    toast(ok ? 'Report downloaded as ' + format.toUpperCase() : 'Download failed', ok ? 'success' : 'error');
  }

  // ============================================================
  // Handlers
  // ============================================================
  function handleCopy() {
    if (!lastMetrics) return toast('Nothing to copy yet', 'error');
    copyToClipboard(metricsToText(lastMetrics)).then(ok => {
      toast(ok ? 'Results copied' : 'Copy failed', ok ? 'success' : 'error');
    });
  }

  function handleReset() {
    if (input) input.value = '';
    run('');
    toast('Analysis reset', 'info');
  }

  function wireDownloadDropdown() {
    downloadToggle.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      const open = downloadDropdown.classList.toggle('open');
      downloadToggle.setAttribute('aria-expanded', String(open));
    });
    downloadDropdown.querySelectorAll('[data-export]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        exportReport(btn.dataset.export);
        downloadDropdown.classList.remove('open');
        downloadToggle.setAttribute('aria-expanded', 'false');
      });
    });
    document.addEventListener('click', function (e) {
      if (!downloadDropdown.contains(e.target)) {
        downloadDropdown.classList.remove('open');
        downloadToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // ============================================================
  // Self-test
  // ============================================================
  function selfTest() {
    const statCount = statsGrid ? statsGrid.querySelectorAll('[data-stat]').length : 0;
    const result = {
      version: VERSION,
      wordHelpers: !!window.WordHelpers,
      unicodeRegex: WH.unicodeSupported,
      input: !!input,
      statsGrid: !!statsGrid,
      statCount: statCount,
      freqTable: !!freqTable,
      pasteLive: !!pasteLive,
      copyBtn: !!copyBtn,
      resetBtn: !!resetBtn,
      downloadToggle: !!downloadToggle,
      downloadDropdown: !!downloadDropdown,
    };
    console.log('[WordsAnalyser] Self-test:', result);
    if (statCount !== 12) {
      console.warn('[WordsAnalyser] Expected 12 stat elements, found ' + statCount);
    }
    // Sanity check the analyzer with a known string
    const probe = analyze('Hello world. This is a test of WordsAnalyser.');
    if (probe.words !== 8 || probe.sentences !== 2) {
      console.warn('[WordsAnalyser] Sanity check failed:', probe);
    } else {
      console.log('[WordsAnalyser] Sanity check passed (8 words, 2 sentences)');
    }
    return result;
  }

  // ============================================================
  // Init
  // ============================================================
  let initialized = false;

  function init() {
    if (initialized) return;
    if (!resolveDOM()) {
      console.warn('[WordsAnalyser] DOM not ready, retrying...');
      setTimeout(init, 50);
      return;
    }
    initialized = true;
    console.log('[WordsAnalyser] Analyzer initialized');

    if (input) {
      input.addEventListener('input', debounce(function () { run(input.value); }, 100));
    }
    if (copyBtn) copyBtn.addEventListener('click', handleCopy);
    if (resetBtn) resetBtn.addEventListener('click', handleReset);
    if (downloadToggle && downloadDropdown) wireDownloadDropdown();

    run(input ? input.value : '');
    selfTest();
  }

  // ============================================================
  // Public API — assigned BEFORE init so uploader.js can always call it
  // ============================================================
  window.Analyzer = {
    run: run,
    analyze: analyze,
    getLast: function () { return lastMetrics; },
    exportReport: exportReport,
    metricsToText: metricsToText,
    metricsToCSV: metricsToCSV,
    metricsToJSON: metricsToJSON,
    selfTest: selfTest,
    version: VERSION,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log('[WordsAnalyser] analyzer.js v' + VERSION + ' loaded — API ready');
})();
