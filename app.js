'use strict';

/* =========================================================
   PREFS — localStorage
   ========================================================= */
class Prefs {
  static KEY = 'lumen.prefs';
  static load() {
    try { return JSON.parse(localStorage.getItem(Prefs.KEY)) || {}; }
    catch { return {}; }
  }
  static save(obj) {
    try { localStorage.setItem(Prefs.KEY, JSON.stringify(obj)); } catch {}
  }
}

/* =========================================================
   STORE — IndexedDB
   ========================================================= */
class Store {
  constructor(name = 'lumen-db', version = 1) {
    this.name = name; this.version = version; this.db = null;
  }
  open() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return reject(new Error('No IndexedDB'));
      const req = indexedDB.open(this.name, this.version);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('history')) {
          const s = db.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
          s.createIndex('ts', 'ts');
        }
      };
      req.onsuccess = () => { this.db = req.result; resolve(this.db); };
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('IDB blocked'));
    });
  }
  _tx(store, mode) { return this.db.transaction(store, mode).objectStore(store); }
  add(store, value) {
    return new Promise((res, rej) => {
      const r = this._tx(store, 'readwrite').add(value);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  all(store) {
    return new Promise((res, rej) => {
      const r = this._tx(store, 'readonly').getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => rej(r.error);
    });
  }
  del(store, key) {
    return new Promise((res, rej) => {
      const r = this._tx(store, 'readwrite').delete(key);
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
  }
}

/* =========================================================
   TOAST
   ========================================================= */
class Toast {
  constructor(host) { this.host = host; }
  show(msg, kind = '') {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = msg;
    this.host.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }, 2600);
  }
  ok(m) { this.show(m, 'ok'); }
  err(m) { this.show(m, 'err'); }
}

/* =========================================================
   ANALYZER — metrics
   ========================================================= */
const STOP_WORDS = new Set(('a an and are as at be but by for from has have he her his i in is it its ' +
'of on or that the their them they this to was were will with you your we our us not no nor if then than ' +
'so such can could should would do does did done been being had having also just more most very much many ' +
'what which who whom whose when where why how all any both each few other some only own same too s t ' +
'about above after again against below between during into through under until up down out off over').split(/\s+/));

const LEXICON = {
  good:2, great:3, excellent:4, amazing:4, awesome:4, love:3, loved:3, lovely:3, happy:3, joy:3,
  positive:2, best:3, better:2, nice:2, wonderful:4, fantastic:4, brilliant:4, superb:4, perfect:4,
  win:3, wins:3, success:3, successful:3, enjoy:2, enjoyed:2, pleased:3, glad:2, delighted:3,
  superior:3, beautiful:3, clean:1, fresh:1, strong:1, confident:2, hope:2, hopeful:2,
  benefit:2, benefits:2, helpful:2, useful:2, effective:2, efficient:2, clear:1, sure:1,
  bad:-2, terrible:-3, awful:-3, horrible:-3, hate:-3, hated:-3, sad:-2, angry:-3, anger:-3,
  negative:-2, worst:-3, worse:-2, poor:-2, weak:-2, slow:-1, difficult:-1, problem:-2,
  problems:-2, fail:-2, failed:-2, failure:-2, broken:-2, ugly:-2, dirty:-1, lose:-3, lost:-2,
  pain:-2, painful:-2, hurt:-2, afraid:-2, fear:-2, worried:-2, worry:-2, stress:-2,
  anxious:-2, boring:-2, bored:-2, useless:-2, harmful:-2, danger:-2, dangerous:-2,
  risk:-1, wrong:-2, mistake:-2, stupid:-2, dumb:-2
};

class Analyzer {
  static syllables(word) {
    const w = word.toLowerCase().replace(/[^a-z]/g, '');
    if (!w) return 0;
    const groups = w.match(/[aeiouy]+/g);
    let n = groups ? groups.length : 0;
    if (w.endsWith('e') && !w.endsWith('le') && n > 1) n--;
    return Math.max(1, n);
  }

  static tokens(text) {
    return (text.toLowerCase().match(/[a-z']+/g) || []).filter(Boolean);
  }

  static analyze(text) {
    const raw = text || '';
    const chars = raw.length;
    const charsNS = raw.replace(/\s/g, '').length;
    const sentences = (raw.match(/[.!?]+(?=\s|$)/g) || []).length;
    const paragraphs = raw.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;

    const toks = Analyzer.tokens(raw);
    const words = toks.length;
    const uniq = new Set(toks).size;

    const readingSec = Math.round((words / 225) * 60);
    const speakingSec = Math.round((words / 130) * 60);

    const freq = new Map();
    for (const t of toks) {
      if (t.length < 3 || STOP_WORDS.has(t)) continue;
      freq.set(t, (freq.get(t) || 0) + 1);
    }
    const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const keywords = top.map(([w, c]) => ({
      word: w, count: c,
      density: words ? +((c / words) * 100).toFixed(1) : 0
    }));

    let score = 0;
    for (const t of toks) if (LEXICON[t]) score += LEXICON[t];
    const normalized = words ? +((score / words) * 100).toFixed(1) : 0;
    let sentLabel = 'Neutral';
    if (normalized > 3) sentLabel = 'Positive';
    else if (normalized < -3) sentLabel = 'Negative';

    const syll = toks.reduce((a, w) => a + Analyzer.syllables(w), 0);
    const fk = (words && sentences)
      ? 206.835 - 1.015 * (words / sentences) - 84.6 * (syll / words)
      : 0;
    const fkClamped = Math.max(0, Math.min(100, fk));
    const grade = Analyzer.grade(fkClamped);

    return {
      chars, charsNS, words, uniq, sentences, paragraphs,
      readingSec, speakingSec,
      keywords, sentScore: normalized, sentLabel,
      readability: +fkClamped.toFixed(1), grade
    };
  }

  static grade(score) {
    if (!score) return 'Grade —';
    if (score >= 90) return 'Very easy · 5th grade';
    if (score >= 80) return 'Easy · 6th grade';
    if (score >= 70) return 'Fairly easy · 7th grade';
    if (score >= 60) return 'Standard · 8th–9th';
    if (score >= 50) return 'Fairly hard · 10th–12th';
    if (score >= 30) return 'Difficult · College';
    return 'Very difficult · Graduate';
  }

  static fmtTime(sec) {
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60), s = sec % 60;
    return s ? `${m}m ${s}s` : `${m}m`;
  }
}

/* =========================================================
   PARSER — file / OCR
   ========================================================= */
class Parser {
  constructor(onProgress) {
    this.onProgress = onProgress || (() => {});
    if (window.pdfjsLib) {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    }
  }

  async parse(file) {
    const n = file.name.toLowerCase();
    if (n.endsWith('.txt')) return await file.text();
    if (n.endsWith('.pdf')) return await this.pdf(file);
    if (n.endsWith('.docx')) return await this.docx(file);
    if (/\.(jpg|jpeg|png)$/.test(n)) return await this.ocr(file);
    throw new Error('Unsupported file type');
  }

  async pdf(file) {
    if (!window.pdfjsLib) throw new Error('PDF.js not loaded');
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const parts = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      this.onProgress(`PDF page ${i}/${pdf.numPages}`);
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      parts.push(content.items.map(it => it.str).join(' '));
    }
    return parts.join('\n\n');
  }

  async docx(file) {
    if (!window.mammoth) throw new Error('Mammoth.js not loaded');
    const buf = await file.arrayBuffer();
    const res = await mammoth.extractRawText({ arrayBuffer: buf });
    return res.value || '';
  }

  async ocr(file) {
    if (!window.Tesseract) throw new Error('Tesseract.js not loaded');
    const { data } = await Tesseract.recognize(file, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text')
          this.onProgress(`OCR ${Math.round(m.progress * 100)}%`);
      }
    });
    return data.text || '';
  }
}

/* =========================================================
   TILT
   ========================================================= */
class Tilt {
  constructor(selector, max = 7) {
    this.max = max;
    this.enabled = !matchMedia('(pointer: coarse)').matches &&
                   !matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!this.enabled) return;
    this.cards = [...document.querySelectorAll(selector)];
    this._move = this._move.bind(this);
    this._leave = this._leave.bind(this);
    this.cards.forEach(c => {
      c.addEventListener('pointermove', this._move);
      c.addEventListener('pointerleave', this._leave);
    });
  }
  _move(e) {
    const c = e.currentTarget;
    const r = c.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    c.style.transform =
      `perspective(1200px) rotateY(${px * this.max}deg) rotateX(${-py * this.max}deg) translateZ(6px)`;
    c.style.setProperty('--mx', `${(px + 0.5) * 100}%`);
    c.style.setProperty('--my', `${(py + 0.5) * 100}%`);
  }
  _leave(e) { e.currentTarget.style.transform = ''; }
  destroy() {
    if (!this.enabled) return;
    this.cards.forEach(c => {
      c.removeEventListener('pointermove', this._move);
      c.removeEventListener('pointerleave', this._leave);
    });
  }
}

/* =========================================================
   MAGNETIC
   ========================================================= */
class Magnetic {
  constructor(selector, strength = 0.14) {
    this.strength = strength;
    this.enabled = !matchMedia('(pointer: coarse)').matches;
    if (!this.enabled) return;
    this._move = this._move.bind(this);
    this._leave = this._leave.bind(this);
    document.querySelectorAll(selector).forEach(el => {
      el.addEventListener('pointermove', this._move);
      el.addEventListener('pointerleave', this._leave);
    });
  }
  _move(e) {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left - r.width / 2;
    const y = e.clientY - r.top - r.height / 2;
    el.style.transform = `translate(${x * this.strength}px,${y * this.strength}px)`;
  }
  _leave(e) { e.currentTarget.style.transform = ''; }
}

/* =========================================================
   TOUCH FX
   ========================================================= */
class TouchFx {
  constructor() {
    this.mode = 'ripple';
    this._down = this._down.bind(this);
    document.addEventListener('pointerdown', this._down);
  }
  setMode(m) { this.mode = m; }

  _down(e) {
    const target = e.target.closest('.btn-ghost,.chip,.switch,.icon-btn,.fx-option,.hi-actions button');
    if (!target) return;
    if (this.mode === 'ripple' || this.mode === 'both') this.ripple(target, e);
    if (this.mode === 'shockwave' || this.mode === 'both') this.shockwave(target, e);
  }
  ripple(el, e) {
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.style.overflow = 'hidden';
    const r = el.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2;
    const s = document.createElement('span');
    s.className = 'ripple';
    s.style.width = s.style.height = `${size}px`;
    s.style.left = `${e.clientX - r.left - size / 2}px`;
    s.style.top  = `${e.clientY - r.top  - size / 2}px`;
    el.appendChild(s);
    s.addEventListener('animationend', () => s.remove(), { once: true });
  }
  shockwave(el, e) {
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    const r = el.getBoundingClientRect();
    const s = document.createElement('span');
    s.className = 'shockwave';
    s.style.left = `${e.clientX - r.left}px`;
    s.style.top  = `${e.clientY - r.top}px`;
    el.appendChild(s);
    s.addEventListener('animationend', () => s.remove(), { once: true });
  }
  particles(el) {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const n = 16;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('span');
      p.className = 'particle';
      const angle = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      const dist = 40 + Math.random() * 90;
      p.style.left = `${cx}px`;
      p.style.top  = `${cy}px`;
      p.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
      p.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
      p.style.setProperty('--d', `${0.5 + Math.random() * 0.5}s`);
      document.body.appendChild(p);
      p.addEventListener('animationend', () => p.remove(), { once: true });
    }
  }
}

/* =========================================================
   APP
   ========================================================= */
class App {
  constructor() {
    this.store = new Store();
    this.toast = new Toast(document.getElementById('toasts'));
    this.touchFx = new TouchFx();
    this.tilt = null;
    this.magnetic = null;
    this.parser = new Parser(msg => this.setStatus(msg, true));
    this.debounceTimer = null;
    this.currentAnalysis = null;

    this.$ = (id) => document.getElementById(id);
    this.bind();
  }

  async init() {
    try { await this.store.open(); }
    catch (e) { console.warn('[Lumen] store:', e); }

    this.loadPrefs();
    this.buildEffectOptions();

    this.tilt = new Tilt('[data-tilt]');
    this.magnetic = new Magnetic('[data-magnetic]');

    this.refresh();
  }

  bind() {
    this.$('textInput').addEventListener('input', () => this.scheduleRefresh());
    this.$('clearBtn').addEventListener('click', () => this.clear());
    this.$('sampleBtn').addEventListener('click', () => this.loadSample());
    this.$('saveBtn').addEventListener('click', () => this.saveEntry());
    this.$('historyBtn').addEventListener('click', () => this.openHistory());
    this.$('historyClose').addEventListener('click', () => this.closeHistory());
    this.$('historyModal').addEventListener('click', (e) => {
      if (e.target.id === 'historyModal') this.closeHistory();
    });

    this.$('themeSwitch').addEventListener('click', () => this.toggleTheme());
    this.$('focusSwitch').addEventListener('click', () => this.toggleFocus());

    const dz = this.$('dropzone');
    const fi = this.$('fileInput');
    dz.addEventListener('click', () => fi.click());
    dz.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fi.click(); }
    });
    fi.addEventListener('change', (e) => {
      if (e.target.files[0]) this.handleFile(e.target.files[0]);
      e.target.value = '';
    });
    ['dragenter', 'dragover'].forEach(ev =>
      dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach(ev =>
      dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('drag'); }));
    dz.addEventListener('drop', (e) => {
      const f = e.dataTransfer.files[0];
      if (f) this.handleFile(f);
    });

    this.$('effectsToggle').addEventListener('click', () => this.toggleEffectsPanel());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeHistory();
    });
  }

  loadPrefs() {
    const p = Prefs.load();
    const theme = p.theme || 'dark';
    document.documentElement.dataset.theme = theme;
    this.$('themeSwitch').setAttribute('aria-checked', theme === 'dark' ? 'true' : 'false');
    this.$('themeSwitch').querySelector('.switch-label').textContent = theme === 'dark' ? 'Dark' : 'Light';

    if (p.switchEffect) document.body.dataset.switchEffect = p.switchEffect;
    if (p.touchEffect) {
      document.body.dataset.touchEffect = p.touchEffect;
      this.touchFx.setMode(p.touchEffect);
    }
    if (p.focus) {
      document.body.classList.add('focus-mode');
      this.$('focusSwitch').setAttribute('aria-checked', 'true');
    }
  }
  savePrefs(extra = {}) {
    Prefs.save({ ...Prefs.load(), ...extra });
  }

  toggleTheme() {
    const cur = document.documentElement.dataset.theme;
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    this.$('themeSwitch').setAttribute('aria-checked', next === 'dark' ? 'true' : 'false');
    this.$('themeSwitch').querySelector('.switch-label').textContent = next === 'dark' ? 'Dark' : 'Light';
    this.savePrefs({ theme: next });
  }
  toggleFocus() {
    const on = document.body.classList.toggle('focus-mode');
    this.$('focusSwitch').setAttribute('aria-checked', on ? 'true' : 'false');
    this.savePrefs({ focus: on });
  }

  toggleEffectsPanel() {
    const panel = this.$('effectsPanel');
    const open = panel.classList.toggle('open');
    this.$('effectsToggle').setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  buildEffectOptions() {
    const switches = [
      { id: 'flip',   label: 'Mechanical' },
      { id: 'depth',  label: 'Depth' },
      { id: 'liquid', label: 'Liquid' },
      { id: 'pulse',  label: 'Pulse' }
    ];
    const touches = [
      { id: 'ripple',    label: 'Ripple' },
      { id: 'shockwave', label: 'Shockwave' },
      { id: 'both',      label: 'Both' },
      { id: 'particles', label: 'Particles' }
    ];

    const sw = this.$('switchOptions');
    const cur = document.body.dataset.switchEffect || 'flip';
    switches.forEach(o => {
      const b = document.createElement('button');
      b.className = 'fx-option';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', o.id === cur ? 'true' : 'false');
      b.textContent = o.label;
      b.addEventListener('click', () => {
        document.body.dataset.switchEffect = o.id;
        this.savePrefs({ switchEffect: o.id });
        [...sw.children].forEach(c => c.setAttribute('aria-checked', 'false'));
        b.setAttribute('aria-checked', 'true');
      });
      sw.appendChild(b);
    });

    const to = this.$('touchOptions');
    const curT = document.body.dataset.touchEffect || 'ripple';
    touches.forEach(o => {
      const b = document.createElement('button');
      b.className = 'fx-option';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', o.id === curT ? 'true' : 'false');
      b.textContent = o.label;
      b.addEventListener('click', () => {
        document.body.dataset.touchEffect = o.id;
        this.touchFx.setMode(o.id);
        this.savePrefs({ touchEffect: o.id });
        [...to.children].forEach(c => c.setAttribute('aria-checked', 'false'));
        b.setAttribute('aria-checked', 'true');
      });
      to.appendChild(b);
    });
  }

  scheduleRefresh() {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.refresh(), 140);
  }
  refresh() {
    const text = this.$('textInput').value;
    const a = Analyzer.analyze(text);
    this.currentAnalysis = a;
    this.render(a);
  }

  render(a) {
    this.$('mWords').textContent = a.words.toLocaleString();
    this.$('mUnique').textContent = `${a.uniq.toLocaleString()} unique`;
    this.$('mChars').textContent = a.chars.toLocaleString();
    this.$('mCharsNS').textContent = `${a.charsNS.toLocaleString()} without spaces`;
    this.$('mSentences').textContent = a.sentences.toLocaleString();
    this.$('mParagraphs').textContent = `${a.paragraphs.toLocaleString()} paragraphs`;
    this.$('mReading').textContent = Analyzer.fmtTime(a.readingSec);
    this.$('mSpeaking').textContent = `${Analyzer.fmtTime(a.speakingSec)} speaking`;

    const kw = this.$('keywords');
    kw.innerHTML = '';
    if (!a.keywords.length) {
      kw.innerHTML = '<span class="empty">—</span>';
    } else {
      for (const k of a.keywords) {
        const el = document.createElement('span');
        el.className = 'kw';
        el.innerHTML = `${k.word} <em>${k.density}%</em>`;
        kw.appendChild(el);
      }
    }

    const dot = this.$('sentDot');
    dot.className = 'sentiment-dot';
    dot.classList.add(a.sentLabel === 'Positive' ? 'pos' : a.sentLabel === 'Negative' ? 'neg' : 'neu');
    this.$('mSentiment').textContent = a.sentLabel;
    this.$('sentScore').textContent = `Score ${a.sentScore}`;

    this.$('readFill').style.width = `${a.readability}%`;
    this.$('readScore').textContent = a.readability.toFixed(1);
    this.$('readGrade').textContent = a.grade;
  }

  clear() {
    this.$('textInput').value = '';
    this.refresh();
    this.setStatus('Cleared');
  }

  loadSample() {
    this.$('textInput').value =
`Design is not decoration. It is the discipline of removing everything that does not serve the user, then making what remains feel inevitable. A good interface is quiet: it does not shout, it does not ask for attention it has not earned. It responds, it yields, it clarifies.

The best products behave like deep water — calm on the surface, precise underneath. They understand that users are not audiences. They are collaborators. Every word, every button, every transition is a sentence in a conversation that must respect the reader's time.

Clarity is difficult. Simplicity is harder. Anyone can add, only a few know what to cut.`;
    this.refresh();
    this.setStatus('Sample loaded');
  }

  setStatus(msg, busy = false) {
    const el = this.$('status');
    el.textContent = msg;
    el.classList.toggle('busy', busy);
  }

  async handleFile(file) {
    const dz = this.$('dropzone');
    this.setStatus(`Parsing ${file.name}…`, true);
    try {
      const text = await this.parser.parse(file);
      if (!text.trim()) throw new Error('No text found');
      this.$('textInput').value = text;
      this.refresh();
      this.touchFx.particles(dz);
      this.toast.ok(`${file.name} · ${text.length.toLocaleString()} chars`);
      this.setStatus('Loaded');
    } catch (err) {
      console.error('[Lumen] parse:', err);
      this.toast.err(`Failed: ${err.message || err}`);
      this.setStatus('Error');
    }
  }

  async saveEntry() {
    const text = this.$('textInput').value.trim();
    if (!text) { this.toast.err('Nothing to save'); return; }
    const a = this.currentAnalysis;
    const title = text.slice(0, 60).replace(/\s+/g, ' ') || 'Untitled';
    if (!this.store.db) { this.toast.err('History unavailable'); return; }
    try {
      await this.store.add('history', { ts: Date.now(), text, title, metrics: a });
      this.toast.ok('Saved to history');
    } catch (err) {
      console.error('[Lumen] save:', err);
      this.toast.err('Save failed');
    }
  }

  async openHistory() {
    const list = this.$('historyList');
    list.innerHTML = '<div class="empty">Loading…</div>';
    this.$('historyModal').hidden = false;
    if (!this.store.db) {
      list.innerHTML = '<div class="empty">History unavailable (no IndexedDB).</div>';
      return;
    }
    try {
      const items = (await this.store.all('history')).sort((a, b) => b.ts - a.ts);
      list.innerHTML = '';
      if (!items.length) {
        list.innerHTML = '<div class="empty">No saved analyses yet.</div>';
        return;
      }
      for (const it of items) {
        const row = document.createElement('div');
        row.className = 'history-item';
        const d = new Date(it.ts).toLocaleString();
        row.innerHTML = `
          <div class="hi-body">
            <div class="hi-title"></div>
            <div class="hi-meta">${d} · ${(it.metrics && it.metrics.words) || 0} words</div>
          </div>
          <div class="hi-actions">
            <button data-act="resume">Resume</button>
            <button data-act="del" class="danger">Delete</button>
          </div>`;
        row.querySelector('.hi-title').textContent = it.title;
        row.querySelector('[data-act="resume"]').addEventListener('click', () => {
          this.$('textInput').value = it.text;
          this.refresh();
          this.closeHistory();
          this.setStatus('Resumed');
        });
        row.querySelector('[data-act="del"]').addEventListener('click', async () => {
          await this.store.del('history', it.id);
          row.remove();
          if (!list.children.length)
            list.innerHTML = '<div class="empty">No saved analyses yet.</div>';
        });
        list.appendChild(row);
      }
    } catch (err) {
      console.error('[Lumen] history:', err);
      list.innerHTML = '<div class="empty">History unavailable.</div>';
    }
  }
  closeHistory() { this.$('historyModal').hidden = true; }
}

/* =========================================================
   BOOT
   ========================================================= */
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const app = new App();
    await app.init();
    window.__lumen = app;
    console.log('[Lumen] booted');
  } catch (err) {
    console.error('[Lumen] boot failed:', err);
  }
});