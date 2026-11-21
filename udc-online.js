/* udc-online.js v9: synchronised online multiplayer for Ultimate Drinking Cards.
   Loaded as a normal <script> AFTER the main script, so it can use the game's own
   globals (players, flipCard, cardBack, allCards, ...).
   Everyone sees the same card at the same time. Only the player whose turn it is
   (or the host) can draw. Spectators can watch but never draw.
   v9 adds: late joiners (added at the start of a round), live emoji reactions (long-press to
   change), stale-room cleanup, and smarter drink counting (everyone drinks / finish / waterfall).
   Pair this with database.rules.json (publish it in the Firebase console / CLI). */
(() => {
  const VERSION = 'v9';

  // QR code script(s) saved next to index.html. Tried in order until one exposes a known QR API.
  // Change/add your real filename here if it is not one of these.
  const QR_SCRIPTS = ['qrcode.js', 'qrcode.min.js'];

  // Rooms older than this are swept away when someone hosts a new game.
  const ROOM_TTL_MS = 24 * 60 * 60 * 1000;

  // ---- drink tally: reading drinks out of card text ----
  // Black cards are inverted ("Take a drink" is no longer what you do), so by default they are not counted.
  // Set to true to count black cards as written.
  const BLACK_CARDS_COUNT = false;
  const FINISH_VALUE = 1, WATERFALL_VALUE = 1;   // how many drinks "finish your drink" / "waterfall" count as
  const NUM_WORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  const NUM_PAT = '(a|an|one|two|three|four|five|six|seven|eight|nine|ten|\\d{1,2})';
  const DRINK_PAT = '\\s+(?:more\\s+)?(?:(?:big|large|small|full|long|quick|huge|good|massive)\\s+)?(?:drinks?|swigs?)\\b';
  const TAKE_RE = new RegExp('\\b(?:take|takes|have|has)\\s+' + NUM_PAT + DRINK_PAT, 'gi');
  const GIVE_RE = new RegExp('\\b(?:issue|issues|give|gives|hand out|hands out|assign|assigns|distribute|distributes|dish out|dishes out)\\s+(?:out\\s+)?' + NUM_PAT + DRINK_PAT, 'gi');
  const EVERYONE = '(?:everyone|everybody|all players|the whole (?:group|table|room))';
  const MODAL = '(?:(?:must|has to|have to|needs to|should)\\s+)?';
  // "Everyone drinks" / "Everybody takes two drinks" (not "everyone drinks if ...")
  const EVERYONE_RE = new RegExp('\\b' + EVERYONE + '\\s+' + MODAL + '(?:(?:takes?|has|have)\\s+' + NUM_PAT + DRINK_PAT + '|drinks?\\b(?!\\s+(?:if|when|unless|whenever|except)))', 'gi');
  // "Finish your drink" / "Everyone must chug their beer"
  const FINISH_RE = new RegExp('(\\b' + EVERYONE + '\\s+' + MODAL + ')?\\b(?:finish|finishes|down|downs|chug|chugs|sink|sinks|neck|necks)\\s+(?:your|their|his|her|the|a)\\s+(?:whole\\s+|entire\\s+)?(?:drink|glass|beer|cup|can)\\b', 'gi');
  const WATERFALL_RE = /\bwaterfall\b/gi;
  function numOf(x) { x = String(x).toLowerCase(); return Object.prototype.hasOwnProperty.call(NUM_WORDS, x) ? NUM_WORDS[x] : (parseInt(x, 10) || 0); }
  // "Take a drink" -> take; "Issue 2 drinks" -> give; "Everyone drinks" / "Waterfall" -> all (every player).
  function parseDrinks(rule) {
    let t = String(rule).replace(/<[^>]*>/g, ' ');
    let take = 0, give = 0, all = 0, m;
    // Strip the "everyone" cases first so TAKE_RE doesn't count them again for the drawer.
    t = t.replace(EVERYONE_RE, (_, n) => { all += n ? numOf(n) : 1; return ' '; });
    t = t.replace(FINISH_RE, (_, ev) => { if (ev) all += FINISH_VALUE; else take += FINISH_VALUE; return ' '; });
    t = t.replace(WATERFALL_RE, () => { all += WATERFALL_VALUE; return ' '; });
    TAKE_RE.lastIndex = 0; while ((m = TAKE_RE.exec(t))) take += numOf(m[1]);
    GIVE_RE.lastIndex = 0; while ((m = GIVE_RE.exec(t))) give += numOf(m[1]);
    return { take, give, all };
  }

  // Add ?online=0 to the page address to switch this whole script off (handy for ruling it out).
  if (/[?&]online=0\b/.test(location.search)) { console.info('UDC online: disabled by ?online=0'); return; }

  // Phones have no console, so show any error on screen. It never blocks taps, and fades after 20s.
  window.__udcErrors = [];
  function showError(what) {
    try {
      window.__udcErrors.push(what); console.error('UDC online:', what);
      let b = document.getElementById('udcErrBanner');
      if (!b) {
        b = document.createElement('div'); b.id = 'udcErrBanner';
        b.style.cssText = 'position:fixed;left:8px;right:8px;top:8px;z-index:3000;background:#b00020;color:#fff;font:12px/1.3 Tahoma,sans-serif;padding:8px 10px;border-radius:8px;pointer-events:none;white-space:pre-wrap;word-break:break-word;max-height:40vh;overflow:hidden';
        document.body.appendChild(b);
      }
      b.textContent = 'Online script ' + VERSION + ' error:\n' + window.__udcErrors.slice(-3).join('\n');
      b.style.display = 'block'; clearTimeout(b._t); b._t = setTimeout(() => { b.style.display = 'none'; }, 20000);
    } catch (e) {}
  }
  window.addEventListener('error', e => { if (!e.filename || /udc-online/.test(e.filename)) showError((e.message || 'error') + (e.lineno ? ' (line ' + e.lineno + ')' : '')); });
  window.addEventListener('unhandledrejection', e => { const r = e.reason; showError('Promise: ' + ((r && (r.code || r.message)) || r)); });
  try { init(); } catch (e) { showError('Startup: ' + (e && e.message || e)); }

  function init() {
  const firebaseConfig = {
    apiKey: "AIzaSyA_VbUYyU3Ahe30heFDwpWbrgDvpAc_Sds",
    authDomain: "udc-game.firebaseapp.com",
    databaseURL: "https://udc-game-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "udc-game",
    storageBucket: "udc-game.firebasestorage.app",
    messagingSenderId: "953983676607",
    appId: "1:953983676607:web:686c36b8423294a13f960a"
  };

  const MIN_PLAYERS = 2;        // set to 1 if you want to test alone
  const HOST_GRACE_MS = 6000;   // how long a host must be offline before hosting passes on

  if (!window.firebase) { console.warn('UDC online: Firebase scripts not loaded'); return; }
  firebase.initializeApp(firebaseConfig);
  const db = firebase.database();

  // ---- invite link (?join=CODE&role=watch&diff=crazy&rounds=5&dm=1) ----
  const qs = new URLSearchParams(location.search);
  const invite = (() => {
    const c = (qs.get('join') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    if (!c) return null;
    const d = qs.get('diff'), r = qs.get('rounds');
    return {
      code: c, watch: qs.get('role') === 'watch',
      diff: (d === 'crazy' || d === 'normal') ? d : '',
      rounds: r === 'u' ? 'u' : (/^\d{1,3}$/.test(r || '') ? r : ''),
      dm: qs.get('dm') === '1'
    };
  })();
  let pendingInvite = invite;
  if (invite) {
    ['join', 'role', 'diff', 'rounds', 'dm'].forEach(k => qs.delete(k));
    const q = qs.toString();
    try { history.replaceState(null, '', location.pathname + (q ? '?' + q : '') + location.hash); } catch (e) {}
  }

  // ---- seeded randomness (same on every phone) ----
  function xmur3(s) { let h = 1779033703 ^ s.length; for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return h >>> 0; }; }
  function mulberry32(a) { return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const rngOf = s => mulberry32(xmur3(s)());
  function shuffled(arr, rng) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  // Run fn with Math.random swapped for a seeded generator, so any randomness inside
  // the game's own text transforms comes out identical on every phone.
  function seededCall(rng, fn) { const orig = Math.random; Math.random = rng; try { return fn(); } finally { Math.random = orig; } }

  // ---- state ----
  let uid = null, code = null, isHost = false, meta = null, metaSeen = false, started = false, active = false;
  let roster = {}, order = [], baseDeck = [], curN = 0, lastN = 0, refs = [], phase = 'menu', msg = '';
  let drawing = false, hostTimer = null, wake = null, stRef = null, starting = false;
  let blocked = false, latestState = null, qrRole = 'play', resultsOpen = false;
  let baseOrder = [], extraSegs = [], reactSeen = null;
  const baseTitle = document.title;
  const amSpectator = () => !!(roster[uid] && roster[uid].spectator);
  // Resolves once the main script has loaded cards.json (gives up after ~15s).
  const cardsReady = () => new Promise(res => { let t = 0; (function chk() { if (allCards.length || t++ > 150) res(); else setTimeout(chk, 100); })(); });
  const cycles = new Map();
  const ready = firebase.auth().signInAnonymously().then(c => { uid = c.user.uid; }).catch(e => { msg = 'Sign-in failed: ' + (e.code || e.message); render(); });
  const root = () => db.ref('udc/' + code);

  // ---- turn order as "segments" (lets late joiners be added without breaking the seeded sync) ----
  // Segment 1 is the host's start order. Each late-join adds a segment starting at card `from`.
  // Card n's player is a pure function of (segments, n), like everything else.
  const toArr = x => Array.isArray(x) ? x : (x && typeof x === 'object' ? Object.values(x) : []);
  const normSegs = x => toArr(x).map(s => ({ from: s.from, r0: s.r0 || 0, order: toArr(s.order) }));
  const segList = () => [{ from: 1, r0: 0, order: baseOrder }].concat(extraSegs);
  function segFor(n) { let s = segList()[0]; segList().forEach(x => { if (x.from <= n) s = x; }); return s; }
  const whoAt = n => { const s = segFor(n); return s.order.length ? s.order[(n - s.from) % s.order.length] : null; };
  const inGameUid = id => segList().some(s => s.order.some(o => o.uid === id));
  // Sets order/players/turn/round for the NEXT card, given n cards already drawn.
  function syncTurn(n) {
    const s = segFor(n + 1), len = s.order.length || 1, k = n + 1 - s.from;
    order = s.order; players = order.map(p => ({ name: p.name, colour: p.colour }));
    currentPlayerIndex = k % len; currentRound = s.r0 + Math.floor(k / len) + 1;
  }

  // ---- UI ----
  const menu = document.getElementById('themeMenu');
  const sec = document.createElement('div'); sec.className = 'menuSection';
  const openBtn = document.createElement('button'); openBtn.className = 'menu-action'; openBtn.textContent = '🌐 Online game';
  sec.appendChild(openBtn); menu.appendChild(sec);

  const css = document.createElement('style');
  css.textContent =
    '@keyframes udcTurnPulse{0%,100%{outline-color:transparent}50%{outline-color:var(--accent)}}' +
    '@keyframes udcFloat{0%{transform:translateY(0) scale(.6);opacity:0}15%{opacity:1}100%{transform:translateY(-55vh) scale(1.3);opacity:0}}' +
    '#coverCard.udc-yourturn{outline:3px solid var(--accent);outline-offset:6px;animation:udcTurnPulse 1.2s ease-in-out infinite}' +
    '@media (prefers-reduced-motion:reduce){#coverCard.udc-yourturn{animation:none;outline-color:var(--accent)}}';
  document.head.appendChild(css);

  const overlay = document.createElement('div'); overlay.className = 'overlay';
  overlay.innerHTML = '<div class="setup-box" id="udcOnlineBox"></div>';
  document.body.appendChild(overlay);
  const box = overlay.firstChild;
  const toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:#000c;color:#fff;padding:8px 14px;border-radius:999px;font:700 13px Tahoma,sans-serif;z-index:1500;display:none;max-width:90vw;text-align:center';
  document.body.appendChild(toast);
  let toastT; function say(t) { toast.textContent = t; toast.style.display = 'block'; clearTimeout(toastT); toastT = setTimeout(() => { toast.style.display = 'none'; }, 2600); }

  const mkBar = style => { const d = document.createElement('div'); d.style.cssText = style; d.style.display = 'none'; document.body.appendChild(d); return d; };
  const nudgeBar = mkBar('position:fixed;left:50%;top:calc(70px + env(safe-area-inset-top,0px));transform:translateX(-50%);background:var(--accent);color:var(--accent-text,#fff);font:800 15px Tahoma,sans-serif;padding:10px 18px;border-radius:999px;z-index:1400;pointer-events:none;box-shadow:0 6px 18px rgba(0,0,0,.4);white-space:nowrap');
  nudgeBar.textContent = '🎯 Your turn! Tap the card';
  const warnBar = mkBar('position:fixed;left:8px;right:8px;top:calc(8px + env(safe-area-inset-top,0px));background:#b00020;color:#fff;font:700 13px Tahoma,sans-serif;padding:10px 12px;border-radius:10px;z-index:1450;cursor:pointer;text-align:center');
  warnBar.textContent = '⚠️ Your cards are out of date. Tap to update.';
  warnBar.addEventListener('click', () => { overlay.style.display = 'flex'; render(); });

  openBtn.addEventListener('click', () => { menu.style.display = 'none'; overlay.style.display = 'flex'; render(); });
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.style.display = 'none'; });

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const saved = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
  const keep = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

  // ---- reaction bar: 4 emojis, long-press one to swap it for any emoji you like ----
  const DEFAULT_REACTIONS = ['🍻', '🥴', '😂', '💀'];
  const MAX_EMOJI_LEN = 16;   // a family/flag/skin-tone emoji can be several characters long
  let reactions = (() => {
    try {
      const a = JSON.parse(saved('udcReactions') || 'null');
      if (Array.isArray(a) && a.length === 4 && a.every(x => typeof x === 'string' && x && x.length <= MAX_EMOJI_LEN)) return a;
    } catch (e) {}
    return DEFAULT_REACTIONS.slice();
  })();

  const reactBar = mkBar('position:fixed;left:50%;bottom:calc(14px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);gap:6px;padding:6px 10px;background:rgba(0,0,0,.55);border-radius:999px;z-index:1200;backdrop-filter:blur(6px);-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;touch-action:manipulation');
  function renderReactBar() {
    reactBar.innerHTML = '';
    reactions.forEach((e, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.i = i; b.textContent = e;
      b.setAttribute('aria-label', 'React ' + e + ' (hold to change)');
      b.style.cssText = 'font-size:22px;background:none;border:0;padding:4px 6px;cursor:pointer;color:inherit';
      reactBar.appendChild(b);
    });
  }
  renderReactBar();

  let lastSent = 0;
  function sendReaction(emoji) {
    if (!code || !uid) return;
    const now = Date.now(); if (now - lastSent < 800) return; lastSent = now;
    root().child('react/' + uid).set({ e: emoji, t: firebase.database.ServerValue.TIMESTAMP }).catch(() => {});
  }

  // -- long-press to edit --
  let pressT = null, pressXY = null, longFired = false;
  const clearPress = () => { clearTimeout(pressT); pressT = null; };
  reactBar.addEventListener('pointerdown', ev => {
    const b = ev.target.closest('button'); if (!b) return;
    longFired = false; pressXY = [ev.clientX, ev.clientY]; clearPress();
    pressT = setTimeout(() => {
      longFired = true;
      try { vibrate([30]); } catch (x) {}
      openEmojiEditor(+b.dataset.i);
    }, 500);
  });
  reactBar.addEventListener('pointermove', ev => {
    if (pressT && pressXY && Math.hypot(ev.clientX - pressXY[0], ev.clientY - pressXY[1]) > 12) clearPress();
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => reactBar.addEventListener(t, clearPress));
  reactBar.addEventListener('contextmenu', ev => ev.preventDefault());
  reactBar.addEventListener('click', ev => {
    const b = ev.target.closest('button'); if (!b) return;
    if (longFired) { longFired = false; return; }   // the release after a long-press is not a tap
    sendReaction(reactions[+b.dataset.i]);
  });

  // -- the little editor that appears above the bar --
  const editor = document.createElement('div');
  editor.style.cssText = 'position:fixed;left:50%;bottom:calc(74px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);display:none;gap:8px;align-items:center;padding:10px 12px;background:rgba(0,0,0,.88);color:#fff;border-radius:14px;z-index:1250;font:700 13px Tahoma,sans-serif;max-width:92vw';
  editor.innerHTML = '<span>Tap the box, then pick an emoji</span>' +
    '<input id="oEmIn" type="text" autocomplete="off" aria-label="New emoji" style="width:64px;font-size:22px;text-align:center;border-radius:8px;border:0;padding:4px">' +
    '<button type="button" id="oEmReset" style="background:none;border:1px solid #fff6;color:#fff;border-radius:8px;padding:4px 8px;cursor:pointer">Reset</button>' +
    '<button type="button" id="oEmX" aria-label="Close" style="background:none;border:0;color:#fff;font-size:16px;cursor:pointer">✕</button>';
  document.body.appendChild(editor);
  const emInput = editor.querySelector('#oEmIn');
  let editIdx = -1;

  const graphemes = s => (window.Intl && Intl.Segmenter)
    ? Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s), x => x.segment)
    : Array.from(s);
  const isEmoji = g => g.length <= MAX_EMOJI_LEN && /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(g);

  function openEmojiEditor(i) {
    editIdx = i; emInput.value = ''; editor.style.display = 'flex';
    setTimeout(() => { try { emInput.focus(); } catch (x) {} }, 50);
  }
  function closeEmojiEditor() { editIdx = -1; editor.style.display = 'none'; emInput.blur(); }
  function setReaction(i, e) {
    reactions[i] = e; keep('udcReactions', JSON.stringify(reactions));
    renderReactBar(); closeEmojiEditor();
  }
  emInput.addEventListener('input', ev => {
    if (ev.isComposing || editIdx < 0) return;
    const g = graphemes(emInput.value).find(isEmoji);
    if (g) { setReaction(editIdx, g); say('Changed to ' + g); }
    else if (emInput.value.trim()) { emInput.value = ''; say('That isn’t an emoji'); }
  });
  editor.querySelector('#oEmReset').addEventListener('click', () => { if (editIdx >= 0) setReaction(editIdx, DEFAULT_REACTIONS[editIdx]); });
  editor.querySelector('#oEmX').addEventListener('click', closeEmojiEditor);
  document.addEventListener('pointerdown', ev => {
    if (editIdx >= 0 && !editor.contains(ev.target) && !reactBar.contains(ev.target)) closeEmojiEditor();
  });

  const showReactBar = () => {
    const on = active && !blocked;
    reactBar.style.display = on ? 'flex' : 'none';
    if (!on) closeEmojiEditor();
  };

  // -- showing everyone's reactions --
  function floatReaction(emoji, name) {
    if (prefersReducedMotion) return say(name + ' ' + emoji);
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;bottom:calc(70px + env(safe-area-inset-bottom,0px));left:' + (10 + Math.random() * 80) + '%;z-index:1300;pointer-events:none;text-align:center;font:700 11px Tahoma,sans-serif;color:#fff;text-shadow:0 1px 3px #000;animation:udcFloat 2.4s ease-out forwards';
    d.innerHTML = '<div style="font-size:38px;line-height:1">' + esc(emoji) + '</div>' + esc(name);
    document.body.appendChild(d); setTimeout(() => d.remove(), 2500);
  }
  function onReact(all) {
    const first = reactSeen === null; if (first) reactSeen = {};   // the first snapshot only seeds, so old reactions never replay
    for (const id in all) {
      const r = all[id]; if (!r || typeof r.t !== 'number' || typeof r.e !== 'string') continue;
      if (!first && r.t > (reactSeen[id] || 0) && roster[id]) floatReaction(r.e.slice(0, MAX_EMOJI_LEN), id === uid ? 'You' : roster[id].name);
      reactSeen[id] = r.t;
    }
  }

  const byJoinTime = (a, b) => (a[1].t || 0) - (b[1].t || 0);
  const onlineCount = () => Object.values(roster).filter(p => p && p.online !== false && !p.spectator).length;

  // ---- invite links + QR ----
  function hintText(h) {
    const p = [];
    if (h.diff) p.push(h.diff === 'crazy' ? 'CRAZY difficulty' : 'Normal difficulty');
    if (h.rounds) p.push(h.rounds === 'u' ? 'Unlimited rounds' : h.rounds + ' round' + (h.rounds === '1' ? '' : 's'));
    if (h.dm) p.push('Discord mode');
    return p.join(' · ');
  }
  // The settings baked into the link are only a preview for the person joining; the host's start settings are what count.
  function currentHint() {
    if (meta && meta.started) return { diff: meta.diff || '', rounds: meta.unlimited ? 'u' : String(meta.rounds || ''), dm: !!meta.discord };
    if (!isHost) return {};
    const unl = document.getElementById('oUnl'), rd = document.getElementById('oRounds');
    let rounds = '';
    if (unl && rd) rounds = unl.checked ? 'u' : String(Math.min(999, Math.max(1, parseInt(rd.value, 10) || 5)));
    return { diff: difficulty, rounds, dm: isDiscordModeOn() };
  }
  const roleNow = () => (phase === 'playing' || qrRole === 'watch') ? 'watch' : 'play';
  function buildUrl(role) {
    const u = new URL(location.href); u.search = ''; u.hash = '';
    u.searchParams.set('join', code);
    if (role === 'watch') u.searchParams.set('role', 'watch');
    const h = currentHint();
    if (h.diff) u.searchParams.set('diff', h.diff);
    if (h.rounds) u.searchParams.set('rounds', h.rounds);
    if (h.dm) u.searchParams.set('dm', '1');
    return u.toString();
  }
  async function copyLink(url) { try { await navigator.clipboard.writeText(url); say('Link copied'); } catch (x) { window.prompt('Copy this link', url); } }
  async function shareLink(url) {
    if (navigator.share) { try { await navigator.share({ title: 'Ultimate Drinking Cards', text: 'Join my game ' + code, url }); } catch (x) {} }
    else copyLink(url);
  }

  function qrApi() {
    if (window.QRCode) return typeof window.QRCode.toCanvas === 'function' ? 'toCanvas' : 'constructor';
    if (typeof window.qrcode === 'function') return 'kazuhiko';
    if (window.QRious) return 'qrious';
    return '';
  }
  let qrLoading = null;
  function ensureQR() {
    if (qrApi()) return Promise.resolve(true);
    if (qrLoading) return qrLoading;
    qrLoading = (async () => {
      for (const src of QR_SCRIPTS) {
        const ok = await new Promise(res => {
          const s = document.createElement('script'); s.src = src;
          s.onload = () => res(true); s.onerror = () => { s.remove(); res(false); };
          document.head.appendChild(s);
        });
        if (ok && qrApi()) return true;
      }
      return false;
    })();
    return qrLoading;
  }
  function drawQR(el, text) {
    el.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'background:#fff;padding:10px;border-radius:12px;line-height:0';
    el.appendChild(wrap);
    switch (qrApi()) {
      case 'toCanvas': {
        const cv = document.createElement('canvas'); wrap.appendChild(cv);
        window.QRCode.toCanvas(cv, text, { width: 200, margin: 0, errorCorrectionLevel: 'M' }, err => { if (err) el.textContent = 'Could not draw QR code'; });
        return true;
      }
      case 'constructor':
        new window.QRCode(wrap, { text, width: 200, height: 200, colorDark: '#000000', colorLight: '#ffffff', correctLevel: window.QRCode.CorrectLevel ? window.QRCode.CorrectLevel.M : undefined });
        return true;
      case 'kazuhiko': {
        const q = window.qrcode(0, 'M'); q.addData(text); q.make();
        wrap.innerHTML = q.createSvgTag ? q.createSvgTag(4, 0) : q.createImgTag(4, 0);
        const c = wrap.firstElementChild; if (c) { c.style.width = '200px'; c.style.height = '200px'; }
        return true;
      }
      case 'qrious': {
        const cv = document.createElement('canvas'); wrap.appendChild(cv);
        new window.QRious({ element: cv, value: text, size: 200 });
        return true;
      }
    }
    return false;
  }

  function shareHTML() {
    const watchOnly = phase === 'playing';
    return '<div class="setup-field" style="margin-top:14px"><label>' + (watchOnly ? 'Invite spectators' : 'Invite friends') + '</label>' +
      (watchOnly ? '' : '<div class="toggleButtonRow" style="margin-bottom:10px"><button type="button" class="toggle-btn' + (qrRole === 'play' ? ' active' : '') + '" id="oQrPlay">Players</button><button type="button" class="toggle-btn' + (qrRole === 'watch' ? ' active' : '') + '" id="oQrWatch">Spectators</button></div>') +
      '<div id="oQR" style="display:flex;justify-content:center;min-height:60px;font-size:12px">Loading QR code…</div>' +
      '<div class="setup-btn-row" style="margin-top:10px"><button id="oCopy">Copy link</button><button id="oShare">Share</button></div></div>';
  }
  function paintShare() {
    const holder = document.getElementById('oShareBox');
    if (!holder || !code) return;
    holder.innerHTML = shareHTML();
    const url = buildUrl(roleNow());
    const el = document.getElementById('oQR'); el.dataset.url = url;
    ensureQR().then(ok => {
      const e2 = document.getElementById('oQR');
      if (!e2 || e2.dataset.url !== url) return;
      let drawn = false;
      if (ok) { try { drawn = drawQR(e2, url); } catch (x) { drawn = false; } }
      if (!drawn) e2.innerHTML = '<div style="text-align:left;word-break:break-all">' + (ok ? 'Could not draw QR code' : 'QR script not found (see QR_SCRIPTS in udc-online.js)') + '. Share this link instead:<br>' + esc(url) + '</div>';
    });
  }
  let shareT;
  const lobbyChanged = e => { if (e.target.id === 'oRounds' || e.target.id === 'oUnl') { clearTimeout(shareT); shareT = setTimeout(paintShare, 300); } };
  box.addEventListener('input', lobbyChanged); box.addEventListener('change', lobbyChanged);

  // ---- settings lock (stops a phone drifting from the host's deck/difficulty/Discord mode) ----
  const LOCK_SEL = '#difficultyRow button, #discordModeCheckbox, #categoryList input, #selectAllCategoriesButton, #deselectAllCategoriesButton';
  function lockSettings(on) {
    document.querySelectorAll(LOCK_SEL).forEach(el => { el.disabled = on; });
    let note = document.getElementById('udcLockNote');
    if (on && !note) {
      note = document.createElement('p'); note.id = 'udcLockNote';
      note.style.cssText = 'font-size:12px;margin:0;padding:10px 16px 0;color:var(--muted)';
      note.textContent = '🔒 Difficulty, categories and Discord mode are locked during an online game.';
      menu.insertBefore(note, menu.firstChild);
    } else if (!on && note) note.remove();
  }

  // ---- "your turn" nudge ----
  function nudge() {
    if (!active || blocked || amSpectator() || finished()) return;
    const cur = order[currentPlayerIndex];
    if (!cur || cur.uid !== uid) return;
    coverCard.classList.add('udc-yourturn');
    nudgeBar.style.display = 'block';
    document.title = '🎯 Your turn! · ' + baseTitle;
    try { vibrate([140, 90, 140, 90, 260]); } catch (x) {}
  }
  function clearNudge() {
    coverCard.classList.remove('udc-yourturn');
    nudgeBar.style.display = 'none';
    document.title = baseTitle;
  }

  // ---- end of game: drinks tally ----
  // Every phone can recompute every card from (seed, n), so the tally needs no extra data on the network.
  function tallyDrinks() {
    const rows = [], by = {};
    segList().forEach(s => s.order.forEach(o => {
      if (!by[o.uid]) { by[o.uid] = { uid: o.uid, name: o.name, colour: o.colour, from: s.from, cards: 0, take: 0, give: 0, total: 0 }; rows.push(by[o.uid]); }
    }));
    let reds = 0, blacks = 0, shared = 0;
    for (let n = 1; n <= curN; n++) {
      const c = cardFor(n), o = whoAt(n), r = o && by[o.uid];
      if (!r) continue;
      r.cards++;
      if (c.type === 'red') reds++;
      if (c.type === 'black') { blacks++; if (!BLACK_CARDS_COUNT) continue; }
      const mult = c.type === 'red' ? 3 : 1, d = parseDrinks(c.rule);
      r.take += d.take * mult; r.give += d.give * mult;
      // "Everyone drinks": every player who was in the game at that card pays.
      if (d.all) { shared++; rows.forEach(x => { if (x.from <= n) x.take += d.all * mult; }); }
    }
    rows.forEach(r => { r.total = r.take + r.give; });
    return { rows, reds, blacks, shared, cards: curN, total: rows.reduce((a, r) => a + r.total, 0) };
  }

  function resultsHTML() {
    const t = tallyDrinks(), done = finished();
    const sorted = t.rows.slice().sort((a, b) => b.total - a.total || String(a.name).localeCompare(String(b.name)));
    const max = sorted.length ? sorted[0].total : 0;
    let h = '<h2>' + (done ? '🏁 Game over' : '🍻 Drinks so far') + '</h2>' +
      '<p class="sub">' + t.cards + ' card' + (t.cards === 1 ? '' : 's') + ' drawn</p>' +
      '<div style="font-size:60px;font-weight:900;line-height:1">' + t.total + '</div>' +
      '<div style="font-size:12px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#555;margin:2px 0 18px">Total drinks</div>';
    h += sorted.map(r => {
      const pct = max ? Math.round(100 * r.total / max) : 0;
      return '<div style="text-align:left;margin-bottom:12px">' +
        '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-weight:700">' +
        '<span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + esc(r.colour || '#999') + ';margin-right:7px"></span>' + esc(r.name || '?') + (r.uid === uid ? ' (you)' : '') + '</span>' +
        '<span style="font-size:20px">' + r.total + '</span></div>' +
        '<div style="height:6px;border-radius:3px;background:rgba(0,0,0,.1);margin:5px 0"><div style="height:100%;width:' + pct + '%;border-radius:3px;background:' + esc(r.colour || '#999') + '"></div></div>' +
        '<div style="font-size:12px;color:#555">🍺 Take ' + r.take + ' · 🎯 Issue ' + r.give + ' · ' + r.cards + ' card' + (r.cards === 1 ? '' : 's') + '</div></div>';
    }).join('');
    if (max > 0) {
      const top = sorted.filter(r => r.total === max).map(r => r.name).join(' & ');
      h += '<p class="sub" style="margin:6px 0 4px"><b>Most drinks:</b> ' + esc(top) + ' (' + max + ')</p>';
    } else if (t.cards) h += '<p class="sub" style="margin:6px 0 4px">No drink cards have turned up yet.</p>';
    const notes = [];
    if (t.reds) notes.push(t.reds + ' red card' + (t.reds === 1 ? '' : 's') + ' counted ×3');
    if (t.blacks && !BLACK_CARDS_COUNT) notes.push(t.blacks + ' inverted (black) card' + (t.blacks === 1 ? '' : 's') + ' not counted');
    if (t.shared) notes.push(t.shared + ' “everyone drinks” card' + (t.shared === 1 ? '' : 's') + ' counted for all players');
    if (notes.length) h += '<p class="sub" style="font-size:12px;margin:0 0 4px">' + esc(notes.join(' · ')) + '</p>';
    h += '<div class="setup-btn-row">' + (done && isHost ? '<button id="oAgain">Play again</button>' : '') + '<button id="oResBack" class="' + (done && isHost ? 'secondary-btn' : '') + '">' + (done ? 'Close' : 'Back') + '</button></div>' +
      '<div class="setup-btn-row"><button class="secondary-btn" id="oLeave">Leave</button></div>' +
      '<p class="sub" style="font-size:11px;opacity:.55;margin:14px 0 0">online script ' + VERSION + '</p>';
    return h;
  }

  function render() {
    if (phase === 'playing' && resultsOpen && !blocked && baseDeck.length && meta) { box.innerHTML = resultsHTML(); return; }
    let h = '<h2>🌐 Online game</h2>';
    if (msg) h += '<p class="sub" style="color:#b00020">' + esc(msg) + '</p>';
    if (phase === 'menu') {
      const inv = pendingInvite;
      if (inv) {
        const ht = hintText(inv);
        h += '<p class="sub"><b>You’ve been invited to game ' + esc(inv.code) + '</b>' + (ht ? '<br>' + esc(ht) : '') + (inv.watch ? '<br>This is a spectator link' : '') + '</p>';
      } else h += '<p class="sub">Everyone plays on their own phone and sees the same cards.</p>';
      h += '<div class="setup-field"><label>Your name</label><div class="playerRow"><input type="text" class="playerNameInput" id="oName" maxlength="16" value="' + esc(saved('udcOnName')) + '"><input type="color" class="playerColourInput" id="oColour" value="' + (saved('udcOnColour') || '#5BFFF4') + '"></div></div>';
      if (!inv) h += '<div class="setup-btn-row"><button id="oHost">Host a game</button></div>';
      h += '<div class="setup-field" style="margin-top:18px"><label>' + (inv ? 'Game code' : 'Or join with a game code') + '</label><div class="playerRow"><input type="text" id="oCode" maxlength="8" placeholder="CODE" autocapitalize="characters" style="text-transform:uppercase" value="' + esc(inv ? inv.code : '') + '"></div></div>' +
        '<div class="setup-btn-row"><button id="oJoin"' + (inv && inv.watch ? ' class="secondary-btn"' : '') + '>Join as player</button><button id="oWatch"' + (inv && !inv.watch ? ' class="secondary-btn"' : '') + '>Watch only</button></div>';
    } else if (phase === 'lobby') {
      h += '<p class="sub">Game code</p><div style="font-size:42px;font-weight:900;letter-spacing:.1em;margin-bottom:12px">' + esc(code) + '</div>';
      h += '<div class="setup-field"><label id="oCount"></label><div id="oRoster"></div></div>';
      if (isHost) {
        h += '<div class="setup-field"><label>Rounds</label><div class="roundsRow"><input type="number" id="oRounds" min="1" value="5" style="width:80px"><label><input type="checkbox" id="oUnl"> Unlimited</label></div></div>' +
          '<p class="sub">Uses your current categories, difficulty and Discord-mode settings. Change them in ⚙️ first; they lock once the game starts.</p>' +
          '<div class="setup-btn-row"><button id="oStart">Start game</button></div>';
      } else if (amSpectator()) h += '<p class="sub">You’re watching. Waiting for the host to start…</p>';
      else h += '<p class="sub">Waiting for the host to start…</p>';
      h += '<div id="oShareBox"></div><div class="setup-btn-row"><button class="secondary-btn" id="oLeave">Leave</button></div>';
    } else {
      h += '<p class="sub">Game <b>' + esc(code) + '</b>' + (isHost ? ' · you are the host (you can draw on anyone’s turn, e.g. if someone is away)' : amSpectator() ? ' · you are watching' : '') + '</p>';
      if (blocked) {
        h += '<p class="sub" style="color:#b00020"><b>⚠️ Your card list doesn’t match the host’s</b> (different app version or cached cards). Drawing and card updates are paused until it matches.</p>' +
          '<div class="setup-btn-row"><button id="oUpdate">Update cards</button><button class="secondary-btn" id="oReload">Reload page</button></div>';
      }
      h += '<div class="setup-field"><label id="oCount"></label><div id="oRoster"></div></div>' +
        '<div id="oLate"></div>' +
        (curN > 0 && !blocked ? '<div class="setup-btn-row"><button id="oResults">🍻 Drinks tally</button></div>' : '') +
        '<div id="oShareBox"></div>' +
        '<div class="setup-btn-row"><button id="oClose">Back to game</button><button class="secondary-btn" id="oLeave">Leave</button></div>';
    }
    h += '<p class="sub" style="font-size:11px;opacity:.55;margin:14px 0 0">online script ' + VERSION + '</p>';
    box.innerHTML = h;
    paintRoster();
    paintShare();
  }

  // Updates only the player list (and Start button), so typed inputs are never wiped.
  function paintRoster() {
    const list = document.getElementById('oRoster'), cnt = document.getElementById('oCount');
    if (!list) return;
    const specs = Object.entries(roster).filter(([, p]) => p && p.spectator).sort(byJoinTime);
    let rows;
    if (phase === 'playing') rows = order.map((o, i) => ({ id: o.uid, name: o.name, colour: o.colour, p: roster[o.uid], turn: i === currentPlayerIndex }));
    else rows = Object.entries(roster).filter(([, p]) => p && !p.spectator).sort(byJoinTime).map(([id, p]) => ({ id, name: p.name, colour: p.colour, p }));
    let html = rows.map(r => {
      const off = !r.p || r.p.online === false;
      return '<div style="text-align:left;padding:4px 0;font-weight:700;opacity:' + (off ? '.45' : '1') + ';color:' + esc(r.colour || '#999') + '">' +
        (r.turn ? '▶ ' : '● ') + esc(r.name || '?') + (r.id === uid ? ' (you)' : '') + (meta && meta.host === r.id ? ' 👑' : '') + (off ? ' · offline' : '') + '</div>';
    }).join('');
    html += specs.map(([id, p]) => '<div style="text-align:left;padding:3px 0;font-weight:600;opacity:' + (p.online === false ? '.4' : '.75') + ';color:' + esc(p.colour || '#999') + '">👀 ' +
      esc(p.name || '?') + (id === uid ? ' (you)' : '') + (p.online === false ? ' · offline' : '') + '</div>').join('');
    list.innerHTML = html;
    if (cnt) cnt.textContent = (phase === 'playing' ? 'Players' : 'Players here') + ' (' + rows.length + ')' + (specs.length ? ' · ' + specs.length + ' watching' : '');

    // People who joined a game already in progress wait here until the host adds them at the start of a round.
    const late = document.getElementById('oLate');
    if (late) {
      const pend = phase === 'playing' ? Object.entries(roster).filter(([id, p]) => p && !p.spectator && p.online !== false && !inGameUid(id)).sort(byJoinTime) : [];
      if (!pend.length) late.innerHTML = '';
      else {
        const ls = segList().slice(-1)[0], k = (curN + 1 - ls.from) % ls.order.length, rem = k === 0 ? 0 : ls.order.length - k, ok = rem === 0 && !finished();
        late.innerHTML = '<div class="setup-field"><label>⏳ Waiting to join (' + pend.length + ')</label>' +
          pend.map(([id, p]) => '<div style="text-align:left;padding:3px 0;font-weight:700;color:' + esc(p.colour || '#999') + '">' + esc(p.name || '?') + (id === uid ? ' (you)' : '') + '</div>').join('') +
          (isHost ? '<div class="setup-btn-row"><button id="oAdmit"' + (ok ? '' : ' disabled') + '>' + (ok ? 'Add to game now' : 'Add after this round (' + rem + ' card' + (rem === 1 ? '' : 's') + ' to go)') + '</button></div>'
                  : '<p class="sub">The host can let you in at the start of the next round.</p>') + '</div>';
      }
    }

    const st = document.getElementById('oStart');
    if (st) { const ok = onlineCount() >= MIN_PLAYERS; st.disabled = !ok; st.textContent = ok ? 'Start game' : 'Need ' + MIN_PLAYERS + '+ players'; }
  }

  box.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.id === 'oCode') {
      const b = document.getElementById(pendingInvite && pendingInvite.watch ? 'oWatch' : 'oJoin'); if (b) b.click();
    }
  });

  box.addEventListener('click', async e => {
    const btn = e.target.closest('button'); const id = btn && btn.id; if (!id) return;
    if (id === 'oClose') overlay.style.display = 'none';
    else if (id === 'oLeave') await leave();
    else if (id === 'oHost' || id === 'oJoin' || id === 'oWatch') {
      const name = (document.getElementById('oName').value || '').trim() || 'Player';
      const colour = document.getElementById('oColour').value;
      keep('udcOnName', name); keep('udcOnColour', colour);
      if (id !== 'oHost') {
        code = (document.getElementById('oCode').value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (pendingInvite && pendingInvite.code !== code) pendingInvite = null;
      }
      await enter(id === 'oHost' ? 'host' : id === 'oWatch' ? 'watch' : 'join', name, colour);
    }
    else if (id === 'oStart') await startGame(btn);
    else if (id === 'oAdmit') await admitLate();
    else if (id === 'oQrPlay' || id === 'oQrWatch') { qrRole = id === 'oQrWatch' ? 'watch' : 'play'; paintShare(); }
    else if (id === 'oCopy') copyLink(buildUrl(roleNow()));
    else if (id === 'oShare') shareLink(buildUrl(roleNow()));
    else if (id === 'oUpdate') await updateCards(btn);
    else if (id === 'oReload') location.reload();
    else if (id === 'oResults') { resultsOpen = true; render(); }
    else if (id === 'oResBack') { resultsOpen = false; render(); overlay.style.display = 'none'; }
    else if (id === 'oAgain') await restartAll();
  });

  // ---- joining / hosting ----
  const randomCode = () => { const A = 'ABCDEFGHJKMNPQRSTUVWXYZ'; let c = ''; for (let i = 0; i < 5; i++) c += A[Math.floor(Math.random() * A.length)]; return c; };

  // Rooms can't be listed (database rules), so each host registers its room in /udcIndex
  // and sweeps any that have expired.
  async function sweepOldRooms() {
    try {
      const old = await db.ref('udcIndex').orderByValue().endAt(Date.now() - ROOM_TTL_MS).limitToFirst(25).once('value');
      const codes = []; old.forEach(c => { codes.push(c.key); });
      await Promise.all(codes.map(async c => {
        try { await db.ref('udc/' + c).remove(); await db.ref('udcIndex/' + c).remove(); } catch (x) {}
      }));
    } catch (x) {}
  }

  // mode: 'host' | 'join' (as player) | 'watch' (as spectator)
  async function enter(mode, name, colour) {
    await ready; if (!uid) return;
    msg = '';
    const spectate = mode === 'watch';
    let late = false;
    if (mode === 'host') {
      let ok = false;
      for (let k = 0; k < 6 && !ok; k++) {
        code = randomCode();
        try {
          // Only create the game if that code is free, so a live game is never overwritten.
          const res = await root().child('meta').transaction(cur => cur ? undefined : { host: uid, started: false, createdAt: Date.now() });
          ok = res.committed;
        } catch (x) { msg = 'Could not create game (' + (x.code || x.message) + ')'; code = null; return render(); }
      }
      if (!ok) { msg = 'Could not find a free game code, try again.'; code = null; return render(); }
      isHost = true;
      db.ref('udcIndex/' + code).set(Date.now()).catch(() => {});
      sweepOldRooms();
    } else {
      if (!code) { msg = 'Type the game code first.'; return render(); }
      let m;
      try { m = (await root().child('meta').once('value')).val(); } catch (x) { msg = 'Could not reach the game (' + (x.code || x.message) + ')'; code = null; return render(); }
      if (!m) { msg = 'No game found with that code.'; code = null; return render(); }
      if (m.started && !spectate && !(m.order || []).some(o => o.uid === uid)) {
        // Not in the starting line-up: either already added by the host later, or a late joiner who waits to be added.
        try {
          const stv = (await root().child('state').once('value')).val();
          late = !toArr(stv && stv.segs).some(s => toArr(s.order).some(o => o.uid === uid));
        } catch (x) { late = true; }
      }
      isHost = m.host === uid;
    }
    const me = root().child('players/' + uid);
    try {
      const ex = (await me.once('value')).val();
      if (ex) await me.update({ name, colour, online: true });
      else await me.set(Object.assign({ name, colour, online: true, t: firebase.database.ServerValue.TIMESTAMP }, spectate ? { spectator: true } : {}));
    } catch (x) { msg = 'Could not join (' + (x.code || x.message) + ')'; code = null; return render(); }
    keep('udcOnSession', code);
    pendingInvite = null;
    phase = 'lobby'; attach(); presence(); render();
    if (late) say('Game in progress. The host can let you in at the next round.');
  }

  // Marks you offline (not removed) when the phone sleeps or loses signal, and back online on reconnect.
  function presence() {
    const me = root().child('players/' + uid), c = db.ref('.info/connected');
    c.on('value', s => { if (s.val() === true) me.onDisconnect().update({ online: false }).then(() => me.update({ online: true })).catch(() => {}); });
    refs.push(c);
  }

  async function leave() {
    const c = code;
    detach();
    try {
      if (c && uid) {
        const r = db.ref('udc/' + c), alone = Object.keys(roster).filter(i => i !== uid).length === 0;
        if (alone) { await r.remove(); db.ref('udcIndex/' + c).remove().catch(() => {}); }   // last one out closes the game
        else if (started) await r.child('players/' + uid + '/online').set(false); // keep your seat so you can rejoin
        else await r.child('players/' + uid).remove();
      }
    } catch (x) {}
    keep('udcOnSession', '');
    location.reload();
  }

  function detach() { clearTimeout(hostTimer); refs.forEach(r => { try { r.off(); } catch (x) {} }); refs = []; }

  async function startGame(btn) {
    if (!isHost || onlineCount() < MIN_PLAYERS) return;
    const cats = [...enabledCategories], disc = isDiscordModeOn();
    const raw = buildRaw(new Set(cats), disc);
    if (!raw.length) { msg = 'No cards in the selected categories. Pick some in ⚙️ first.'; return render(); }
    const unl = document.getElementById('oUnl').checked;
    const rounds = Math.min(999, Math.max(1, parseInt(document.getElementById('oRounds').value, 10) || 5));
    const sorted = Object.entries(roster).filter(([, p]) => p && p.online !== false && !p.spectator).sort(byJoinTime);
    const seed = Math.random().toString(36).slice(2);
    btn.disabled = true;
    try {
      await root().child('meta').transaction(cur => (cur && !cur.started) ? Object.assign({}, cur, {
        started: true, seed, cats, diff: difficulty, discord: disc, rounds, unlimited: unl, sig: deckSig(raw), count: sorted.length,
        total: unl ? 100000 : rounds * sorted.length,
        order: sorted.map(([id, p]) => ({ uid: id, name: p.name, colour: p.colour }))
      }) : undefined);
    } catch (x) { msg = 'Could not start (' + (x.code || x.message) + ')'; render(); }
  }

  // Host only: add everyone waiting to join, at the start of a round.
  async function admitLate() {
    const n = curN;
    const ids = Object.entries(roster).filter(([id, p]) => p && !p.spectator && p.online !== false && !inGameUid(id)).sort(byJoinTime);
    if (!isHost || !ids.length) return;
    const add = ids.map(([id, p]) => ({ uid: id, name: p.name, colour: p.colour }));
    try {
      // Same transaction target as draws, so a join and a draw can never both win.
      const res = await root().child('state').transaction(cur => {
        if (((cur && cur.n) || 0) !== n) return undefined;
        const extras = toArr(cur && cur.segs), l = [{ from: 1, r0: 0, order: baseOrder }].concat(extras), s = l[l.length - 1], k = n + 1 - s.from;
        if (k % s.order.length !== 0) return undefined;   // only at the start of a round
        return Object.assign({}, cur || {}, { n, segs: extras.concat([{ from: n + 1, r0: s.r0 + k / s.order.length, order: s.order.concat(add) }]) });
      });
      say(res.committed ? 'Added ' + add.map(a => a.name).join(', ') : 'A card was just drawn, try again');
    } catch (x) { say('Could not add players: ' + (x.code || x.message)); }
  }

  // ---- sync ----
  function attach() {
    const r = root();
    const on = (ref, fn) => { ref.on('value', fn, x => { msg = x.code || x.message; render(); }); refs.push(ref); };
    on(r.child('players'), s => {
      const prev = roster; roster = s.val() || {};
      if (started) for (const id in roster) {
        if (id === uid || !prev[id]) continue;
        if (prev[id].online !== false && roster[id].online === false) say(roster[id].name + ' disconnected');
        else if (prev[id].online === false && roster[id].online !== false) say(roster[id].name + ' is back');
      }
      paintRoster(); checkHost();
    });
    on(r.child('react'), s => onReact(s.val() || {}));
    on(r.child('meta'), s => {
      const m = s.val();
      if (!m) {
        if (metaSeen) { say('This game was closed'); keep('udcOnSession', ''); setTimeout(() => location.reload(), 1500); }
        return;
      }
      metaSeen = true; meta = m;
      const wasHost = isHost; isHost = m.host === uid;
      if (m.started && !started) {
        // On a refresh this can fire before cards.json has loaded, so wait for it first.
        if (!starting) { starting = true; cardsReady().then(() => { starting = false; if (!started && meta && meta.started) startLocal(meta); }); }
      }
      else if (!m.started && started) resetToLobby();   // host restarted the game
      else if (wasHost !== isHost) { if (isHost) say('You are now the host 👑'); render(); }
      else paintRoster();
      checkHost();
    });
  }

  // If the host's phone has been offline for a while, the earliest remaining player takes over (spectators never host).
  function checkHost() {
    clearTimeout(hostTimer);
    if (!meta || !meta.host) return;
    const h = roster[meta.host];
    if (h && h.online !== false) return;
    hostTimer = setTimeout(async () => {
      const old = meta && meta.host, cur = roster[old];
      if (!old || (cur && cur.online !== false)) return;
      const inGame = id => !started || inGameUid(id);
      const cands = Object.entries(roster).filter(([id, p]) => p && p.online !== false && !p.spectator && inGame(id)).sort(byJoinTime);
      if (!cands.length || cands[0][0] !== uid) return;
      try { await root().child('meta/host').transaction(c => c === old ? uid : undefined); } catch (x) {}
    }, HOST_GRACE_MS);
  }

  // ---- deck (identical on every phone) ----
  function buildRaw(cats, discord) {
    const raw = allCards.filter(g => cats.has(g.Category || '')).flatMap(g =>
      (Array.isArray(g.Rules) ? g.Rules : []).filter(rule => !(discord && shouldRemoveForDiscord(rule)))
        .map(rule => ({ Category: g.Category || '', Colour: g.Colour || g.Color || g.colour || '#999999', Rule: rule })));
    raw.sort((a, b) => a.Category < b.Category ? -1 : a.Category > b.Category ? 1 : a.Rule < b.Rule ? -1 : a.Rule > b.Rule ? 1 : 0);
    return raw;
  }
  const deckSig = raw => raw.length + ':' + xmur3(raw.map(c => c.Category + '\u0001' + c.Rule).join('\u0002'))().toString(36);

  // Each pass through the deck is reshuffled with its own seed, so repeats don't come in the same order.
  function deckFor(cycle) {
    if (!cycles.has(cycle)) { if (cycles.size > 4) cycles.clear(); cycles.set(cycle, shuffled(baseDeck, rngOf(meta.seed + '|deck|' + cycle))); }
    return cycles.get(cycle);
  }

  // Card n is a pure function of (seed, n): nothing but the counter needs to travel over the network.
  // Card colour odds come from the host's difficulty in meta, never from this phone's local setting.
  function cardFor(n) {
    const len = baseDeck.length, card = deckFor(Math.floor((n - 1) / len))[(n - 1) % len];
    const crazy = meta.diff === 'crazy';
    const red = crazy ? CRAZY_RED_CHANCE : NORMAL_RED_CHANCE, black = crazy ? CRAZY_BLACK_CHANCE : NORMAL_BLACK_CHANCE;
    const r = rngOf(meta.seed + '|type|' + n)();
    const type = r < red ? 'red' : r < red + black ? 'black' : 'white';
    const rule = meta.discord ? seededCall(rngOf(meta.seed + '|rule|' + n), () => applyDiscordTransforms(card.Rule)) : card.Rule;
    const content = '<div class="instructionText">' + rule + '</div>' + (type === 'red' ? '<div class="tripleBadge">×3!</div>' : '') +
      '<div class="categoryText" style="color: ' + card.Colour + ';">' + card.Category + '</div>';
    return { type, content, colour: card.Colour, rule: String(rule).replace(/<[^>]*>/g, ' ') };
  }

  function startLocal(m) {
    started = true; active = true; phase = 'playing'; blocked = false;
    baseOrder = toArr(m.order); extraSegs = [];
    enabledCategories = new Set(m.cats || []);
    setDifficulty(m.diff || 'normal');
    discordModeCheckbox.checked = !!m.discord;
    randomiseOrderCheckbox.checked = false;
    trackingEnabled = true; gameStarted = true; syncTurn(0);
    unlimitedRounds = !!m.unlimited; totalRounds = unlimitedRounds ? Infinity : m.rounds;
    baseDeck = buildRaw(new Set(m.cats || []), !!m.discord);
    buildDeckFromEnabledCategories();   // so the "N of total" counter uses the host's categories, not this phone's own
    buildCategoryList(); lockSettings(true);
    closeSetupOverlay(); rebuildAllDraws(); updateTurnTracker();
    overlay.style.display = 'none';
    blocked = !!(m.sig && m.sig !== deckSig(baseDeck));
    warnBar.style.display = blocked ? 'block' : 'none';
    showReactBar();
    if (blocked) overlay.style.display = 'flex';
    render(); keepAwake();
    if (stRef) { try { stRef.off(); } catch (x) {} }
    const st = root().child('state'); stRef = st;
    st.on('value', s => {
      latestState = s.val();
      const segsNow = normSegs(latestState && latestState.segs), wasIn = inGameUid(uid);
      if (JSON.stringify(segsNow) !== JSON.stringify(extraSegs)) {   // the host added late joiners
        extraSegs = segsNow; syncTurn(curN);
        if (!finished()) updateTurnTracker();
        if (!wasIn && inGameUid(uid)) say('You’ve been added to the game 🎉');
        paintRoster(); clearNudge(); setTimeout(nudge, 300);
      }
      if (latestState && latestState.n) applyState(latestState);
      else { clearNudge(); setTimeout(() => { if (!curN) nudge(); }, 500); }   // nothing drawn yet: first player's turn
    });
    refs.push(st);
  }

  // Re-fetch cards.json bypassing the cache, then re-check the signature against the host's.
  async function updateCards(btn) {
    if (btn) btn.disabled = true;
    try {
      const r = await fetch('AppFiles/Data/cards.json', { cache: 'reload' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      allCards = [...(await r.json())];
      rebuildAllDraws();
      baseDeck = buildRaw(new Set(meta.cats || []), !!meta.discord);
      cycles.clear();
      if (meta.sig === deckSig(baseDeck)) {
        blocked = false; msg = ''; warnBar.style.display = 'none'; showReactBar();
        buildDeckFromEnabledCategories(); buildCategoryList(); lockSettings(true);
        overlay.style.display = 'none';
        say('Cards updated');
        if (latestState) applyState(latestState);
        return;
      }
      msg = 'Still different from the host’s list. Try “Reload page”, or ask the host to refresh too.';
    } catch (x) { msg = 'Could not update cards (' + (x.code || x.message) + ')'; }
    render();
  }

  // Everyone drops back to the lobby with a clean local game, ready for the host to start again.
  function resetToLobby() {
    if (stRef) { try { stRef.off(); } catch (x) {} stRef = null; }
    started = false; active = false; phase = 'lobby'; drawing = false; blocked = false; latestState = null;
    lastN = curN = 0; cycles.clear(); baseDeck = []; order = []; baseOrder = []; extraSegs = []; reactSeen = null;
    players = []; trackingEnabled = false; gameStarted = false; currentPlayerIndex = 0; currentRound = 1;
    coverCard.classList.remove('flipped', 'face-up', 'type-black', 'type-red');
    cardFront.classList.remove('type-black', 'type-red');
    showingFront = true;
    cardFront.innerHTML = 'Ultimate Drinking Cards'; cardBack.innerHTML = '';
    resultsOpen = false; clearNudge(); warnBar.style.display = 'none'; lockSettings(false); showReactBar();
    buildDeckFromEnabledCategories(); preloadNextCard(); updateTurnTracker();
    msg = ''; overlay.style.display = 'flex'; render();
    say(isHost ? 'Game restarted' : 'The host restarted the game');
  }

  async function restartAll() {
    try { await root().update({ 'meta/started': false, state: null }); }
    catch (x) { say('Could not restart: ' + (x.code || x.message)); }
  }

  // The menu's Restart / Edit Players buttons only know about local state, so in an online
  // game we catch them first (capture phase on the menu) and handle them here instead.
  menu.addEventListener('click', async e => {
    const b = e.target.closest && e.target.closest('#restartGameButton, #editPlayersButton');
    if (!b || !code) return;
    e.stopImmediatePropagation(); e.preventDefault();
    menu.style.display = 'none';
    if (b.id === 'editPlayersButton') return say('In online games, players join from their own phones');
    if (!active) return say('The game hasn’t started yet');
    if (!isHost) return say('Only the host can restart the game');
    if (!confirm('Restart the game for everyone? You’ll all go back to the lobby.')) return;
    await restartAll();
  }, true);

  function applyState(s) {
    if (!s || !s.n || s.n <= lastN || !baseDeck.length || blocked) return;
    clearNudge();
    const n = s.n;
    lastN = curN = n;
    drawnCount = Math.max(-1, n - 2);   // so the "N of total" counter is right even after a rejoin
    syncTurn(n - 1);                    // the player who drew card n; flipCard() then advances the turn
    const c = cardFor(n);
    cardBack.dataset.content = c.content; cardBack.dataset.type = c.type; cardBack.dataset.categoryColour = c.colour;
    flipCard();                         // plays the normal flip, sounds, flashes, and advances the turn
    if (!finished()) { syncTurn(n); updateTurnTracker(); }   // correct player and round, even across a late join
    paintRoster();
    setTimeout(() => { if (curN === n) nudge(); }, 750);   // after the flip, tell the next player it's their turn
    if (finished()) setTimeout(() => { if (curN === n && !blocked) { resultsOpen = true; overlay.style.display = 'flex'; render(); } }, 2200);   // let the last card land first
  }

  const finished = () => {
    if (unlimitedRounds || !meta) return false;
    const l = segList(), s = l[l.length - 1];
    return curN >= s.from - 1 + (meta.rounds - s.r0) * s.order.length;
  };
  const canDraw = () => !amSpectator() && (isHost || (order[currentPlayerIndex] && order[currentPlayerIndex].uid === uid));

  async function draw() {
    if (drawing) return;
    if (!baseDeck.length) return say('No cards in the selected categories.');
    drawing = true;
    clearNudge();
    const n = curN + 1;
    try {
      const nx = whoAt(n + 1), next = nx ? nx.uid : uid;   // who may draw card n+1
      // Object.assign keeps anything else stored on state (the late-joiner segments).
      const res = await root().child('state').transaction(cur => ((cur && cur.n) || 0) === n - 1 ? Object.assign({}, cur || {}, { n, prev: n - 1, by: uid, next }) : undefined);
      if (!res.committed) say('Someone just drew, hang on…');
    } catch (x) { say('Could not draw: ' + (x.code || x.message)); }
    finally { drawing = false; }
  }

  // Intercept taps on the card while an online game is running.
  function intercept(e) {
    const inLobby = !!code && phase === 'lobby';
    if (!active && !inLobby) return;
    if (e.type === 'keydown' && !(e.key === ' ' || e.key === 'Enter' || e.code === 'Space')) return;
    e.stopImmediatePropagation(); e.preventDefault();
    if (inLobby) { overlay.style.display = 'flex'; render(); return say('Waiting for the host to start'); }
    if (blocked) { overlay.style.display = 'flex'; render(); return say('Update your cards first'); }
    if (amSpectator()) return say('You’re watching. Only players can draw.');
    if (!inGameUid(uid)) return say('Waiting for the host to let you in');
    if (finished()) return say('Game complete! 🎉');
    if (!canDraw()) return say('It’s ' + (players[currentPlayerIndex] ? players[currentPlayerIndex].name : 'someone else') + '’s turn');
    draw();
  }
  coverCard.addEventListener('click', intercept, true);
  coverCard.addEventListener('keydown', intercept, true);

  // ---- keep the screen on during play ----
  async function keepAwake() {
    try {
      if (navigator.wakeLock && document.visibilityState === 'visible' && !wake) {
        wake = await navigator.wakeLock.request('screen');
        wake.addEventListener('release', () => { wake = null; });
      }
    } catch (x) {}
  }
  document.addEventListener('visibilitychange', () => { if (active) keepAwake(); });

  // ---- opened from an invite link ----
  if (invite) { overlay.style.display = 'flex'; render(); }

  // ---- rejoin after a refresh / app switch ----
  (async function resume() {
    const c = saved('udcOnSession'); if (!c) return;
    if (invite && invite.code !== c) return;   // a fresh invite beats an old saved game
    await ready; if (!uid) return;
    await cardsReady();
    try {
      code = c;
      const m = (await root().child('meta').once('value')).val();
      const mine = m && (await root().child('players/' + uid).once('value')).val();
      if (!m || !mine) { code = null; keep('udcOnSession', ''); return; }
      await enter(mine.spectator ? 'watch' : 'join', mine.name, mine.colour);
      if (code) { say('Rejoined game ' + code); if (!m.started) { overlay.style.display = 'flex'; render(); } }
    } catch (x) { code = null; }
  })();
  } // end init
})();
