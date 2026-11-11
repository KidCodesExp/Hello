// language: JavaScript, file: analyzer.js
// Analysis engine + rendering + export

(function () {
  const input = $('#analysis-input');
  const statsGrid = $('#stats-grid');
  const freqTable = $('#freq-table');
  const copyBtn = $('#analysis-copy');
  const resetBtn = $('#analysis-reset');
  const downloadToggle = $('#download-toggle');
  const downloadDropdown = $('#download-dropdown');

  const STOP_WORDS = new Set(('a an the and or but if of to in on at by for with from as is are was were be been being ' +
    'this that these those it its i you he she we they them his her their our your my ' +
    'have has had do does did not no nor so than too very can will would should could may might must ' +
    'about over under into onto out up down off then once also just only').split(' '));

  let lastMetrics = null;

  function analyze(text) {
    const raw = String(text || '');
    const trimmed = raw.trim();
    const words = trimmed.match(/\b[\p{L}\p{N}'’\-]+\b/gu) || [];
    const chars = raw.length;
    const charsNoSpaces = raw.replace(/\s/g, '').length;

    // Sentences: split on .!? followed by space or end
    const sentenceChunks = trimmed.length === 0
      ? []
      : trimmed.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
    const sentences = trimmed.length === 0 ? 0 : Math.max(1, sentenceChunks.length);

    const paragraphs = trimmed.length === 0
      ? 0
      : trimmed.split(/\n\s*\n/).filter(p => p.trim().length > 0).length || 1;

    const wordCount = words.length;
    const avgWordLen = wordCount ? +(words.reduce((s, w) => s + w.length, 0) / wordCount).toFixed(2) : 0;
    const avgSentenceLen = sentences ? +(wordCount / sentences).toFixed(2) : 0;
    const readingTime = wordCount / 200 * 60;
    const speakingTime = wordCount / 130 * 60;

    // Frequency
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

    // Longest / shortest (letters only, non-trivial)
    let longest = '', shortest = '';
    for (const w of words) {
      const clean = w.replace(/[^\p{L}\p{N}]/gu, '');
      if (!clean) continue;
      if (clean.length > longest.length) longest = w;
      if (!shortest || clean.length < shortest.length) shortest = w;
    }

    return {
      words: wordCount,
      chars,
      charsNoSpaces,
      sentences,
      paragraphs,
      avgWordLen,
      avgSentenceLen,
      readingTime: Math.round(readingTime),
      speakingTime: Math.round(speakingTime),
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
        <span class="freq-word">${escapeHTML(t.word)}${t.stop ? '' : ''}</span>
        <span class="freq-count">${t.count}×</span>
        <span class="freq-pct">${t.percent}%</span>
      </div>
    `).join('');
  }

  // --- Export ---
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
    if (!lastMetrics) return toast('Nothing to export yet', 'error');
    if (format === 'txt') downloadBlob(metricsToText(lastMetrics), 'wordsanalyser-report.txt', 'text/plain');
    if (format === 'csv') downloadBlob(metricsToCSV(lastMetrics), 'wordsanalyser-report.csv', 'text/csv');
    if (format === 'json') downloadBlob(metricsToJSON(lastMetrics), 'wordsanalyser-report.json', 'application/json');
    toast(`Report downloaded as ${format.toUpperCase()}`, 'success');
  }

  // --- Event wiring ---
  input.addEventListener('input', debounce(() => run(input.value), 120));

  copyBtn.addEventListener('click', async () => {
    if (!lastMetrics) return toast('Nothing to copy yet', 'error');
    const ok = await copyToClipboard(metricsToText(lastMetrics));
    toast(ok ? 'Results copied' : 'Copy failed', ok ? 'success' : 'error');
  });

  resetBtn.addEventListener('click', () => {
    input.value = '';
    run('');
    toast('Analysis reset', 'info');
  });

  downloadToggle.addEventListener('click', e => {
    e.stopPropagation();
    const open = downloadDropdown.classList.toggle('open');
    downloadToggle.setAttribute('aria-expanded', String(open));
  });
  downloadDropdown.querySelectorAll('[data-export]').forEach(btn => {
    btn.addEventListener('click', () => {
      exportReport(btn.dataset.export);
      downloadDropdown.classList.remove('open');
    });
  });
  document.addEventListener('click', e => {
    if (!downloadDropdown.contains(e.target)) downloadDropdown.classList.remove('open');
  });

  window.Analyzer = {
    run,
    analyze,
    getLast: () => lastMetrics,
    exportReport,
  };
})();
