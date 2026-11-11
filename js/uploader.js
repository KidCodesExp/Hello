// language: JavaScript, file: uploader.js
// File reading, validation, PDF/DOCX parsing

(function () {
  const SUPPORTED_TEXT = ['txt', 'md', 'csv', 'json', 'xml', 'html', 'htm', 'css', 'js', 'rtf', 'log'];
  const SUPPORTED = new Set([...SUPPORTED_TEXT, 'pdf', 'docx', 'doc']);
  const MAX_BYTES = 100 * 1024 * 1024; // 100 MB

  const zone = $('#upload-zone');
  const input = $('#file-input');
  const fileList = $('#file-list');
  const clearBtn = $('#clear-files');
  const progressWrap = $('#upload-progress-wrap');
  const progressFill = $('#upload-progress-fill');
  const progressLabel = $('#upload-progress-label');
  const analysisInput = $('#analysis-input');

  let nextId = 1;
  let uploading = false;

  // --- Public API ---
  function getFiles() { return window.AppState.files.slice(); }

  function clearAll() {
    if (window.AppState.files.length === 0) return;
    window.AppState.files = [];
    renderFileList();
    analysisInput.value = '';
    if (window.Analyzer) window.Analyzer.run('');
    toast('All files cleared', 'info');
  }

  function removeFile(id) {
    const idx = window.AppState.files.findIndex(f => f.id === id);
    if (idx === -1) return;
    window.AppState.files.splice(idx, 1);
    renderFileList();
  }

  // --- Event wiring ---
  zone.addEventListener('click', () => input.click());
  zone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
  });

  ['dragenter', 'dragover'].forEach(ev => zone.addEventListener(ev, e => {
    e.preventDefault(); e.stopPropagation();
    zone.classList.add('dragover');
  }));
  ['dragleave', 'drop'].forEach(ev => zone.addEventListener(ev, e => {
    e.preventDefault(); e.stopPropagation();
    if (ev === 'dragleave' && e.target !== zone) return;
    zone.classList.remove('dragover');
  }));
  zone.addEventListener('drop', e => {
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length) handleFiles(files);
  });

  input.addEventListener('change', e => {
    const files = Array.from(e.target.files || []);
    if (files.length) handleFiles(files);
    input.value = '';
  });

  if (clearBtn) clearBtn.addEventListener('click', clearAll);

  fileList.addEventListener('click', e => {
    const btn = e.target.closest('.file-remove');
    if (btn) removeFile(Number(btn.dataset.id));
  });

  // --- Core ---
  function extOf(name) {
    const parts = name.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
  }

  async function handleFiles(files) {
    if (uploading) return toast('Please wait for the current batch', 'info');
    uploading = true;
    progressWrap.hidden = false;
    progressFill.style.width = '0%';
    progressLabel.textContent = '0%';

    const total = files.length;
    let done = 0;

    for (const file of files) {
      const ext = extOf(file.name);

      if (!SUPPORTED.has(ext)) {
        toast(`Unsupported: .${ext}`, 'error');
        done++;
        updateOverallProgress(done, total);
        continue;
      }
      if (file.size > MAX_BYTES) {
        toast(`${file.name}: file too large (max 100 MB)`, 'error');
        done++;
        updateOverallProgress(done, total);
        continue;
      }

      const item = {
        id: nextId++,
        name: file.name,
        size: file.size,
        ext,
        text: '',
        status: 'reading',
      };
      window.AppState.files.push(item);
      renderFileList();

      try {
        item.text = await readFile(file, ext);
        item.status = 'success';
        // Feed the analysis input
        if (item.text && item.text.trim().length > 0) {
          const combined = analysisInput.value.trim().length > 0
            ? analysisInput.value + '\n\n' + item.text
            : item.text;
          analysisInput.value = combined;
          if (window.Analyzer) window.Analyzer.run(combined);
          if (window.Statistics) window.Statistics.recordAnalysis(item);
        }
        toast(`${file.name} loaded`, 'success');
      } catch (err) {
        item.status = 'error';
        item.text = '';
        toast(`${file.name}: ${err.message || 'failed'}`, 'error');
      }

      done++;
      renderFileList();
      updateOverallProgress(done, total);
    }

    uploading = false;
    setTimeout(() => { progressWrap.hidden = true; }, 800);
  }

  function updateOverallProgress(done, total) {
    const pct = Math.round((done / total) * 100);
    progressFill.style.width = pct + '%';
    progressLabel.textContent = pct + '%';
  }

  async function readFile(file, ext) {
    if (SUPPORTED_TEXT.includes(ext)) {
      return await file.text();
    }
    if (ext === 'pdf') return readPDF(file);
    if (ext === 'docx') return readDOCX(file);
    if (ext === 'doc') {
      throw new Error('Legacy .doc unsupported — save as .docx first');
    }
    throw new Error('Unsupported type');
  }

  async function readPDF(file) {
    if (typeof pdfjsLib === 'undefined') {
      throw new Error('PDF parser failed to load — check your connection');
    }
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(it => it.str).join(' ') + '\n\n';
    }
    return text;
  }

  async function readDOCX(file) {
    if (typeof mammoth === 'undefined') {
      throw new Error('DOCX parser failed to load — check your connection');
    }
    const buffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return result.value;
  }

  // --- Render ---
  function renderFileList() {
    const files = window.AppState.files;
    if (files.length === 0) {
      fileList.innerHTML = '';
      clearBtn.hidden = true;
      return;
    }
    clearBtn.hidden = false;
    fileList.innerHTML = files.map(f => `
      <div class="file-item">
        <span class="file-ext">${escapeHTML(f.ext || '?')}</span>
        <div class="file-meta">
          <div class="file-name">${escapeHTML(f.name)}</div>
          <div class="file-size">${formatBytes(f.size)}</div>
        </div>
        <span class="file-status ${f.status === 'success' ? 'success' : f.status === 'error' ? 'error' : ''}">
          ${f.status === 'reading' ? 'Reading…' : f.status === 'success' ? 'Ready' : 'Error'}
        </span>
        <button class="file-remove" data-id="${f.id}" aria-label="Remove ${escapeHTML(f.name)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18" stroke-linecap="round"/></svg>
        </button>
      </div>
    `).join('');
  }

  window.Uploader = { getFiles, clearAll, removeFile };
})();
