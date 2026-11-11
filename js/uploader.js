// language: JavaScript, file: js/uploader.js
(function () {
  'use strict';

  const SUPPORTED_TEXT = ['txt', 'md', 'csv', 'json', 'xml', 'html', 'htm', 'css', 'js', 'rtf', 'log'];
  const SUPPORTED = new Set(SUPPORTED_TEXT.concat(['pdf', 'docx', 'doc']));
  const MAX_BYTES = 100 * 1024 * 1024;

  const zone = document.getElementById('upload-zone');
  const input = document.getElementById('file-input');
  const fileList = document.getElementById('file-list');
  const clearBtn = document.getElementById('clear-files');
  const progressWrap = document.getElementById('upload-progress-wrap');
  const progressFill = document.getElementById('upload-progress-fill');
  const progressLabel = document.getElementById('upload-progress-label');

  if (!zone || !input) return;

  let nextId = 1;
  let uploading = false;

  function getAnalysisInput() { return document.getElementById('analysis-input'); }

  function clearAll() {
    if (window.AppState.files.length === 0) return;
    window.AppState.files = [];
    renderFileList();
    const ta = getAnalysisInput();
    if (ta) ta.value = '';
    if (window.Analyzer) window.Analyzer.run('');
    toast('All files cleared', 'info');
  }

  function removeFile(id) {
    const idx = window.AppState.files.findIndex(f => f.id === id);
    if (idx !== -1) {
      window.AppState.files.splice(idx, 1);
      renderFileList();
    }
  }

  zone.addEventListener('click', (e) => {
    if (e.target === input) return;
    e.preventDefault(); e.stopPropagation();
    input.click();
  });

  zone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
  });

  ['dragenter', 'dragover'].forEach(ev => zone.addEventListener(ev, (e) => {
    e.preventDefault(); e.stopPropagation(); zone.classList.add('dragover');
  }));
  ['dragleave', 'drop'].forEach(ev => zone.addEventListener(ev, (e) => {
    e.preventDefault(); e.stopPropagation();
    if (ev === 'dragleave' && e.target !== zone) return;
    zone.classList.remove('dragover');
  }));

  zone.addEventListener('drop', (e) => {
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length) handleFiles(files);
  });

  input.addEventListener('change', (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length) handleFiles(files);
    input.value = '';
  });

  if (clearBtn) clearBtn.addEventListener('click', clearAll);

  if (fileList) {
    fileList.addEventListener('click', (e) => {
      const btn = e.target.closest('.file-remove');
      if (btn) removeFile(Number(btn.dataset.id));
    });
  }

  function extOf(name) {
    const parts = name.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
  }

  function readAsText(file) {
    return new Promise((resolve, reject) => {
      if (typeof file.text === 'function') {
        Promise.resolve(file.text()).then(resolve, () => fallback());
        return;
      }
      fallback();
      function fallback() {
        try {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
          reader.readAsText(file);
        } catch (err) { reject(err); }
      }
    });
  }

  async function readFile(file, ext) {
    if (SUPPORTED_TEXT.indexOf(ext) !== -1) return readAsText(file);
    if (ext === 'pdf') {
      if (typeof pdfjsLib === 'undefined') throw new Error('PDF parser failed to load');
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
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
    if (ext === 'docx') {
      if (typeof mammoth === 'undefined') throw new Error('DOCX parser failed to load');
      const buffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer: buffer });
      return result.value;
    }
    throw new Error('Unsupported type: .' + ext);
  }

  async function handleFiles(files) {
    if (uploading) return toast('Please wait for the current batch', 'info');
    uploading = true;

    if (progressWrap) progressWrap.hidden = false;
    if (progressFill) progressFill.style.width = '0%';
    if (progressLabel) progressLabel.textContent = '0%';

    const total = files.length;
    let done = 0;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = extOf(file.name);

        if (!SUPPORTED.has(ext) || file.size > MAX_BYTES) {
          toast(file.name + ': invalid or too large', 'error');
          done++; updateOverallProgress(done, total); continue;
        }

        const item = { id: nextId++, name: file.name, size: file.size, ext, text: '', status: 'reading' };
        window.AppState.files.push(item);
        renderFileList();

        let text = '';
        try {
          text = await readFile(file, ext);
        } catch (err) {
          item.status = 'error'; renderFileList();
          toast(file.name + ': ' + err.message, 'error');
          done++; updateOverallProgress(done, total); continue;
        }

        item.text = text;
        item.status = 'success';
        renderFileList();

        const ta = getAnalysisInput();
        if (ta && text.trim().length > 0) {
          ta.value = ta.value.trim().length > 0 ? ta.value + '\n\n' + text : text;
          if (window.Analyzer) window.Analyzer.run(ta.value);
        }

        if (window.Statistics) window.Statistics.recordAnalysis(item);
        toast(file.name + ' loaded', 'success');
        done++; updateOverallProgress(done, total);
      }
    } finally {
      // GUARANTEED to hide the loading bar
      uploading = false;
      setTimeout(() => {
        if (progressWrap) progressWrap.hidden = true;
      }, 800);
    }
  }

  function updateOverallProgress(done, total) {
    const pct = Math.round((done / total) * 100);
    if (progressFill) progressFill.style.width = pct + '%';
    if (progressLabel) progressLabel.textContent = pct + '%';
  }

  function renderFileList() {
    if (!fileList) return;
    const files = window.AppState.files;
    if (files.length === 0) {
      fileList.innerHTML = '';
      if (clearBtn) clearBtn.hidden = true;
      return;
    }
    if (clearBtn) clearBtn.hidden = false;
    fileList.innerHTML = files.map(f => {
      const statusClass = f.status === 'success' ? 'success' : f.status === 'error' ? 'error' : '';
      const statusText = f.status === 'reading' ? 'Reading…' : f.status === 'success' ? 'Ready' : 'Error';
      return `<div class="file-item">
        <span class="file-ext">${escapeHTML(f.ext || '?')}</span>
        <div class="file-meta">
          <div class="file-name">${escapeHTML(f.name)}</div>
          <div class="file-size">${formatBytes(f.size)}</div>
        </div>
        <span class="file-status ${statusClass}">${statusText}</span>
        <button class="file-remove" data-id="${f.id}" aria-label="Remove">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18" stroke-linecap="round"/></svg>
        </button>
      </div>`;
    }).join('');
  }

  window.Uploader = { getFiles: () => window.AppState.files.slice(), clearAll, removeFile };
})();