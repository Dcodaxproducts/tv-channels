(function () {
  'use strict';

  var PANES = ['for you', 'pakistan', 'english', 'world'];
  var GROUPS = ['news', 'sports', 'entertainment', 'kids', 'movies', 'music', 'faith', 'learn', 'more'];
  var PAL = {
    news: ['#00aba9', '#000'], sports: ['#a4c400', '#000'], entertainment: ['#d80073', '#fff'],
    kids: ['#f0a30a', '#000'], movies: ['#1ba1e2', '#000'], music: ['#aa00ff', '#fff'],
    faith: ['#60a917', '#000'], learn: ['#647687', '#fff'], more: ['#3a3a3a', '#fff']
  };
  var CYCLE = ['news', 'entertainment', 'sports', 'movies', 'kids', 'music', 'faith', 'learn'];
  var ENGLISH = ['US', 'GB', 'IN'];
  var COLS = 6, TW = 18.6, TH = 12.6, GAP = 1, PX = TW + GAP, PY = TH + GAP;
  var STAR = '<svg viewBox="0 0 24 24"><path d="M12 2l3 6.9 7.5.7-5.7 5 1.7 7.4L12 18l-6.5 4 1.7-7.4-5.7-5 7.5-.7z"/></svg>';

  var S = {
    pane: 0, zone: 'grid', fi: 0, sel: 0, off: 0, world: null, worldSel: 0, top: 17,
    items: [], filters: [], data: null, byId: {}, byCountry: {}, english: [], countries: [], names: {},
    fav: [], recent: [], player: null, hls: null, retry: false
  };

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function load(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v || d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }

  function gi(g) { var i = GROUPS.indexOf(g); return i < 0 ? GROUPS.length : i; }
  function byGroupName(a, b) { return gi(a.g) - gi(b.g) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0); }
  function initials(n) {
    var w = n.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);
    if (!w.length) return n.slice(0, 2);
    return (w.length === 1 ? w[0].slice(0, 3) : w[0][0] + w[1][0] + (w[2] ? w[2][0] : '')).toUpperCase();
  }

  /* ---------- data ---------- */

  function init() {
    msg('loading channels', '');
    fetch('data/channels.json').then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    }).then(function (d) {
      build(d);
      boot();
    }).catch(function () {
      S.retry = true;
      msg('couldn’t load channels', 'Check the TV’s internet connection, then press ok to try again.');
    });
  }

  function build(d) {
    S.names = d.c;
    S.byId = {}; S.byCountry = {};
    var secure = location.protocol === 'https:';
    d.l.forEach(function (r) {
      var urls = secure ? r[6].filter(function (u) { return u.indexOf('http://') !== 0; }) : r[6];
      if (!urls.length) return; /* an https page cannot play http streams, so the channel would never tune */
      var c = { id: r[0], name: r[1], cc: r[2], g: r[3], logo: r[4], q: r[5], urls: urls };
      S.byId[c.id] = c;
      (S.byCountry[c.cc] = S.byCountry[c.cc] || []).push(c);
    });
    Object.keys(S.byCountry).forEach(function (k) { S.byCountry[k].sort(byGroupName); });
    S.english = [];
    ENGLISH.forEach(function (k) { S.english = S.english.concat(S.byCountry[k] || []); });
    S.english.sort(byGroupName);
    S.countries = Object.keys(S.byCountry).map(function (k) {
      return { code: k, name: S.names[k] || k, count: S.byCountry[k].length };
    }).sort(function (a, b) { return a.name < b.name ? -1 : 1; });
    S.data = d;
  }

  function boot() {
    S.fav = load('tv.fav', []);
    S.recent = load('tv.recent', []);
    S.pane = forYou().length ? 0 : 1;
    S.zone = 'grid';
    refresh(false);
  }

  function forYou() {
    var seen = {}, out = [];
    S.fav.concat(S.recent).forEach(function (id) {
      if (!seen[id] && S.byId[id]) { seen[id] = 1; out.push(S.byId[id]); }
    });
    return out;
  }

  function isCountryList() { return S.pane === 3 && S.world === null; }
  function hasFilters() { return S.pane === 1 || S.pane === 2 || (S.pane === 3 && S.world !== null); }

  function baseList() {
    if (S.pane === 0) return forYou();
    if (S.pane === 1) return S.byCountry.PK || [];
    if (S.pane === 2) return S.english;
    return S.world === null ? S.countries : (S.byCountry[S.world] || []);
  }

  function filtersFor(base) {
    var n = {}, out = [{ g: 'all', n: base.length }];
    base.forEach(function (c) { n[c.g] = (n[c.g] || 0) + 1; });
    GROUPS.forEach(function (g) { if (n[g]) out.push({ g: g, n: n[g] }); });
    return out;
  }

  /* ---------- drawing ---------- */

  function refresh(keepSel) {
    var base = baseList();
    S.filters = hasFilters() ? filtersFor(base) : [];
    if (S.fi >= S.filters.length) S.fi = 0;
    var f = S.filters[S.fi];
    S.items = (f && f.g !== 'all') ? base.filter(function (c) { return c.g === f.g; }) : base;
    S.top = hasFilters() ? 17 : 13;
    if (!keepSel) { S.sel = 0; S.off = 0; }
    if (S.sel >= S.items.length) S.sel = Math.max(0, S.items.length - 1);
    if (S.zone === 'grid' && !S.items.length) S.zone = S.filters.length ? 'filter' : 'pivot';
    if (S.zone === 'filter' && !S.filters.length) S.zone = 'grid';
    fitOffset();
    drawPivots(); drawFilters(); drawGrid(); drawMsg();
  }

  function drawPivots() {
    var row = $('pivotrow'), words = PANES, on = S.pane;
    if (S.pane === 3 && S.world !== null) { words = [(S.names[S.world] || S.world).toLowerCase()]; on = 0; }
    row.innerHTML = words.map(function (w, i) {
      return '<span class="pv' + (i === on ? ' on' + (S.zone === 'pivot' ? ' z' : '') : '') + '">' + esc(w) + '</span>';
    }).join('');
    var spans = row.children;
    row.style.transform = 'translateX(' + (-(spans[on].offsetLeft - spans[0].offsetLeft)) + 'px)';
  }

  function drawFilters() {
    var el = $('filters');
    el.style.display = S.filters.length ? '' : 'none';
    el.innerHTML = S.filters.map(function (f, i) {
      return '<span class="fl' + (i === S.fi ? ' on' + (S.zone === 'filter' ? ' z' : '') : '') + '">' + f.g + '<i>' + f.n + '</i></span>';
    }).join('');
  }

  function rowsVisible() {
    var rf = parseFloat(getComputedStyle(document.documentElement).fontSize) || 10;
    return Math.max(2, Math.floor((window.innerHeight / rf - S.top - 0.5) / PY));
  }

  function fitOffset() {
    var r = Math.floor(S.sel / COLS), rows = rowsVisible();
    if (r < S.off) S.off = r;
    if (r >= S.off + rows) S.off = r - rows + 1;
  }

  function tile(i) {
    var c = S.items[i], r = Math.floor(i / COLS), col = i % COLS;
    var pos = 'left:' + (6 + col * PX) + 'rem;top:' + (1 + (r - S.off) * PY) + 'rem;';
    if (isCountryList()) {
      var p = PAL[CYCLE[i % CYCLE.length]];
      return '<div class="t" data-i="' + i + '" style="' + pos + 'background:' + p[0] + ';color:' + p[1] + '">' +
        '<div class="c">' + esc(c.name) + '</div><div class="cn">' + c.count + (c.count === 1 ? ' channel' : ' channels') + '</div></div>';
    }
    var pal = PAL[c.g] || PAL.more;
    var fav = S.fav.indexOf(c.id) >= 0;
    var cc = (S.pane === 0 || S.pane === 2) ? ' <span class="cc">' + esc(c.cc) + '</span>' : '';
    var img = c.logo ? '<img src="' + esc(c.logo) + '" alt="" onerror="this.parentNode.className+=\' x\';this.remove()">' : '';
    return '<div class="t" data-i="' + i + '" style="' + pos + 'background:' + pal[0] + ';color:' + pal[1] + '">' +
      '<div class="lg' + (c.logo ? '' : ' n') + '"><span class="ini">' + esc(initials(c.name)) + '</span>' + img + '</div>' +
      '<div class="nm"><div>' + (fav ? STAR : '') + esc(c.name) + cc + '</div></div></div>';
  }

  function drawGrid() {
    var n = S.items.length, rows = rowsVisible(), lastRow = Math.ceil(n / COLS) - 1;
    var from = Math.max(0, S.off - 1), to = Math.min(lastRow, S.off + rows), h = '';
    for (var r = from; r <= to; r++) {
      for (var c = 0; c < COLS; c++) { var i = r * COLS + c; if (i < n) h += tile(i); }
    }
    var g = $('grid');
    g.style.top = (S.top - 1) + 'rem';
    g.innerHTML = h;
    markFocus();
  }

  function markFocus() {
    var old = document.querySelector('.t.f');
    if (old) old.className = old.className.replace(' f', '');
    if (S.zone !== 'grid') return;
    var el = document.querySelector('.t[data-i="' + S.sel + '"]');
    if (el) el.className += ' f';
  }

  function drawMsg() {
    if (S.items.length) { msg('', ''); return; }
    if (S.pane === 0) msg('nothing here yet', 'Channels you watch show up here. Press ok while watching to add a favourite.');
    else msg('no channels here', 'Try another category or another country.');
  }

  function msg(a, b) {
    $('msg1').textContent = a;
    $('msg2').textContent = b;
    $('msg').style.display = a ? '' : 'none';
  }

  /* ---------- navigation ---------- */

  function setPane(p) {
    if (p < 0 || p > PANES.length - 1 || p === S.pane) return;
    S.pane = p; S.world = null; S.fi = 0;
    refresh(false);
  }

  function gridKey(k) {
    var n = S.items.length, i = S.sel;
    if (k === 'left') { if (i % COLS > 0) i--; }
    else if (k === 'right') { if (i % COLS < COLS - 1 && i + 1 < n) i++; }
    else if (k === 'down') {
      if (i + COLS < n) i += COLS;
      else if (Math.floor((n - 1) / COLS) > Math.floor(i / COLS)) i = n - 1;
    } else if (k === 'up') {
      if (i - COLS >= 0) i -= COLS;
      else { S.zone = S.filters.length ? 'filter' : 'pivot'; refresh(true); return; }
    } else if (k === 'ok') { activate(); return; }
    if (i === S.sel) return;
    var before = S.off;
    S.sel = i; fitOffset();
    if (S.off !== before) drawGrid(); else markFocus();
  }

  function activate() {
    var c = S.items[S.sel];
    if (!c) return;
    if (isCountryList()) { S.worldSel = S.sel; S.world = c.code; S.fi = 0; refresh(false); return; }
    play(c, S.items, S.sel);
  }

  function onKey(k) {
    if (S.player) { playerKey(k); return; }
    if (S.retry) { if (k === 'ok') { S.retry = false; init(); } return; }
    if (!S.data) return;
    if (k === 'back') { back(); return; }
    if (S.zone === 'pivot') {
      if (S.world !== null) { if (k === 'down') { S.zone = 'filter'; refresh(true); } return; }
      if (k === 'left') setPane(S.pane - 1);
      else if (k === 'right') setPane(S.pane + 1);
      else if (k === 'down') { S.zone = S.filters.length ? 'filter' : 'grid'; if (S.zone === 'grid' && !S.items.length) S.zone = 'pivot'; refresh(true); }
    } else if (S.zone === 'filter') {
      if (k === 'left' && S.fi > 0) { S.fi--; refresh(false); }
      else if (k === 'right' && S.fi < S.filters.length - 1) { S.fi++; refresh(false); }
      else if (k === 'up') { S.zone = 'pivot'; refresh(true); }
      else if (k === 'down' && S.items.length) { S.zone = 'grid'; refresh(true); }
    } else {
      gridKey(k);
    }
  }

  function back() {
    if (S.pane === 3 && S.world !== null) {
      S.world = null; S.fi = 0; S.zone = 'grid';
      refresh(false); S.sel = S.worldSel; fitOffset(); drawGrid();
      return;
    }
    if (S.zone !== 'pivot') { S.zone = 'pivot'; refresh(true); return; }
    try { window.close(); } catch (e) { /* not closable */ }
  }

  /* ---------- player ---------- */

  function play(ch, list, i) {
    S.player = { ch: ch, list: list, i: i, u: 0, pane: S.pane, world: S.world, fi: S.fi, tt: 0, bt: 0 };
    $('player').hidden = false;
    remember(ch);
    tune();
  }

  function remember(ch) {
    S.recent = [ch.id].concat(S.recent.filter(function (x) { return x !== ch.id; })).slice(0, 30);
    save('tv.recent', S.recent);
  }

  function stopStream() {
    var v = $('v');
    if (S.hls) { S.hls.destroy(); S.hls = null; }
    v.removeAttribute('src');
    try { v.load(); } catch (e) { /* ignore */ }
  }

  function tune() {
    var P = S.player, v = $('v'), url = P.ch.urls[P.u];
    clearTimeout(P.tt);
    stopStream();
    setBanner(); showBanner(true);
    $('tuning').textContent = 'tuning ' + P.ch.name.toLowerCase() + '…';
    if (window.Hls && Hls.isSupported()) {
      S.hls = new Hls({ maxBufferLength: 20, maxMaxBufferLength: 40, manifestLoadingTimeOut: 7000, levelLoadingTimeOut: 7000, fragLoadingTimeOut: 12000, capLevelToPlayerSize: true });
      S.hls.on(Hls.Events.MANIFEST_PARSED, function () { var p = v.play(); if (p && p.catch) p.catch(function () {}); });
      S.hls.on(Hls.Events.ERROR, function (e, d) { if (d && d.fatal) failover(); });
      S.hls.loadSource(url);
      S.hls.attachMedia(v);
    } else {
      v.src = url;
      var p = v.play(); if (p && p.catch) p.catch(function () {});
    }
    P.tt = setTimeout(failover, 8000);
  }

  function failover() {
    var P = S.player; if (!P) return;
    clearTimeout(P.tt);
    P.u++;
    if (P.u < P.ch.urls.length) { tune(); return; }
    stopStream();
    $('tuning').textContent = 'this channel isn’t responding';
    showBanner(false);
  }

  function setBanner() {
    var P = S.player, c = P.ch, fav = S.fav.indexOf(c.id) >= 0;
    var pal = PAL[c.g] || PAL.more;
    $('banner').style.setProperty('--c', pal[0]);
    $('bn').textContent = c.name;
    $('bm').textContent = (S.names[c.cc] || c.cc).toLowerCase() + '  ·  ' + c.g + (c.q ? '  ·  ' + c.q : '') + (fav ? '  ·  favourite' : '');
  }

  function showBanner(auto) {
    var P = S.player; if (!P) return;
    var b = $('banner');
    b.className = 'on';
    clearTimeout(P.bt);
    if (auto) P.bt = setTimeout(function () { b.className = ''; }, 4500);
  }

  function playerKey(k) {
    var P = S.player;
    if (k === 'back') { closePlayer(); return; }
    if (k === 'up' || k === 'down') {
      var n = P.list.length;
      P.i = (P.i + (k === 'up' ? 1 : -1) + n) % n;
      P.ch = P.list[P.i]; P.u = 0;
      remember(P.ch);
      tune();
      return;
    }
    if (k === 'ok') {
      var at = S.fav.indexOf(P.ch.id);
      if (at >= 0) S.fav.splice(at, 1); else S.fav.unshift(P.ch.id);
      save('tv.fav', S.fav);
      setBanner(); showBanner(true);
      return;
    }
    setBanner(); showBanner(true);
  }

  function closePlayer() {
    var P = S.player;
    clearTimeout(P.tt); clearTimeout(P.bt);
    stopStream();
    $('banner').className = '';
    $('player').hidden = true;
    S.player = null;
    var same = P.pane === S.pane && P.world === S.world && P.fi === S.fi;
    refresh(false);
    if (same && S.pane !== 0) { S.sel = Math.min(P.i, S.items.length - 1); fitOffset(); drawGrid(); }
  }

  $('v').addEventListener('playing', function () {
    var P = S.player; if (!P) return;
    clearTimeout(P.tt);
    $('tuning').textContent = '';
  });
  $('v').addEventListener('waiting', function () {
    if (S.player) $('tuning').textContent = 'buffering…';
  });

  /* ---------- keys ---------- */

  var KEYS = { 37: 'left', 38: 'up', 39: 'right', 40: 'down', 13: 'ok', 8: 'back', 27: 'back', 461: 'back', 10009: 'back', 4: 'back', 427: 'up', 428: 'down' };
  var NAMES = { ArrowLeft: 'left', ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', Enter: 'ok', Backspace: 'back', Escape: 'back', BrowserBack: 'back', GoBack: 'back' };

  document.addEventListener('keydown', function (e) {
    var k = NAMES[e.key] || KEYS[e.keyCode];
    if (!k) return;
    e.preventDefault();
    onKey(k);
  });
  window.addEventListener('resize', function () { if (S.data && !S.player) { fitOffset(); drawPivots(); drawGrid(); } });

  window.__tv = S;
  init();
})();
