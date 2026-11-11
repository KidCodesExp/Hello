// language: JavaScript, file: js/tools.js
(function () {
  'use strict';

  const panelsContainer = document.getElementById('tool-panels');
  if (!panelsContainer) return;
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
  // Inject Upload Button into every tool
  // ============================================================
  function injectUploadButtons() {
    const cards = panelsContainer.querySelectorAll('.tool-card');
    cards.forEach(card => {
      if (card.querySelector('.tool-upload-wrap')) return;
      
      const uploadWrap = document.createElement('div');
      uploadWrap.className = 'tool-upload-wrap';
      uploadWrap.innerHTML = `
        <label class="btn btn-ghost btn-sm" style="cursor:pointer;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 16V4m0 0L7 9m5-5 5 5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Upload file
          <input type="file" hidden accept=".txt,.md,.csv,.json,.xml,.html,.css,.js,.rtf,.log,.pdf,.docx">
        </label>
      `;
      
      const firstInput = card.querySelector('.tool-input, .field-row');
      if (firstInput) {
        firstInput.parentNode.insertBefore(uploadWrap, firstInput);
      } else {
        card.appendChild(uploadWrap);
      }
      
      const fileInput = uploadWrap.querySelector('input');
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          let text = '';
          if (file.name.endsWith('.pdf')) {
            if (window.pdfjsLib) {
               pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
               const buf = await file.arrayBuffer();
               const pdf = await pdfjsLib.getDocument({data: buf}).promise;
               for (let i=1; i<=pdf.numPages; i++) {
                 const page = await pdf.getPage(i);
                 const content = await page.getTextContent();
                 text += content.items.map(it => it.str).join(' ') + '\n';
               }
            } else throw new Error('PDF parser not loaded');
          } else if (file.name.endsWith('.docx')) {
             if (window.mammoth) {
               const buf = await file.arrayBuffer();
               const res = await mammoth.extractRawText({arrayBuffer: buf});
               text = res.value;
             } else throw new Error('DOCX parser not loaded');
          } else {
            text = await new Promise((res, rej) => {
              const reader = new FileReader();
              reader.onload = () => res(reader.result);
              reader.onerror = rej;
              reader.readAsText(file);
            });
          }
          
          const ta = card.querySelector('.tool-input:not([data-field])') || card.querySelector('.tool-input');
          if (ta) {
            ta.value = text;
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            toast('File loaded into tool', 'success');
          } else {
            const fieldA = card.querySelector('[data-field="a"]');
            if (fieldA) {
              fieldA.value = text;
              toast('File loaded into Text A', 'success');
            }
          }
        } catch(err) {
          toast('Failed to read file: ' + err.message, 'error');
        }
        fileInput.value = '';
      });
    });
  }

  // ============================================================
  // Modal Logic
  // ============================================================
  const modal = document.getElementById('tool-modal');
  const modalBody = document.getElementById('tool-modal-body');
  const modalTitle = document.getElementById('tool-modal-title');
  const modalClose = document.getElementById('tool-modal-close');
  const modalBackdrop = document.getElementById('tool-modal-backdrop');
  let activeCard = null;

  function openTool(toolId, title) {
    const card = panelsContainer.querySelector(`.tool-card[data-tool="${toolId}"]`);
    if (!card) return;
    
    if (activeCard) {
      panelsContainer.appendChild(activeCard); // return old card
    }
    
    activeCard = card;
    modalBody.appendChild(card);
    card.style.display = 'flex';
    
    modalTitle.textContent = title;
    modal.classList.add('open');
    document.body.classList.add('no-scroll');
  }

  function closeModal() {
    if (activeCard) {
      panelsContainer.appendChild(activeCard);
      activeCard = null;
    }
    modal.classList.remove('open');
    document.body.classList.remove('no-scroll');
  }

  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (modalBackdrop) modalBackdrop.addEventListener('click', closeModal);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
  });

  document.querySelectorAll('.launcher-card').forEach(btn => {
    btn.addEventListener('click', () => {
      const toolId = btn.dataset.tool;
      const title = btn.querySelector('.launcher-title').textContent;
      openTool(toolId, title);
    });
  });

  // ============================================================
  // Live inputs
  // ============================================================
  function bindLiveInputs() {
    const counterCard = panelsContainer.querySelector('[data-tool="counter"]');
    if (counterCard && window.Analyzer) {
      const ta = counterCard.querySelector('.tool-input');
      const words = counterCard.querySelector('[data-mini="counter-words"]');
      const chars = counterCard.querySelector('[data-mini="counter-chars"]');
      const sentences = counterCard.querySelector('[data-mini="counter-sentences"]');
      const paragraphs = counterCard.querySelector('[data-mini="counter-paragraphs"]');
      
      const update = function () {
        const m = window.Analyzer.analyze(ta.value);
        if (words) words.textContent = formatNumber(m.words);
        if (chars) chars.textContent = formatNumber(m.chars);
        if (sentences) sentences.textContent = formatNumber(m.sentences);
        if (paragraphs) paragraphs.textContent = formatNumber(m.paragraphs);
      };
      ta.addEventListener('input', debounce(update, 100));
      update();
    }

    const readingCard = panelsContainer.querySelector('[data-tool="reading"]');
    if (readingCard && window.Analyzer) {
      const ta = readingCard.querySelector('.tool-input');
      const read = readingCard.querySelector('[data-mini="reading-read"]');
      const speak = readingCard.querySelector('[data-mini="reading-speak"]');
      const words = readingCard.querySelector('[data-mini="reading-words"]');
      
      const update = function () {
        const m = window.Analyzer.analyze(ta.value);
        if (read) read.textContent = formatDuration(m.readingTime);
        if (speak) speak.textContent = formatDuration(m.speakingTime);
        if (words) words.textContent = formatNumber(m.words);
      };
      ta.addEventListener('input', debounce(update, 100));
      update();
    }
  }

  // ============================================================
  // Runners
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
      const out = getInput(card).value.split('\n').map(line => line.replace(/[ \t]+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n');
      setOutput(card, out || '(empty)');
    },
    duplines(card) {
      const seen = new Set();
      const out = getInput(card).value.split('\n').filter(l => {
        const key = l.trim();
        if (seen.has(key)) return false;
        seen.add(key); return true;
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
      const matchCase = card.querySelector('[data-field="matchcase"]').checked;
      const wholeWord = card.querySelector('[data-field="wholeword"]').checked;
      const useRegex = card.querySelector('[data-field="regex"]').checked;

      if (!find) return setOutput(card, '(enter text to find)');
      let out;
      try {
        if (useRegex) {
          out = input.replace(new RegExp(find, matchCase ? 'g' : 'gi'), replace);
        } else {
          let escaped = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          let pattern = wholeWord ? '\\b' + escaped + '\\b' : escaped;
          out = input.replace(new RegExp(pattern, matchCase ? 'g' : 'gi'), replace);
        }
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
        try { out = out.replace(new RegExp('[^\\p{L}\\p{N}\\s.,!?;:\'"()\\-]', 'gu'), ''); }
        catch { out = out.replace(/[^A-Za-z0-9\s.,!?;:'"()\-]/g, ''); }
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
        '', 'Only in B (' + onlyB.length + '): ' + (onlyB.slice(0, 30).join(', ') || '—'),
        '', 'In both (' + both.length + '): ' + (both.slice(0, 30).join(', ') || '—'),
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
      setOutput(card, 'Keyword: ' + keyword + '\nOccurrences: ' + hits + '\nTotal words: ' + words.length + '\nDensity: ' + (hits / words.length * 100).toFixed(2) + '%');
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
      setOutput(card, ['Words: ' + formatNumber(m.words), 'Characters: ' + formatNumber(m.chars), 'Sentences: ' + formatNumber(m.sentences), 'Paragraphs: ' + formatNumber(m.paragraphs), 'Avg word length: ' + m.avgWordLen, 'Reading time: ' + formatDuration(m.readingTime)].join('\n'));
    },
  };

  // Document-level click delegation (works inside modal)
  document.addEventListener('click', function (e) {
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

  injectUploadButtons();
  bindLiveInputs();
  console.log('[WordsAnalyser] tools.js loaded — 14 tools wired with modals & uploads');
  window.Tools = { runners };
})();