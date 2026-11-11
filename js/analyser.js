// language: JavaScript, file: analyzer.js
// Analysis engine + rendering + export. Runs on init so state is always valid.

(function () {
  // ---- Feature-detected regexes (older engines lack \p{L} and lookbehind)
  let WORD_RE, SPLIT_SENTENCES;
  try {
    WORD_RE = new RegExp("\\b[\\p{L}\\p{N}'’\\-]+\\b", 'gu');
    if (!'test'.match(WORD_RE)) throw new Error();
  } catch {
    WORD_RE = /\b[A-Za-z0-9'’\-]+\b/g;
  }
  try {
    SPLIT_SENTENCES = (t) => t.split(/(?<=[.!?])\s+/);
    if (SPLIT_SENTENCES('a. b').length !== 2) throw new Error();
  } catch {
    SPLIT_SENTENCES = (t) => t.split(/[.!?]+(?:\s+|$)/);
  }

  const input = document.getElementById('analysis-input');
  const statsGrid = document.getElementById('stats-grid');
  const freqTable = document.getElementById('freq-table');
  const pasteLive = document.getElementById('paste-live');
  const copyBtn = document.getElementById('analysis-copy');
  const resetBtn = document.getElementById('analysis-reset');
  const downloadToggle = document.getElementById('download-toggle');
  const downloadDropdown = document.getElementById('download-dropdown');

  const STOP_WORDS = new Set((
    'a an the and or but if of to in on at by for with from as is are was were be been being ' +
    'this that these those it its i you he she we they them his her their our your my ' +
    'have has had do does did not no nor so than too very can will would should could may might must ' +
    'about over under into onto out up down off then once also just only'
  ).split(' '));

  let lastMetrics = null;

  function analyze(text) {
    const raw = String(text ?? '');
    const trimmed = raw.trim();
    const words = trimmed.length ? (trimmed.match(WORD_RE) || []) : [];
    const chars = raw.length;
    const charsNoSpaces = raw.replace(/\s/g, '').length;

    const sentenceChunks = trimmed.length === 0
      ? []
      : SPLIT_SENTENCES(trimmed).filter(s => s.trim().length > 0);
    const sentences = trimmed.length === 0 ? 0 : Math.max(1, sentenceChunks.length);

    const paragraphs = trimmed.length === 0
      ? 0
      : trimmed.split(/\n\s*\n/).filter(p => p.trim().length > 0).length || 1;

    const wordCount = words.length;
    const avgWordLen = wordCount ? +(words.reduce((s, w) => s + w.length, 0) / wordCount).toFixed(2) : 0;
    const avgSentenceLen = sentences ? +(wordCount / sentences).toFixed(2) : 0;
    const readingTime = Math.round((wordCount / 200) * 60);
    const speakingTime = Math.round((wordCount / 130) * 60);

    const freq = {};
    for (const w of words) {
      const key = w.toLowerCase();
      freq[key] = (freq[key] || 0) + 1;
    }
    const uniqueWords = Object.keys(freq).length;

    const topWords = Object.entries(freq)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 20)
      .map(([word, count]) => ({
        word,
        count,
        percent: wordCount ? +(count / wordCount * 100).toFixed(2) : 0,
        stop: STOP_WORDS.has(word),
      }));

    let longest = '', shortest = '';
    for (const w of words) {
      const clean = w.replace(/[^\p{L}\p{N}]/gu, '') || w;
      if (!clean) continue;
      if (clean.length > (longest.length)) longest = w;
      if (!shortest || clean.length < shortest.replace(/[^\p{L}\p{N}]/gu, '').length) shortest = w;
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
      longestWord: longest || '—',
      shortestWord: shortest || '—',
      topWords,
      wordFrequency: freq,
    };
  }

  function run(text) {
    const m = analyze(text);
    lastMetrics = m;
    renderStats(m);
    renderFreq(m);
    renderPasteLive(m);
  }

  function renderStats(m) {
    const set = (key, val) => {
      const el = statsGrid.querySelector(`[data-stat="${key}"]`);
      if (el) el.textContent = val;
    };
    set('words', formatNumber(m.words));
    set('chars', formatNumber(m.chars));
    set('charsNoSpaces', formatNumber(m.charsNoSpaces));
    set('sentences', formatNumber(m.sentences));
    set('paragraphs', formatNumber(m.paragraphs));
    set('avgWordLen', m.avgWordLen);
    set('avgSentenceLen', m.avgSentenceLen);
    set('readingTime', formatDuration(m.readingTime));
    set('speakingTime', formatDuration(m.speakingTime));
    set('uniqueWords', formatNumber(m.uniqueWords));
    set('longestWord', m.longestWord);
    set('shortestWord', m.shortestWord);
  }

  function renderFreq(m) {
    if (!m.topWords.length) {
      freqTable.innerHTML = '<p class="empty-state">Upload a file or paste text to see word frequency.</p>';
      return;
    }
    freqTable.innerHTML = m.topWords.map((t, i) => `
      <div class="freq-row">
        <span class="freq-rank">#${i + 1}</span>
        <span class="freq-word">${escapeHTML(t.word)}</span>
        <span class="freq-count">${t.count}×</span>
        <span class="freq-pct">${t.percent}%</span>
      </div>
    `).join('');
  }

  function renderPasteLive(m) {
    if (!pasteLive) return;
    pasteLive.textContent = formatNumber(m.words) + ' words · ' + formatNumber(m.chars) + ' chars';
  }

  // ---- Report builders
  function metricsToText(m) {
    return [
      'WordsAnalyser Report',
      'Generated: ' + new Date().toLocaleString(),
      '',
      `Total Words: ${m.words}`,
      `Total Characters: ${m.chars}`,
      `Characters (no spaces): ${m.charsNoSpaces}`,
      `Sentences: ${m.sentences}`,
      `Paragraphs: ${m.paragraphs}`,
      `Average Word Length: ${m.avgWordLen}`,
      `Average Sentence Length: ${m.avgSentenceLen}`,
      `Reading Time: ${formatDuration(m.readingTime)}`,
      `Speaking Time: ${formatDuration(m.speakingTime)}`,
      `Unique Words: ${m.uniqueWords}`,
      `Longest Word: ${m.longestWord}`,
      `Shortest Word: ${m.shortestWord}`,
      '',
      'Top Words:',
      ...m.topWords.map((t, i) => `  ${i + 1}. ${t.word} — ${t.count}× (${t.percent}%)`),
    ].join('\n');
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
      ...m.topWords.map((t, i) => [i + 1, t.word, t.count, t.percent + '%']),
    ];
    return rows.map(r => r.map(c => {
      const s = String(c ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
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
      }
    }, null, 2);
  }

  function exportReport(format) {
    const m = lastMetrics;
    if (!m) { toast('Nothing to export yet', 'error'); return; }

    let content, filename, mime;
    if (format === 'txt') { content = metricsToText(m); filename = 'wordsanalyser-report.txt'; mime = 'text/plain'; }
    else if (format === 'csv') { content = metricsToCSV(m); filename = 'wordsanalyser-report.csv'; mime = 'text/csv'; }
    else if (format === 'json') { content = metricsToJSON(m); filename = 'wordsanalyser-report.json'; mime = 'application/json'; }
    else { toast('Unknown format', 'error'); return; }

    const ok = downloadBlob(content, filename, mime);
    toast(ok ? `Report downloaded as ${format.toUpperCase()}` : 'Download failed', ok ? 'success' : 'error');
  }

  // ---- Event wiring
  if (input) {
    input.addEventListener('input', debounce(() => run(input.value), 100));
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      if (!lastMetrics) return toast('Nothing to copy yet', 'error');
      const ok = await copyToClipboard(metricsToText(lastMetrics));
      toast(ok ? 'Results copied' : 'Copy failed', ok ? 'success' : 'error');
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (input) input.value = '';
      run('');
      toast('Analysis reset', 'info');
    });
  }

  if (downloadToggle && downloadDropdown) {
    downloadToggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const open = downloadDropdown.classList.toggle('open');
      downloadToggle.setAttribute('aria-expanded', String(open));
    });

    downloadDropdown.querySelectorAll('[data-export]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        exportReport(btn.dataset.export);
        downloadDropdown.classList.remove('open');
        downloadToggle.setAttribute('aria-expanded', 'false');
      });
    });

    document.addEventListener('click', (e) => {
      if (!downloadDropdown.contains(e.target)) {
        downloadDropdown.classList.remove('open');
        downloadToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // ---- Init: analyze empty string so lastMetrics is never null
  run(input ? input.value : '');

  window.Analyzer = {
    run,
    analyze,
    getLast: () => lastMetrics,
    exportReport,
    metricsToText,
    metricsToCSV,
    metricsToJSON,
  };
})();