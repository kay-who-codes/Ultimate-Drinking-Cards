/* udc-online.js: synchronised online multiplayer for Ultimate Drinking Cards.
   Loaded as a normal <script> AFTER the main script, so it can use the game's own
   globals (players, flipCard, cardBack, allCards, ...). No other edits to index.html needed.
   Everyone sees the same card at the same time. Only the player whose turn it is
   (or the host) can draw. */
(() => {
  const VERSION = 'v6';

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
  // Resolves once the main script has loaded cards.json (gives up after ~15s).
  const cardsReady = () => new Promise(res => { let t = 0; (function chk() { if (allCards.length || t++ > 150) res(); else setTimeout(chk, 100); })(); });
  const cycles = new Map();
  const ready = firebase.auth().signInAnonymously().then(c => { uid = c.user.uid; }).catch(e => { msg = 'Sign-in failed: ' + (e.code || e.message); render(); });
  const root = () => db.ref('udc/' + code);

  // ---- UI ----
  const menu = document.getElementById('themeMenu');
  const sec = document.createElement('div'); sec.className = 'menuSection';
  const openBtn = document.createElement('button'); openBtn.className = 'menu-action'; openBtn.textContent = '🌐 Online game';
  sec.appendChild(openBtn); menu.appendChild(sec);

  const overlay = document.createElement('div'); overlay.className = 'overlay';
  overlay.innerHTML = '<div class="setup-box" id="udcOnlineBox"></div>';
  document.body.appendChild(overlay);
  const box = overlay.firstChild;
  const toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:#000c;color:#fff;padding:8px 14px;border-radius:999px;font:700 13px Tahoma,sans-serif;z-index:1500;display:none;max-width:90vw;text-align:center';
  document.body.appendChild(toast);
  let toastT; function say(t) { toast.textContent = t; toast.style.display = 'block'; clearTimeout(toastT); toastT = setTimeout(() => { toast.style.display = 'none'; }, 2600); }

  openBtn.addEventListener('click', () => { menu.style.display = 'none'; overlay.style.display = 'flex'; render(); });
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.style.display = 'none'; });

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const saved = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
  const keep = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

  const byJoinTime = (a, b) => (a[1].t || 0) - (b[1].t || 0);
  const onlineCount = () => Object.values(roster).filter(p => p && p.online !== false).length;

  function render() {
    let h = '<h2>🌐 Online game</h2>';
    if (msg) h += '<p class="sub" style="color:#b00020">' + esc(msg) + '</p>';
    if (phase === 'menu') {
      h += '<p class="sub">Everyone plays on their own phone and sees the same cards.</p>' +
        '<div class="setup-field"><label>Your name</label><div class="playerRow"><input type="text" class="playerNameInput" id="oName" maxlength="16" value="' + esc(saved('udcOnName')) + '"><input type="color" class="playerColourInput" id="oColour" value="' + (saved('udcOnColour') || '#5BFFF4') + '"></div></div>' +
        '<div class="setup-btn-row"><button id="oHost">Host a game</button></div>' +
        '<div class="setup-field" style="margin-top:18px"><label>Or join with a game code</label><div class="playerRow"><input type="text" id="oCode" maxlength="8" placeholder="CODE" autocapitalize="characters" style="text-transform:uppercase"><button class="primary-btn" id="oJoin" style="flex:0 0 auto;padding:11px 18px">Join</button></div></div>';
    } else if (phase === 'lobby') {
      h += '<p class="sub">Game code</p><div style="font-size:42px;font-weight:900;letter-spacing:.1em;margin-bottom:12px">' + esc(code) + '</div>';
      h += '<div class="setup-field"><label id="oCount"></label><div id="oRoster"></div></div>';
      if (isHost) {
        h += '<div class="setup-field"><label>Rounds</label><div class="roundsRow"><input type="number" id="oRounds" min="1" value="5" style="width:80px"><label><input type="checkbox" id="oUnl"> Unlimited</label></div></div>' +
          '<p class="sub">Uses your current categories, difficulty and Discord-mode settings. Change them in ⚙️ first.</p>' +
          '<div class="setup-btn-row"><button id="oStart">Start game</button></div>';
      } else h += '<p class="sub">Waiting for the host to start…</p>';
      h += '<div class="setup-btn-row"><button class="secondary-btn" id="oLeave">Leave</button></div>';
    } else {
      h += '<p class="sub">Game <b>' + esc(code) + '</b>' + (isHost ? ' · you are the host (you can draw on anyone’s turn, e.g. if someone is away)' : '') + '</p>' +
        '<div class="setup-field"><label id="oCount"></label><div id="oRoster"></div></div>' +
        '<div class="setup-btn-row"><button id="oClose">Back to game</button><button class="secondary-btn" id="oLeave">Leave</button></div>';
    }
    h += '<p class="sub" style="font-size:11px;opacity:.55;margin:14px 0 0">online script ' + VERSION + '</p>';
    box.innerHTML = h;
    paintRoster();
  }

  // Updates only the player list (and Start button), so typed inputs are never wiped.
  function paintRoster() {
    const list = document.getElementById('oRoster'), cnt = document.getElementById('oCount');
    if (!list) return;
    let rows;
    if (phase === 'playing') rows = order.map((o, i) => ({ id: o.uid, name: o.name, colour: o.colour, p: roster[o.uid], turn: i === currentPlayerIndex }));
    else rows = Object.entries(roster).sort(byJoinTime).map(([id, p]) => ({ id, name: p.name, colour: p.colour, p }));
    list.innerHTML = rows.map(r => {
      const off = !r.p || r.p.online === false;
      return '<div style="text-align:left;padding:4px 0;font-weight:700;opacity:' + (off ? '.45' : '1') + ';color:' + esc(r.colour || '#999') + '">' +
        (r.turn ? '▶ ' : '● ') + esc(r.name || '?') + (r.id === uid ? ' (you)' : '') + (meta && meta.host === r.id ? ' 👑' : '') + (off ? ' · offline' : '') + '</div>';
    }).join('');
    if (cnt) cnt.textContent = (phase === 'playing' ? 'Players' : 'Players here') + ' (' + rows.length + ')';
    const st = document.getElementById('oStart');
    if (st) { const ok = onlineCount() >= MIN_PLAYERS; st.disabled = !ok; st.textContent = ok ? 'Start game' : 'Need ' + MIN_PLAYERS + '+ players'; }
  }

  box.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'oCode') { const b = document.getElementById('oJoin'); if (b) b.click(); } });

  box.addEventListener('click', async e => {
    const btn = e.target.closest('button'); const id = btn && btn.id; if (!id) return;
    if (id === 'oClose') overlay.style.display = 'none';
    if (id === 'oLeave') await leave();
    if (id === 'oHost' || id === 'oJoin') {
      const name = (document.getElementById('oName').value || '').trim() || 'Player';
      const colour = document.getElementById('oColour').value;
      keep('udcOnName', name); keep('udcOnColour', colour);
      if (id === 'oJoin') code = (document.getElementById('oCode').value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      await enter(id === 'oHost' ? 'host' : 'join', name, colour);
    }
    if (id === 'oStart') await startGame(btn);
  });

  // ---- joining / hosting ----
  const randomCode = () => { const A = 'ABCDEFGHJKMNPQRSTUVWXYZ'; let c = ''; for (let i = 0; i < 5; i++) c += A[Math.floor(Math.random() * A.length)]; return c; };

  async function enter(mode, name, colour) {
    await ready; if (!uid) return;
    msg = '';
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
    } else {
      if (!code) { msg = 'Type the game code first.'; return render(); }
      let m;
      try { m = (await root().child('meta').once('value')).val(); } catch (x) { msg = 'Could not reach the game (' + (x.code || x.message) + ')'; code = null; return render(); }
      if (!m) { msg = 'No game found with that code.'; code = null; return render(); }
      if (m.started && !(m.order || []).some(o => o.uid === uid)) { msg = 'That game has already started.'; code = null; return render(); }
      isHost = m.host === uid;
    }
    const me = root().child('players/' + uid);
    try {
      const ex = (await me.once('value')).val();
      if (ex) await me.update({ name, colour, online: true });
      else await me.set({ name, colour, online: true, t: firebase.database.ServerValue.TIMESTAMP });
    } catch (x) { msg = 'Could not join (' + (x.code || x.message) + ')'; code = null; return render(); }
    keep('udcOnSession', code);
    phase = 'lobby'; attach(); presence(); render();
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
        if (alone) await r.remove();                                         // last one out closes the game
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
    const rounds = Math.max(1, parseInt(document.getElementById('oRounds').value, 10) || 5);
    const sorted = Object.entries(roster).filter(([, p]) => p.online !== false).sort(byJoinTime);
    const seed = Math.random().toString(36).slice(2);
    btn.disabled = true;
    try {
      await root().child('meta').transaction(cur => (cur && !cur.started) ? Object.assign({}, cur, {
        started: true, seed, cats, diff: difficulty, discord: disc, rounds, unlimited: unl, sig: deckSig(raw),
        order: sorted.map(([id, p]) => ({ uid: id, name: p.name, colour: p.colour }))
      }) : undefined);
    } catch (x) { msg = 'Could not start (' + (x.code || x.message) + ')'; render(); }
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

  // If the host's phone has been offline for a while, the earliest remaining player takes over.
  function checkHost() {
    clearTimeout(hostTimer);
    if (!meta || !meta.host) return;
    const h = roster[meta.host];
    if (h && h.online !== false) return;
    hostTimer = setTimeout(async () => {
      const old = meta && meta.host, cur = roster[old];
      if (!old || (cur && cur.online !== false)) return;
      const inGame = id => !started || order.some(o => o.uid === id);
      const cands = Object.entries(roster).filter(([id, p]) => p.online !== false && inGame(id)).sort(byJoinTime);
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
  function cardFor(n) {
    const len = baseDeck.length, card = deckFor(Math.floor((n - 1) / len))[(n - 1) % len];
    const r = rngOf(meta.seed + '|type|' + n)();
    const type = r < RED_CHANCE ? 'red' : r < RED_CHANCE + BLACK_CHANCE ? 'black' : 'white';
    const rule = meta.discord ? seededCall(rngOf(meta.seed + '|rule|' + n), () => applyDiscordTransforms(card.Rule)) : card.Rule;
    const content = '<div class="instructionText">' + rule + '</div>' + (type === 'red' ? '<div class="tripleBadge">×3!</div>' : '') +
      '<div class="categoryText" style="color: ' + card.Colour + ';">' + card.Category + '</div>';
    return { type, content, colour: card.Colour };
  }

  function startLocal(m) {
    started = true; active = true; phase = 'playing';
    order = m.order || [];
    enabledCategories = new Set(m.cats || []);
    setDifficulty(m.diff || 'normal');
    discordModeCheckbox.checked = !!m.discord;
    randomiseOrderCheckbox.checked = false;
    players = order.map(p => ({ name: p.name, colour: p.colour }));
    trackingEnabled = true; gameStarted = true; currentPlayerIndex = 0; currentRound = 1;
    unlimitedRounds = !!m.unlimited; totalRounds = unlimitedRounds ? Infinity : m.rounds;
    baseDeck = buildRaw(new Set(m.cats || []), !!m.discord);
    buildDeckFromEnabledCategories();   // so the "N of total" counter uses the host's categories, not this phone's own
    closeSetupOverlay(); rebuildAllDraws(); updateTurnTracker();
    overlay.style.display = 'none';
    if (m.sig && m.sig !== deckSig(baseDeck)) {
      msg = 'Your card list differs from the host’s (different app version?). Refresh this page, or cards may not match.';
      overlay.style.display = 'flex';
    }
    render(); keepAwake();
    if (stRef) { try { stRef.off(); } catch (x) {} }
    const st = root().child('state'); stRef = st;
    st.on('value', s => applyState(s.val())); refs.push(st);
  }

  // Everyone drops back to the lobby with a clean local game, ready for the host to start again.
  function resetToLobby() {
    if (stRef) { try { stRef.off(); } catch (x) {} stRef = null; }
    started = false; active = false; phase = 'lobby'; drawing = false;
    lastN = curN = 0; cycles.clear(); baseDeck = []; order = [];
    players = []; trackingEnabled = false; gameStarted = false; currentPlayerIndex = 0; currentRound = 1;
    coverCard.classList.remove('flipped', 'face-up', 'type-black', 'type-red');
    cardFront.classList.remove('type-black', 'type-red');
    showingFront = true;
    cardFront.innerHTML = 'Ultimate Drinking Cards'; cardBack.innerHTML = '';
    buildDeckFromEnabledCategories(); preloadNextCard(); updateTurnTracker();
    msg = ''; overlay.style.display = 'flex'; render();
    say(isHost ? 'Game restarted' : 'The host restarted the game');
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
    try { await root().update({ 'meta/started': false, state: null }); }
    catch (x) { say('Could not restart: ' + (x.code || x.message)); }
  }, true);

  function applyState(s) {
    if (!s || !s.n || s.n <= lastN || !baseDeck.length) return;
    const n = s.n, len = order.length || 1;
    lastN = curN = n;
    drawnCount = Math.max(-1, n - 2);   // so the "N of total" counter is right even after a rejoin
    // Turn and round come straight from the counter, so a phone that rejoins late lands in the right place.
    currentPlayerIndex = (n - 1) % len; currentRound = Math.floor((n - 1) / len) + 1;
    const c = cardFor(n);
    cardBack.dataset.content = c.content; cardBack.dataset.type = c.type; cardBack.dataset.categoryColour = c.colour;
    flipCard();                         // plays the normal flip, sounds, flashes, and advances the turn
    paintRoster();
  }

  const finished = () => !unlimitedRounds && curN >= totalRounds * players.length;
  const canDraw = () => isHost || (order[currentPlayerIndex] && order[currentPlayerIndex].uid === uid);

  async function draw() {
    if (drawing) return;
    if (!baseDeck.length) return say('No cards in the selected categories.');
    drawing = true;
    const n = curN + 1;
    try {
      const res = await root().child('state').transaction(cur => ((cur && cur.n) || 0) === n - 1 ? { n, by: uid } : undefined);
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

  // ---- rejoin after a refresh / app switch ----
  (async function resume() {
    const c = saved('udcOnSession'); if (!c) return;
    await ready; if (!uid) return;
    await cardsReady();
    try {
      code = c;
      const m = (await root().child('meta').once('value')).val();
      const mine = m && (await root().child('players/' + uid).once('value')).val();
      if (!m || !mine) { code = null; keep('udcOnSession', ''); return; }
      await enter('join', mine.name, mine.colour);
      if (code) { say('Rejoined game ' + code); if (!m.started) { overlay.style.display = 'flex'; render(); } }
    } catch (x) { code = null; }
  })();
  } // end init
})();
