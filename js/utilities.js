// language: JavaScript, file: uploader.js
// Hardened file reader. Verbose logging, FileReader fallback, no re-entrant click.

(function () {
  'use strict';

  const LOG = '[WordsAnalyser/uploader]';
  console.log(LOG, 'loading');

  const SUPPORTED_TEXT = ['txt', 'md', 'csv', 'json', 'xml', 'html', 'htm', 'css', 'js', 'rtf', 'log'];
  const SUPPORTED = new Set(SUPPORTED_TEXT.concat(['pdf', 'docx', 'doc']));
  const MAX_BYTES = 100 * 1024 * 1024;

  // ---- DOM (resolved with defensive fallbacks; some may be null on odd builds)
  const zone           = document.getElementById('upload-zone');
  const input          = document.getElementById('file-input');
  const fileList       = document.getElementById('file-list');
  const clearBtn       = document.getElementById('clear-files');
  const progressWrap   = document.getElementById('upload-progress-wrap');
  const progressFill   = document.getElementById('upload-progress-fill');
  const progressLabel  = document.getElementById('upload-progress-label');

  if (!zone || !input) {
    console.error(LOG, 'FATAL — upload zone or file input missing from DOM');
    return;
  }

  let nextId = 1;
  let uploading = false;

  // ---- Utility: get textarea fresh each time (never stale)
  function getAnalysisInput() {
    return document.getElementById('analysis-input');
  }

  // ---- Public API
  function getFiles() { return window.AppState.files.slice(); }

  function clearAll() {
    if (window.AppState.files.length === 0) return;
    window.AppState.files = [];
    renderFileList();
    const ta = getAnalysisInput();
    if (ta) ta.value = '';
    if (window.Analyzer) window.Analyzer.run('');
    toast('All files cleared', 'info');
    console.log(LOG, 'cleared all');
  }

  function removeFile(id) {
    const idx = window.AppState.files.findIndex(function (f) { return f.id === id; });
    if (idx === -1) return;
    window.AppState.files.splice(idx, 1);
    renderFileList();
  }

  // ============================================================
  // Zone click — non-recursive
  // ============================================================
  zone.addEventListener('click', function (e) {
    // Guard: ignore synthetic clicks from inside the zone itself (input bubbles here)
    if (e.target === input) return;
    e.preventDefault();
    e.stopPropagation();
    input.click();
  });

  zone.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      input.click();
    }
  });

  // ---- Drag & drop
  ['dragenter', 'dragover'].forEach(function (ev) {
    zone.addEventListener(ev, function (e) {
      e.preventDefault(); e.stopPropagation();
      zone.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    zone.addEventListener(ev, function (e) {
      e.preventDefault(); e.stopPropagation();
      if (ev === 'dragleave' && e.target !== zone) return;
      zone.classList.remove('dragover');
    });
  });
  zone.addEventListener('drop', function (e) {
    const files = Array.from(e.dataTransfer.files || []);
    console.log(LOG, 'drop:', files.length, 'file(s)');
    if (files.length) handleFiles(files);
  });

  // ---- File picker
  input.addEventListener('change', function (e) {
    const files = Array.from(e.target.files || []);
    console.log(LOG, 'picker:', files.length, 'file(s)');
    if (files.length) handleFiles(files);
    input.value = '';
  });

  if (clearBtn) clearBtn.addEventListener('click', clearAll);

  if (fileList) {
    fileList.addEventListener('click', function (e) {
      const btn = e.target.closest('.file-remove');
      if (btn) removeFile(Number(btn.dataset.id));
    });
  }

  // ============================================================
  // Reading
  // ============================================================
  function extOf(name) {
    const parts = name.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
  }

  // File.text() fallback via FileReader — safe on every engine
  function readAsText(file) {
    return new Promise(function (resolve, reject) {
      if (typeof file.text === 'function') {
        Promise.resolve(file.text()).then(resolve, function () { fallback(); });
        return;
      }
      fallback();
      function fallback() {
        try {
          const reader = new FileReader();
          reader.onload = function () { resolve(String(reader.result || '')); };
          reader.onerror = function () { reject(reader.error || new Error('FileReader failed')); };
          reader.readAsText(file);
        } catch (err) {
          reject(err);
        }
      }
    });
  }

  async function readFile(file, ext) {
    if (SUPPORTED_TEXT.indexOf(ext) !== -1) return readAsText(file);
    if (ext === 'pdf') return readPDF(file);
    if (ext === 'docx') return readDOCX(file);
    if (ext === 'doc') throw new Error('Legacy .doc unsupported — save as .docx first');
    throw new Error('Unsupported type: .' + ext);
  }

  async function readPDF(file) {
    if (typeof pdfjsLib === 'undefined') throw new Error('PDF parser failed to load');
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(function (it) { return it.str; }).join(' ') + '\n\n';
    }
    return text;
  }

  async function readDOCX(file) {
    if (typeof mammoth === 'undefined') throw new Error('DOCX parser failed to load');
    const buffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return result.value;
  }

  // ============================================================
  // Core pipeline
  // ============================================================
  async function handleFiles(files) {
    if (uploading) {
      toast('Please wait for the current batch', 'info');
      return;
    }
    uploading = true;

    if (progressWrap) progressWrap.hidden = false;
    if (progressFill) progressFill.style.width = '0%';
    if (progressLabel) progressLabel.textContent = '0%';

    const total = files.length;
    let done = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = extOf(file.name);
      console.log(LOG, 'processing', file.name, '| ext=' + ext, '| size=' + file.size);

      if (!SUPPORTED.has(ext)) {
        toast('Unsupported: .' + ext, 'error');
        done++;
        updateOverallProgress(done, total);
        continue;
      }
      if (file.size > MAX_BYTES) {
        toast(file.name + ': too large (max 100 MB)', 'error');
        done++;
        updateOverallProgress(done, total);
        continue;
      }

      const item = {
        id: nextId++,
        name: file.name,
        size: file.size,
        ext: ext,
        text: '',
        status: 'reading'
      };
      window.AppState.files.push(item);
      renderFileList();

      let text = '';
      try {
        text = await readFile(file, ext);
        console.log(LOG, 'read OK:', file.name, '| chars=' + (text ? text.length : 0));
      } catch (err) {
        item.status = 'error';
        item.text = '';
        renderFileList();
        toast(file.name + ': ' + (err.message || 'read failed'), 'error');
        console.error(LOG, 'read failed:', file.name, err);
        done++;
        updateOverallProgress(done, total);
        continue;
      }

      item.text = text;
      item.status = 'success';
      renderFileList();

      if (!text || !text.trim().length) {
        toast(file.name + ': file is empty', 'info');
        done++;
        updateOverallProgress(done, total);
        continue;
      }

      // ---- Feed the analyzer
      const ta = getAnalysisInput();
      if (!ta) {
        console.error(LOG, 'analysis textarea not found in DOM');
        toast('Analysis area missing', 'error');
        done++;
        updateOverallProgress(done, total);
        continue;
      }

      const combined = ta.value.trim().length > 0
        ? ta.value + '\n\n' + text
        : text;
      ta.value = combined;

      // Primary: direct call
      if (window.Analyzer && typeof window.Analyzer.run === 'function') {
        try {
          const result = window.Analyzer.run(combined);
          console.log(LOG, 'analyzer ran | words=' + (result ? result.words : 'null'));
        } catch (err) {
          console.error(LOG, 'analyzer.run threw:', err);
        }
      } else {
        console.warn(LOG, 'window.Analyzer not available — analysis skipped');
        toast('Analyzer not loaded', 'error');
      }

      // Backup: fire input event so any listener catches it
      try {
        ta.dispatchEvent(new Event('input', { bubbles: true }));
      } catch (err) {
        console.error(LOG, 'dispatchEvent failed:', err);
      }

      // ---- Session history
      if (window.Statistics && typeof window.Statistics.recordAnalysis === 'function') {
        try { window.Statistics.recordAnalysis(item); }
        catch (err) { console.error(LOG, 'recordAnalysis failed:', err); }
      }

      toast(file.name + ' loaded', 'success');
      done++;
      updateOverallProgress(done, total);
    }

    uploading = false;
    setTimeout(function () {
      if (progressWrap) progressWrap.hidden = true;
    }, 800);
  }

  function updateOverallProgress(done, total) {
    const pct = Math.round((done / total) * 100);
    if (progressFill) progressFill.style.width = pct + '%';
    if (progressLabel) progressLabel.textContent = pct + '%';
  }

  // ============================================================
  // Render
  // ============================================================
  function renderFileList() {
    if (!fileList) return;
    const files = window.AppState.files;
    if (files.length === 0) {
      fileList.innerHTML = '';
      if (clearBtn) clearBtn.hidden = true;
      return;
    }
    if (clearBtn) clearBtn.hidden = false;
    fileList.innerHTML = files.map(function (f) {
      const statusClass = f.status === 'success' ? 'success' : f.status === 'error' ? 'error' : '';
      const statusText = f.status === 'reading' ? 'Reading…' : f.status === 'success' ? 'Ready' : 'Error';
      return '<div class="file-item">' +
        '<span class="file-ext">' + escapeHTML(f.ext || '?') + '</span>' +
        '<div class="file-meta">' +
          '<div class="file-name">' + escapeHTML(f.name) + '</div>' +
          '<div class="file-size">' + formatBytes(f.size) + '</div>' +
        '</div>' +
        '<span class="file-status ' + statusClass + '">' + statusText + '</span>' +
        '<button class="file-remove" data-id="' + f.id + '" aria-label="Remove">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18" stroke-linecap="round"/></svg>' +
        '</button>' +
      '</div>';
    }).join('');
  }

  window.Uploader = { getFiles: getFiles, clearAll: clearAll, removeFile: removeFile };
  console.log(LOG, 'ready — 12 extensions supported');
})();