/* udc-online.js: synchronised online multiplayer for Ultimate Drinking Cards.
   Loaded as a normal <script> AFTER the main script, so it can use the game's own
   globals (players, flipCard, cardBack, allCards, ...). No other edits to index.html needed.
   Everyone sees the same card at the same time. Only the player whose turn it is
   (or the host) can draw. */
const firebaseConfig = {
  apiKey: "AIzaSyA_VbUYyU3Ahe30heFDwpWbrgDvpAc_Sds",
  authDomain: "udc-game.firebaseapp.com",
   databaseURL: "https://udc-game-default-rtdb.europe-west1.firebasedatabase.app/",
  projectId: "udc-game",
  storageBucket: "udc-game.firebasestorage.app",
  messagingSenderId: "953983676607",
  appId: "1:953983676607:web:686c36b8423294a13f960a"
};


  if (!window.firebase) { console.warn('UDC online: Firebase scripts not loaded'); return; }
  firebase.initializeApp(firebaseConfig);
  const db = firebase.database();

  // ---- seeded randomness (same on every phone) ----
  function xmur3(s) { let h = 1779033703 ^ s.length; for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return h >>> 0; }; }
  function mulberry32(a) { return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const rngOf = s => mulberry32(xmur3(s)());
  function shuffled(arr, rng) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // ---- state ----
  let uid = null, code = null, isHost = false, meta = null, started = false, active = false;
  let roster = {}, order = [], deck = [], curN = 0, lastN = 0, refs = [], phase = 'menu', msg = '';
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
  toast.style.cssText = 'position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:#000c;color:#fff;padding:8px 14px;border-radius:999px;font:700 13px Tahoma,sans-serif;z-index:1500;display:none';
  document.body.appendChild(toast);
  let toastT; function say(t) { toast.textContent = t; toast.style.display = 'block'; clearTimeout(toastT); toastT = setTimeout(() => { toast.style.display = 'none'; }, 2200); }

  openBtn.addEventListener('click', () => { menu.style.display = 'none'; overlay.style.display = 'flex'; render(); });
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.style.display = 'none'; });

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const saved = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
  const keep = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

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
      h += '<div class="setup-field"><label>Players here (' + Object.keys(roster).length + ')</label>';
      Object.entries(roster).sort((a, b) => (a[1].t || 0) - (b[1].t || 0)).forEach(([id, p]) => { h += '<div style="text-align:left;padding:4px 0;font-weight:700;color:' + esc(p.colour || '#999') + '">● ' + esc(p.name) + (id === uid ? ' (you)' : '') + '</div>'; });
      h += '</div>';
      if (isHost) {
        h += '<div class="setup-field"><label>Rounds</label><div class="roundsRow"><input type="number" id="oRounds" min="1" value="5" style="width:80px"><label><input type="checkbox" id="oUnl"> Unlimited</label></div></div>' +
          '<p class="sub">Uses your current categories, difficulty and Discord-mode settings. Change them in ⚙️ first.</p>' +
          '<div class="setup-btn-row"><button id="oStart">Start game</button></div>';
      } else h += '<p class="sub">Waiting for the host to start…</p>';
      h += '<div class="setup-btn-row"><button class="secondary-btn" id="oLeave">Leave</button></div>';
    } else {
      h += '<p class="sub">Game <b>' + esc(code) + '</b> · ' + order.length + ' players' + (isHost ? ' · you are the host (you can draw on anyone’s turn)' : '') + '</p>' +
        '<div class="setup-btn-row"><button id="oClose">Back to game</button><button class="secondary-btn" id="oLeave">Leave</button></div>';
    }
    box.innerHTML = h;
  }

  box.addEventListener('click', async e => {
    const id = e.target.id; if (!id) return;
    if (id === 'oClose') overlay.style.display = 'none';
    if (id === 'oLeave') { try { if (code && uid) await root().child('players/' + uid).remove(); } catch (x) {} location.reload(); }
    if (id === 'oHost' || id === 'oJoin') {
      const name = (document.getElementById('oName').value || '').trim() || 'Player';
      const colour = document.getElementById('oColour').value;
      keep('udcOnName', name); keep('udcOnColour', colour);
      await ready; if (!uid) return;
      msg = '';
      if (id === 'oHost') {
        const A = 'ABCDEFGHJKMNPQRSTUVWXYZ'; code = ''; for (let i = 0; i < 5; i++) code += A[Math.floor(Math.random() * A.length)];
        try { await root().child('meta').set({ host: uid, started: false }); } catch (x) { msg = 'Could not create game (' + (x.code || x.message) + ')'; code = null; return render(); }
        isHost = true;
      } else {
        code = (document.getElementById('oCode').value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (!code) { msg = 'Type the game code first.'; return render(); }
        const m = await root().child('meta').once('value').catch(() => null);
        if (!m || !m.val()) { msg = 'No game found with that code.'; code = null; return render(); }
        isHost = m.val().host === uid;
      }
      const me = root().child('players/' + uid);
      await me.set({ name, colour, t: firebase.database.ServerValue.TIMESTAMP }).catch(x => { msg = 'Could not join (' + (x.code || x.message) + ')'; });
      me.onDisconnect().remove();
      phase = 'lobby'; attach(); render();
    }
    if (id === 'oStart') {
      const sorted = Object.entries(roster).sort((a, b) => (a[1].t || 0) - (b[1].t || 0));
      if (!sorted.length) return;
      const unl = document.getElementById('oUnl').checked;
      await root().child('meta').update({
        started: true, seed: Math.random().toString(36).slice(2), cats: [...enabledCategories], diff: difficulty,
        discord: isDiscordModeOn(), rounds: Math.max(1, parseInt(document.getElementById('oRounds').value, 10) || 5), unlimited: unl,
        order: sorted.map(([id, p]) => ({ uid: id, name: p.name, colour: p.colour }))
      }).catch(x => { msg = 'Could not start (' + (x.code || x.message) + ')'; render(); });
    }
  });

  // ---- sync ----
  function attach() {
    const r = root();
    const on = (ref, fn) => { ref.on('value', fn, x => { msg = x.code || x.message; render(); }); refs.push(ref); };
    on(r.child('players'), s => { roster = s.val() || {}; if (phase === 'lobby') render(); });
    on(r.child('meta'), s => { meta = s.val(); if (meta && meta.started && !started) startLocal(meta); });
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
    // Same canonical, seeded deck on every phone.
    const cats = new Set(m.cats || []);
    const raw = allCards.filter(g => cats.has(g.Category || '')).flatMap(g =>
      (Array.isArray(g.Rules) ? g.Rules : []).filter(rule => !(m.discord && shouldRemoveForDiscord(rule)))
        .map(rule => ({ Category: g.Category || '', Colour: g.Colour || g.Color || g.colour || '#999999', Rule: rule })));
    raw.sort((a, b) => a.Category < b.Category ? -1 : a.Category > b.Category ? 1 : a.Rule < b.Rule ? -1 : a.Rule > b.Rule ? 1 : 0);
    deck = shuffled(raw, rngOf(m.seed + '|deck'));
    closeSetupOverlay(); rebuildAllDraws(); updateTurnTracker();
    overlay.style.display = 'none'; render();
    const st = root().child('state');
    st.on('value', s => applyState(s.val())); refs.push(st);
  }

  function applyState(s) {
    if (!s || s.n <= lastN) return;
    lastN = curN = s.n;
    currentPlayerIndex = s.t; currentRound = s.r;
    cardBack.dataset.content = s.content; cardBack.dataset.type = s.type; cardBack.dataset.categoryColour = s.colour;
    flipCard();                         // plays the normal flip, sounds, flashes, and advances the turn
  }

  const finished = () => !unlimitedRounds && curN >= totalRounds * players.length;
  const canDraw = () => isHost || (order[currentPlayerIndex] && order[currentPlayerIndex].uid === uid);

  async function draw() {
    if (!deck.length) return say('No cards in the selected categories.');
    const n = curN + 1, card = deck[(n - 1) % deck.length];
    const r = rngOf(meta.seed + '|type|' + n)();
    const type = r < RED_CHANCE ? 'red' : r < RED_CHANCE + BLACK_CHANCE ? 'black' : 'white';
    const rule = meta.discord ? applyDiscordTransforms(card.Rule) : card.Rule;
    const content = '<div class="instructionText">' + rule + '</div>' + (type === 'red' ? '<div class="tripleBadge">×3!</div>' : '') +
      '<div class="categoryText" style="color: ' + card.Colour + ';">' + card.Category + '</div>';
    const next = { n, t: currentPlayerIndex, r: currentRound, type, content, colour: card.Colour, by: uid };
    try { await root().child('state').transaction(cur => ((cur && cur.n) || 0) === curN ? next : undefined); }
    catch (x) { say('Could not draw: ' + (x.code || x.message)); }
  }

  // Intercept taps on the card while an online game is running.
  function intercept(e) {
    if (!active) return;
    if (e.type === 'keydown' && !(e.key === ' ' || e.key === 'Enter' || e.code === 'Space')) return;
    e.stopImmediatePropagation(); e.preventDefault();
    if (finished()) return say('Game complete! 🎉');
    if (!canDraw()) return say('It’s ' + (players[currentPlayerIndex] ? players[currentPlayerIndex].name : 'someone else') + '’s turn');
    draw();
  }
  coverCard.addEventListener('click', intercept, true);
  coverCard.addEventListener('keydown', intercept, true);
})();
