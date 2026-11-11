// language: JavaScript, file: tools.js
// All 14 text utilities. Word extraction goes through WordHelpers — no
// \p{} literals anywhere in this file.

(function () {
  'use strict';

  const grid = document.getElementById('tools-grid');
  if (!grid) return;
  if (!window.WordHelpers) {
    console.error('[WordsAnalyser] tools.js: WordHelpers not loaded');
    return;
  }

  const WH = window.WordHelpers;
  const wordsOf = function (t) { return WH.extractWords(t.toLowerCase()); };

  const getCard = el => el.closest('.tool-card');
  const getInput = card => card.querySelector('.tool-input:not([data-field])') || card.querySelector('.tool-input');
  const getOutput = card => card.querySelector('.tool-output');
  const setOutput = (card, text) => {
    const out = getOutput(card);
    if (!out) return;
    out.textContent = text;
    out.dataset.empty = 'false';
  };

  // ============================================================
  // Live inputs
  // ============================================================
  function bindLiveInputs() {
    const counterCard = grid.querySelector('[data-tool="counter"]');
    if (counterCard && window.Analyzer) {
      const ta = counterCard.querySelector('.tool-input');
      const words = counterCard.querySelector('[data-mini="counter-words"]');
      const chars = counterCard.querySelector('[data-mini="counter-chars"]');
      const sentences = counterCard.querySelector('[data-mini="counter-sentences"]');
      const paragraphs = counterCard.querySelector('[data-mini="counter-paragraphs"]');
      const update = function () {
        const m = window.Analyzer.analyze(ta.value);
        words.textContent = formatNumber(m.words);
        chars.textContent = formatNumber(m.chars);
        sentences.textContent = formatNumber(m.sentences);
        paragraphs.textContent = formatNumber(m.paragraphs);
      };
      ta.addEventListener('input', debounce(update, 100));
      update();
    }

    const readingCard = grid.querySelector('[data-tool="reading"]');
    if (readingCard && window.Analyzer) {
      const ta = readingCard.querySelector('.tool-input');
      const read = readingCard.querySelector('[data-mini="reading-read"]');
      const speak = readingCard.querySelector('[data-mini="reading-speak"]');
      const words = readingCard.querySelector('[data-mini="reading-words"]');
      const update = function () {
        const m = window.Analyzer.analyze(ta.value);
        read.textContent = formatDuration(m.readingTime);
        speak.textContent = formatDuration(m.speakingTime);
        words.textContent = formatNumber(m.words);
      };
      ta.addEventListener('input', debounce(update, 100));
      update();
    }
  }

  // ============================================================
  // Tool runners
  // ============================================================
  const runners = {
    case(card, action) {
      const input = getInput(card).value;
      let out = '';
      if (action === 'upper') out = input.toUpperCase();
      if (action === 'lower') out = input.toLowerCase();
      if (action === 'title') out = input.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
      if (action === 'sentence') out = input.toLowerCase().replace(/(^\s*\w|[.!?]\s*\w)/g, c => c.toUpperCase());
      setOutput(card, out || '(empty)');
    },
    spaces(card) {
      const out = getInput(card).value
        .split('\n')
        .map(line => line.replace(/[ \t]+/g, ' ').trim())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n');
      setOutput(card, out || '(empty)');
    },
    duplines(card) {
      const seen = new Set();
      const out = getInput(card).value.split('\n').filter(l => {
        const key = l.trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).join('\n');
      setOutput(card, out || '(empty)');
    },
    reverse(card, action) {
      const input = getInput(card).value;
      let out = '';
      if (action === 'chars') out = input.split('').reverse().join('');
      if (action === 'words') out = input.split(/\s+/).reverse().join(' ');
      if (action === 'lines') out = input.split('\n').reverse().join('\n');
      setOutput(card, out || '(empty)');
    },
    findreplace(card) {
      const input = getInput(card).value;
      const find = card.querySelector('[data-field="find"]').value;
      const replace = card.querySelector('[data-field="replace"]').value;
      const useRegex = card.querySelector('[data-field="regex"]').checked;
      if (!find) return setOutput(card, '(enter text to find)');
      let out;
      try {
        out = useRegex ? input.replace(new RegExp(find, 'g'), replace) : input.split(find).join(replace);
      } catch (err) {
        return setOutput(card, 'Regex error: ' + err.message);
      }
      setOutput(card, out || '(empty)');
    },
    sort(card) {
      const input = getInput(card).value;
      const mode = card.querySelector('[data-field="mode"]').value;
      let lines = input.split('\n').filter(l => l.trim().length > 0);
      if (mode === 'asc') lines.sort((a, b) => a.localeCompare(b));
      if (mode === 'desc') lines.sort((a, b) => b.localeCompare(a));
      if (mode === 'len-asc') lines.sort((a, b) => a.length - b.length);
      if (mode === 'len-desc') lines.sort((a, b) => b.length - a.length);
      if (mode === 'num') lines.sort((a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0));
      setOutput(card, lines.join('\n') || '(empty)');
    },
    clean(card) {
      let out = getInput(card).value;
      const f = k => card.querySelector('[data-field="' + k + '"]').checked;
      if (f('html')) out = out.replace(/<[^>]*>/g, '');
      if (f('urls')) out = out.replace(/https?:\/\/\S+/g, '');
      if (f('emails')) out = out.replace(/[\w.+-]+@[\w.-]+\.\w+/g, '');
      if (f('numbers')) out = out.replace(/\d+/g, '');
      if (f('special')) {
        // Build special-char stripper safely — no \p{} literal
        try {
          const re = new RegExp('[^\\p{L}\\p{N}\\s.,!?;:\'"()\\-]', 'gu');
          out = out.replace(re, '');
        } catch {
          out = out.replace(/[^A-Za-z0-9\s.,!?;:'"()\-]/g, '');
        }
      }
      if (f('ws')) out = out.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
      setOutput(card, out || '(empty)');
    },
    compare(card) {
      const a = card.querySelector('[data-field="a"]').value;
      const b = card.querySelector('[data-field="b"]').value;
      const setA = new Set(wordsOf(a));
      const setB = new Set(wordsOf(b));
      const onlyA = [...setA].filter(w => !setB.has(w)).sort();
      const onlyB = [...setB].filter(w => !setA.has(w)).sort();
      const both = [...setA].filter(w => setB.has(w)).sort();
      setOutput(card, [
        'Only in A (' + onlyA.length + '): ' + (onlyA.slice(0, 30).join(', ') || '—'),
        '',
        'Only in B (' + onlyB.length + '): ' + (onlyB.slice(0, 30).join(', ') || '—'),
        '',
        'In both (' + both.length + '): ' + (both.slice(0, 30).join(', ') || '—'),
      ].join('\n'));
    },
    dupwords(card) {
      const words = wordsOf(getInput(card).value);
      const freq = {};
      words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
      const dups = Object.entries(freq).filter(e => e[1] > 1).sort((a, b) => b[1] - a[1]);
      if (!dups.length) return setOutput(card, 'No duplicate words found.');
      setOutput(card, dups.map(e => e[0] + ' — ' + e[1] + '×').join('\n'));
    },
    density(card) {
      const text = getInput(card).value;
      const keyword = (card.querySelector('[data-field="keyword"]').value || '').trim().toLowerCase();
      if (!keyword) return setOutput(card, '(enter a keyword)');
      const words = wordsOf(text);
      if (!words.length) return setOutput(card, 'No words to analyse.');
      const hits = words.filter(w => w === keyword).length;
      const density = (hits / words.length * 100).toFixed(2);
      setOutput(card,
        'Keyword: ' + keyword + '\n' +
        'Occurrences: ' + hits + '\n' +
        'Total words: ' + words.length + '\n' +
        'Density: ' + density + '%'
      );
    },
    mostused(card) {
      const words = wordsOf(getInput(card).value);
      if (!words.length) return setOutput(card, '(empty)');
      const freq = {};
      words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
      const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 20);
      setOutput(card, sorted.map((e, i) => (i + 1) + '. ' + e[0] + ' — ' + e[1] + '×').join('\n'));
    },
    statistics(card) {
      if (!window.Analyzer) return setOutput(card, 'Analyzer not ready.');
      const m = window.Analyzer.analyze(getInput(card).value);
      setOutput(card, [
        'Words: ' + formatNumber(m.words),
        'Characters: ' + formatNumber(m.chars),
        'Characters (no spaces): ' + formatNumber(m.charsNoSpaces),
        'Sentences: ' + formatNumber(m.sentences),
        'Paragraphs: ' + formatNumber(m.paragraphs),
        'Avg word length: ' + m.avgWordLen,
        'Avg sentence length: ' + m.avgSentenceLen,
        'Reading time: ' + formatDuration(m.readingTime),
        'Speaking time: ' + formatDuration(m.speakingTime),
        'Unique words: ' + formatNumber(m.uniqueWords),
        'Longest word: ' + m.longestWord,
        'Shortest word: ' + m.shortestWord,
      ].join('\n'));
    },
  };

  grid.addEventListener('click', function (e) {
    const runBtn = e.target.closest('.tool-run');
    if (runBtn) {
      const card = getCard(runBtn);
      const tool = card.dataset.tool;
      const action = runBtn.dataset.action;
      if (runners[tool]) {
        try { runners[tool](card, action); }
        catch (err) { setOutput(card, 'Error: ' + err.message); }
      }
      return;
    }
    const copyBtn = e.target.closest('.tool-copy');
    if (copyBtn) {
      const card = getCard(copyBtn);
      const out = getOutput(card);
      if (!out || out.dataset.empty === 'true') return toast('Nothing to copy', 'error');
      copyToClipboard(out.textContent).then(ok => {
        toast(ok ? 'Copied' : 'Copy failed', ok ? 'success' : 'error');
      });
    }
  });

  bindLiveInputs();
  console.log('[WordsAnalyser] tools.js loaded — 14 tools wired');
  window.Tools = { runners };
})();