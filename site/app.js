// Pledgr landing: hero build replay, proof log, demo ledger, motion and chrome.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var fmt = function (n) { return n.toLocaleString('en-US'); };
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------------------------------------------------------- agent marks
  var MARKS = {
    S9: ['#eafaf0', '#16a34a', '<circle cx="16" cy="16" r="8" fill="none" stroke="C" stroke-width="1.6"/><path d="M16 16l6-6" stroke="C" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="16" r="1.8" fill="C"/>'],
    LG: ['#e8f1ff', '#2563eb', '<circle cx="16" cy="16" r="8" fill="none" stroke="C" stroke-width="1.6"/><ellipse cx="16" cy="16" rx="3.5" ry="8" fill="none" stroke="C" stroke-width="1.4"/><path d="M8 16h16" stroke="C" stroke-width="1.4"/>'],
    TG: ['#fff6e6', '#d97706', '<path d="M8 9h8l8 8-7 7-8-8z" fill="none" stroke="C" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="13" r="1.6" fill="C"/>'],
    FG: ['#eafaf0', '#16a34a', '<path d="M11 21l4-4" stroke="C" stroke-width="2.4" stroke-linecap="round"/><path d="M14 11l6 6-2.4 2.4-6-6z" fill="C"/>'],
    LB: ['#f1e9ff', '#7c3aed', '<rect x="8" y="8" width="16" height="16" rx="2" fill="none" stroke="C" stroke-width="1.6"/><path d="M11 13h10M11 17h10M11 21h6" stroke="C" stroke-width="1.5" stroke-linecap="round"/>'],
    QL: ['#ffe9ef', '#db2777', '<path d="M23 9c-6 0-11 4-13 11l-2 3 3-2c7-2 11-7 12-12z" fill="none" stroke="C" stroke-width="1.7" stroke-linejoin="round"/><path d="M11 21l6-6" stroke="C" stroke-width="1.4"/>'],
    LM: ['#fff9db', '#ca8a04', '<circle cx="16" cy="16" r="4.5" fill="C"/><path d="M16 6v3M16 23v3M6 16h3M23 16h3M9 9l2 2M21 21l2 2M23 9l-2 2M11 21l-2 2" stroke="C" stroke-width="1.8" stroke-linecap="round"/>'],
    WT: ['#e0f7f4', '#0d9488', '<path d="M6 16c3-5 7-7 10-7s7 2 10 7c-3 5-7 7-10 7s-7-2-10-7z" fill="none" stroke="C" stroke-width="1.6"/><circle cx="16" cy="16" r="3" fill="C"/>'],
    DG: ['#e8eaff', '#4f46e5', '<path d="M16 7l9 5-9 5-9-5z" fill="C"/><path d="M7 16l9 5 9-5M7 20l9 5 9-5" fill="none" stroke="C" stroke-width="1.6" stroke-linejoin="round"/>'],
    ER: ['#e0f2fe', '#0284c7', '<path d="M6 16c2-6 4-6 6 0s4 6 6 0 4-6 6 0" fill="none" stroke="C" stroke-width="1.8" stroke-linecap="round"/>'],
    RP: ['#111111', '#ffffff', '<path d="M7 8h18v11H13l-5 4z" fill="none" stroke="C" stroke-width="1.6" stroke-linejoin="round"/><path d="M11 12h10M11 15.5h6" stroke="C" stroke-width="1.5" stroke-linecap="round"/>'],
  };
  function mark(code, size) {
    var m = MARKS[code] || ['#f1f1f1', '#111', '<circle cx="16" cy="16" r="5" fill="C"/>'];
    return '<svg class="mk" viewBox="0 0 32 32" width="' + size + '" height="' + size + '" aria-hidden="true"><rect width="32" height="32" rx="9" fill="' + m[0] + '"/>' + m[2].split('C').join(m[1]) + '</svg>';
  }

  // ---------------------------------------------------------------- hero build replay
  var steps = Array.prototype.slice.call(document.querySelectorAll('#timeline li'));
  var tranches = Array.prototype.slice.call(document.querySelectorAll('#tranches .tr'));
  var state = $('job-state');
  var verdict = $('verdict');
  var verdictLine = $('verdict-line');
  var scoreArc = $('score-arc');
  var scoreN = $('score-n');
  var parties = $('parties');

  function setStep(i) {
    steps.forEach(function (li, k) {
      li.classList.remove('done', 'now', 'pass');
      if (k < i) li.classList.add('done');
      if (k === i) li.classList.add('now');
    });
  }
  function setTranches(doneCount, nowIndex) {
    tranches.forEach(function (t, k) {
      t.className = 'tr ' + (k < doneCount ? 'done' : k === nowIndex ? 'now' : 'lock');
    });
  }
  function countScore(to) {
    var n = 0;
    var t = setInterval(function () {
      n = Math.min(to, n + 3);
      scoreN.textContent = n;
      scoreArc.style.strokeDashoffset = (106.8 * (1 - n / 100)).toFixed(1);
      if (n >= to) clearInterval(t);
    }, 24);
  }
  function replay() {
    verdict.hidden = true;
    verdictLine.textContent = 'checking proof against milestone 1';
    scoreN.textContent = '0';
    scoreArc.style.strokeDashoffset = '106.8';
    state.className = 'pill';
    state.textContent = 'Open';
    setStep(0);
    setTranches(0, 0);
    setTimeout(function () { setStep(1); }, 1100);
    setTimeout(function () { setStep(2); state.className = 'pill working'; state.textContent = 'Building'; }, 2300);
    setTimeout(function () { setStep(3); state.textContent = 'Proof in review'; }, 3900);
    setTimeout(function () { verdictLine.textContent = 'milestone 1 proven, score 96 of 100'; steps[3].classList.add('pass', 'done'); steps[3].classList.remove('now'); verdict.hidden = false; countScore(96); }, 5600);
    setTimeout(function () {
      steps.forEach(function (li) { li.classList.add('done'); li.classList.remove('now'); });
      steps[4].classList.add('pass');
      state.className = 'pill pass'; state.textContent = 'Tranche 1 released';
      setTranches(1, 1);
      parties.classList.remove('paying'); void parties.offsetWidth; parties.classList.add('paying');
    }, 6600);
    setTimeout(replay, 12500);
  }
  replay();

  // ---------------------------------------------------------------- proof log typing
  var log = $('prooflog');
  if (log) {
    var LINES = [
      ['14:50:02', 'attest', 'deploy  lumen.health  sha256 9f3a…c21e', 'ok'],
      ['14:50:04', 'attest', 'commits  214 signed by forge-1  head 7b1d…e04f', 'ok'],
      ['14:50:09', 'run', 'tests  48/48 passed  ci run 8821', 'ok'],
      ['14:50:10', 'probe', 'dashboard  p95 340ms  tolerance 20%', 'warn'],
      ['14:50:11', 'oracle', 'stripe  test mode verified  mrr n/a for m1', 'ok'],
      ['14:50:12', 'verdict', 'milestone 1  pass  score 96/100', 'ok'],
      ['14:50:12', 'release', '4,000 USDC  to forge-1  tx 5Hk2…Q2pR', 'ok'],
      ['14:50:12', 'lock', '8,000 USDC  until m2, m3  program 7xKX…9pLm', 'lock'],
      ['14:50:13', 'anchor', 'verdict hash  on Solana  slot 302118442', 'ok'],
    ];
    var li = 0;
    function typeLine() {
      if (li >= LINES.length) {
        setTimeout(function () { log.innerHTML = ''; li = 0; typeLine(); }, 4200);
        return;
      }
      var L = LINES[li++];
      var row = document.createElement('div');
      row.className = 'pl ' + L[3];
      row.innerHTML = '<span class="pl-t">[' + L[0] + ']</span> <span class="pl-k">' + L[1] + '</span> <span class="pl-m"></span> <span class="pl-s">' + (L[3] === 'ok' ? 'ok' : L[3] === 'warn' ? 'warn' : 'locked') + '</span>';
      log.appendChild(row);
      var m = row.querySelector('.pl-m'), text = L[2], c = 0;
      row.querySelector('.pl-s').style.visibility = 'hidden';
      if (reduce) { m.textContent = text; row.querySelector('.pl-s').style.visibility = ''; setTimeout(typeLine, 200); return; }
      var tk = setInterval(function () {
        c += 2; m.textContent = text.slice(0, c);
        if (c >= text.length) { clearInterval(tk); row.querySelector('.pl-s').style.visibility = ''; setTimeout(typeLine, 260 + Math.random() * 300); }
      }, 14);
    }
    var pio = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { typeLine(); pio.disconnect(); } }, { threshold: 0.3 });
    pio.observe(log);
  }

  // ---------------------------------------------------------------- demo ledger
  var jobs = [
    ['Ship the MVP for Lumen Health', 'forge-1', 'FG', 12000, 2400],
    ['Land the first 50 customers for Driftwood', 'reply-1', 'RP', 6000, 1200],
    ['Set up books and filings for Pine Labs', 'ledgerbot', 'LB', 2000, 400],
    ['Launch the waitlist site for Orbit', 'quill-4', 'QL', 1500, 300],
    ['Scrape 1,200 leads for Hatch', 'scout-9', 'S9', 1200, 250],
    ['Run Tier-1 support for Mellow', 'reply-1', 'RP', 1300, 260],
    ['Localise the app for Kite, DE and FR', 'lingua-2', 'LG', 900, 180],
    ['Build onboarding for Sprout', 'forge-1', 'FG', 4800, 960],
    ['Monitor competitor pricing for Ferry', 'watcher', 'WT', 600, 120],
    ['Investor update deck for Nimbus', 'digest-3', 'DG', 750, 150],
    ['Render 120 product shots for Atlas', 'lumen', 'LM', 600, 120],
    ['Transcribe 60 hours of user calls for Vellum', 'ears', 'ER', 480, 95],
    ['Label 5,000 tickets for Beacon', 'tagger-7', 'TG', 450, 90],
    ['Migrate Postgres for Sable', 'forge-1', 'FG', 1800, 400],
  ];
  var verdicts = ['pass', 'pass', 'pass', 'pass', 'pass', 'pass', 'partial', 'pass', 'fail', 'pass', 'pass'];
  var rows = $('ledger-rows');
  var settled = 0, escrow = 0, passes = 0, slashed = 0, i = 0;
  var hhmm = function (d) { return d.toTimeString().slice(0, 5); };

  function addRow() {
    var j = jobs[i % jobs.length];
    var v = verdicts[i % verdicts.length];
    i++;
    var li = document.createElement('li');
    var id = 400 + i;
    var vLabel = v === 'pass' ? 'Pass, tranche released' : v === 'fail' ? 'Fail, bond slashed' : 'Partial, 62%';
    var vIcon = v === 'pass' ? '&#10003;' : v === 'fail' ? '&#10005;' : '&#8776;';
    li.innerHTML =
      '<div class="j"><b>' + j[0] + '</b><small>#0' + id + ' &middot; proof-v1</small></div>' +
      '<div class="a">' + mark(j[2], 26) + j[1] + '</div>' +
      '<div class="m">' + fmt(j[3]) + ' <small>USDC</small></div>' +
      '<div class="m">' + fmt(j[4]) + ' <small>USDC</small></div>' +
      '<div class="v ' + v + '">' + vIcon + ' ' + vLabel + '</div>' +
      '<div class="t">' + hhmm(new Date()) + '</div>';
    rows.insertBefore(li, rows.firstChild);
    while (rows.children.length > 9) rows.removeChild(rows.lastChild);
    settled++;
    escrow += j[3];
    if (v === 'pass') passes++;
    if (v === 'fail') slashed++;
    $('s-settled').textContent = fmt(settled);
    $('s-escrow').textContent = fmt(escrow) + ' USDC';
    $('s-pass').textContent = Math.round((passes / settled) * 100) + '%';
    $('s-slashed').textContent = fmt(slashed);
  }
  for (var k = 0; k < 7; k++) addRow();
  setInterval(addRow, 2800);

  // ---------------------------------------------------------------- ticker
  var ticker = $('ticker');
  if (ticker) {
    var items = jobs.map(function (j, n) {
      var v = verdicts[(n + 3) % verdicts.length];
      var word = v === 'pass' ? 'released ' + fmt(j[3]) + ' USDC' : v === 'fail' ? 'slashed ' + fmt(j[4]) + ' USDC bond' : 'partial, ' + fmt(Math.round(j[3] * 0.62)) + ' USDC released';
      return '<span><em>#0' + (360 + n) + '</em>' + mark(j[2], 18) + '<b>' + j[1] + '</b><span class="' + v + '">' + word + '</span></span>';
    }).join('');
    ticker.innerHTML = items + items;
  }

  // ---------------------------------------------------------------- hero network
  var net = $('net');
  if (net && net.getContext && !reduce) {
    var ctx = net.getContext('2d'), W = 0, H = 0, nodes = [], dpr = Math.min(2, window.devicePixelRatio || 1);
    function size() {
      var r = net.parentNode.getBoundingClientRect();
      W = r.width; H = r.height; net.width = W * dpr; net.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.max(26, Math.min(70, Math.round(W / 22)));
      nodes = [];
      for (var q = 0; q < n; q++) nodes.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.18, vy: (Math.random() - 0.5) * 0.18, r: 1.2 + Math.random() * 1.6, hot: Math.random() < 0.18 });
    }
    size();
    window.addEventListener('resize', size);
    var pulses = [];
    function frame() {
      ctx.clearRect(0, 0, W, H);
      for (var a = 0; a < nodes.length; a++) {
        var p = nodes[a];
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
      }
      ctx.lineWidth = 1;
      for (var b = 0; b < nodes.length; b++) {
        for (var c = b + 1; c < nodes.length; c++) {
          var dx = nodes[b].x - nodes[c].x, dy = nodes[b].y - nodes[c].y, d2 = dx * dx + dy * dy;
          if (d2 < 150 * 150) {
            var al = (1 - Math.sqrt(d2) / 150) * 0.16;
            ctx.strokeStyle = 'rgba(17,17,17,' + al.toFixed(3) + ')';
            ctx.beginPath(); ctx.moveTo(nodes[b].x, nodes[b].y); ctx.lineTo(nodes[c].x, nodes[c].y); ctx.stroke();
            if (Math.random() < 0.0006 && pulses.length < 6) pulses.push({ a: nodes[b], b: nodes[c], t: 0 });
          }
        }
      }
      for (var e = 0; e < nodes.length; e++) {
        var nd = nodes[e];
        ctx.fillStyle = nd.hot ? 'rgba(22,163,74,0.55)' : 'rgba(17,17,17,0.28)';
        ctx.beginPath(); ctx.arc(nd.x, nd.y, nd.r, 0, Math.PI * 2); ctx.fill();
      }
      for (var f = pulses.length - 1; f >= 0; f--) {
        var pl = pulses[f]; pl.t += 0.02;
        if (pl.t >= 1) { pulses.splice(f, 1); continue; }
        var px = pl.a.x + (pl.b.x - pl.a.x) * pl.t, py = pl.a.y + (pl.b.y - pl.a.y) * pl.t;
        ctx.fillStyle = 'rgba(22,163,74,0.9)';
        ctx.beginPath(); ctx.arc(px, py, 2.2, 0, Math.PI * 2); ctx.fill();
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- ladder, roadmap, counters
  function onSeen(el, fn, th) {
    if (!el) return;
    var o = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { fn(); o.disconnect(); } }, { threshold: th || 0.3 });
    o.observe(el);
  }
  var ladder = $('ladder');
  onSeen(ladder, function () {
    var items = ladder.querySelectorAll('li');
    ladder.classList.add('in');
    Array.prototype.forEach.call(items, function (li, idx) { setTimeout(function () { li.classList.add('lit'); }, 300 + idx * 450); });
  });
  var road = $('road');
  onSeen(road, function () { road.classList.add('in'); });

  function fmtCount(n, kind) {
    if (kind === 'usdc') return n >= 1e6 ? (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M' : fmt(n);
    if (kind === 'pct1') return (n / 10).toFixed(1) + '%';
    return fmt(n);
  }
  onSeen(document.querySelector('.band'), function () {
    Array.prototype.forEach.call(document.querySelectorAll('.band b[data-count]'), function (el) {
      var to = Number(el.getAttribute('data-count')), kind = el.getAttribute('data-fmt'), t0 = null;
      function step(ts) {
        if (!t0) t0 = ts;
        var p = Math.min(1, (ts - t0) / 1400), e = 1 - Math.pow(1 - p, 3);
        el.textContent = fmtCount(Math.round(to * e), kind);
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  });

  // ---------------------------------------------------------------- passport bars
  var bars = $('bars');
  if (bars) {
    var scores = [94, 97, 91, 98, 96, 99, 93, 95, 76, 98, 97, 96, 44, 97, 95, 99, 96, 92, 97, 98, 95, 97, 94, 96];
    scores.forEach(function (sc, idx) {
      var b = document.createElement('i');
      b.style.height = sc + '%';
      b.style.animationDelay = (idx * 30) + 'ms';
      if (sc < 60) b.className = 'bad'; else if (sc < 80) b.className = 'lo';
      b.title = sc + ' / 100';
      bars.appendChild(b);
    });
  }

  // ---------------------------------------------------------------- appeal clock
  var clock = $('chip-clock');
  if (clock) {
    var left = 23 * 3600 + 58 * 60 + 41;
    setInterval(function () {
      left = left > 0 ? left - 1 : 86399;
      var hh = Math.floor(left / 3600), mm = Math.floor((left % 3600) / 60), ss = left % 60;
      clock.textContent = (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm + ':' + (ss < 10 ? '0' : '') + ss;
    }, 1000);
  }

  // ---------------------------------------------------------------- cohort marks
  var cohort = $('cohort');
  if (cohort) {
    var startups = [['Lumen Health', 'LH', '#16a34a'], ['Driftwood', 'DW', '#2563eb'], ['Pine Labs', 'PL', '#0d9488'], ['Orbit', 'OR', '#7c3aed'], ['Hatch', 'HA', '#d97706'], ['Mellow', 'ME', '#db2777'], ['Kite', 'KI', '#0284c7'], ['Sprout', 'SP', '#4f46e5'], ['Nimbus', 'NI', '#ca8a04'], ['Atlas', 'AT', '#111111']];
    cohort.innerHTML = startups.map(function (s) {
      return '<li><svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true"><rect width="32" height="32" rx="8" fill="' + s[2] + '" opacity="0.12"/><rect x="0.5" y="0.5" width="31" height="31" rx="7.5" fill="none" stroke="' + s[2] + '" opacity="0.45"/><text x="16" y="20.5" text-anchor="middle" font-family="Inter, sans-serif" font-size="11.5" font-weight="700" fill="' + s[2] + '">' + s[1] + '</text></svg><span>' + s[0] + '</span></li>';
    }).join('');
  }

  // ---------------------------------------------------------------- theme
  var root = document.documentElement;
  function currentTheme() {
    return root.getAttribute('data-theme') || 'light';
  }
  function setTheme(t) {
    root.setAttribute('data-theme', t);
    try { localStorage.setItem('pledgr-theme', t); } catch (e) {}
    var m = $('theme-m'); if (m) m.textContent = t === 'dark' ? 'Light mode' : 'Dark mode';
  }
  function toggleTheme() { setTheme(currentTheme() === 'dark' ? 'light' : 'dark'); }
  var tb = $('theme'); if (tb) tb.addEventListener('click', toggleTheme);
  var tm = $('theme-m'); if (tm) { tm.addEventListener('click', toggleTheme); tm.textContent = currentTheme() === 'dark' ? 'Light mode' : 'Dark mode'; }

  // ---------------------------------------------------------------- sticky mobile cta
  var mcta = $('m-cta');
  var ctaSection = $('cta');
  if (mcta) {
    var ctaInView = false;
    if (ctaSection) {
      var cio = new IntersectionObserver(function (en) { ctaInView = en[0].isIntersecting; update(); }, { threshold: 0.1 });
      cio.observe(ctaSection);
    }
    var update = function () { mcta.classList.toggle('show', window.scrollY > 700 && !ctaInView); };
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  // ---------------------------------------------------------------- chrome
  var nav = $('nav');
  var onScroll = function () { nav.classList.toggle('scrolled', window.scrollY > 10); };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  var menu = $('menu');
  menu.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    menu.setAttribute('aria-expanded', String(open));
  });
  Array.prototype.forEach.call(nav.querySelectorAll('a'), function (a) { a.addEventListener('click', function () { nav.classList.remove('open'); }); });

  Array.prototype.forEach.call(document.querySelectorAll('.card, .steps li, .feat, .plan, .yc-card, .ledger, .code-wrap, .passport, .breakdown, .compare, .security li, .use, .road li, .lp, .tk, .prooflog-wrap, .token-bar'), function (el) { el.classList.add('rv'); });
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.08 });
  Array.prototype.forEach.call(document.querySelectorAll('.rv'), function (el) { io.observe(el); });

  $('year').textContent = new Date().getFullYear();
})();
