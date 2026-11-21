/* udc-online.js: Ultimate Drinking Cards online multiplayer */
(() => {
  const VERSION = 'v19';
  const QR_SCRIPTS = ['qrcode.min.js', 'qrcode.js'];

  const BLACK_CARDS_COUNT = false;
  const NUM_WORDS = {
    a: 1, an: 1, one: 1, two: 2, three: 3,
    four: 4, five: 5, six: 6, seven: 7,
    eight: 8, nine: 9, ten: 10
  };
  const NUM_PAT = '(a|an|one|two|three|four|five|six|seven|eight|nine|ten|\\d{1,2})';
  const DRINK_PAT = '\\s+(?:more\\s+)?(?:(?:big|large|small|full|long|quick|huge|good|massive)\\s+)?(?:drinks?|swigs?)\\b';
  const TAKE_RE = new RegExp('\\b(?:take|takes|have|has)\\s+' + NUM_PAT + DRINK_PAT, 'gi');
  const GIVE_RE = new RegExp('\\b(?:issue|issues|give|gives|hand out|hands out|assign|assigns|distribute|distributes|dish out|dishes out)\\s+(?:out\\s+)?' + NUM_PAT + DRINK_PAT, 'gi');

  function numOf(x) {
    x = String(x).toLowerCase();
    return Object.prototype.hasOwnProperty.call(NUM_WORDS, x)
      ? NUM_WORDS[x] : (parseInt(x, 10) || 0);
  }

  function parseDrinks(rule) {
    const t = String(rule).replace(/<[^>]*>/g, ' ');
    let take = 0, give = 0, m;
    TAKE_RE.lastIndex = 0;
    while ((m = TAKE_RE.exec(t))) take += numOf(m[1]);
    GIVE_RE.lastIndex = 0;
    while ((m = GIVE_RE.exec(t))) give += numOf(m[1]);
    return { take, give };
  }

  if (/[?&]online=0\b/.test(location.search)) {
    console.info('UDC online: disabled by ?online=0');
    return;
  }

  window.__udcErrors = [];

  function showError(what) {
    try {
      window.__udcErrors.push(what);
      console.error('UDC online:', what);
      let b = document.getElementById('udcErrBanner');
      if (!b) {
        b = document.createElement('div');
        b.id = 'udcErrBanner';
        b.style.cssText = 'position:fixed;left:8px;right:8px;top:8px;z-index:3000;background:#b00020;color:#fff;font:12px/1.3 Tahoma,sans-serif;padding:8px 10px;border-radius:8px;pointer-events:none;white-space:pre-wrap;word-break:break-word;max-height:40vh;overflow:hidden';
        document.body.appendChild(b);
      }
      b.textContent = 'Online script ' + VERSION + ' error:\n' +
        window.__udcErrors.slice(-3).join('\n');
      b.style.display = 'block';
      clearTimeout(b._t);
      b._t = setTimeout(() => {
        b.style.display = 'none';
      }, 20000);
    } catch (e) {}
  }

  window.addEventListener('error', e => {
    if (!e.filename || /udc-online/.test(e.filename)) {
      showError((e.message || 'error') +
        (e.lineno ? ' (line ' + e.lineno + ')' : ''));
    }
  });

  window.addEventListener('unhandledrejection', e => {
    const r = e.reason;
    showError('Promise: ' + ((r && (r.code || r.message)) || r));
  });

  try {
    init();
  } catch (e) {
    showError('Startup: ' + (e && e.message || e));
  }

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

    const MIN_PLAYERS = 1;
    const HOST_GRACE_MS = 6000;

    if (!window.firebase) {
      console.warn('UDC online: Firebase scripts not loaded');
      return;
    }

    firebase.initializeApp(firebaseConfig);
    const db = firebase.database();

    const qs = new URLSearchParams(location.search);
    const invite = (() => {
      const c = (qs.get('join') || '')
        .toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      if (!c) return null;
      const d = qs.get('diff'), r = qs.get('rounds');
      return {
        code: c,
        watch: qs.get('role') === 'watch',
        diff: (d === 'crazy' || d === 'normal') ? d : '',
        rounds: r === 'u' ? 'u' :
          (/^\d{1,3}$/.test(r || '') ? r : ''),
        dm: qs.get('dm') === '1'
      };
    })();

    let pendingInvite = invite;

    if (invite) {
      ['join', 'role', 'diff', 'rounds', 'dm']
        .forEach(k => qs.delete(k));
      const q = qs.toString();
      try {
        history.replaceState(null, '',
          location.pathname + (q ? '?' + q : '') + location.hash);
      } catch (e) {}
    }

    function xmur3(s) {
      let h = 1779033703 ^ s.length;
      for (let i = 0; i < s.length; i++) {
        h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
      }
      return () => {
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        h ^= h >>> 16;
        return h >>> 0;
      };
    }

    function mulberry32(a) {
      return () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    const rngOf = s => mulberry32(xmur3(s)());

    function shuffled(arr, rng) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    function seededCall(rng, fn) {
      const orig = Math.random;
      Math.random = rng;
      try {
        return fn();
      } finally {
        Math.random = orig;
      }
    }

    let uid = null, code = null, isHost = false;
    let meta = null, metaSeen = false;
    let started = false, active = false;
    let roster = {}, order = [], baseDeck = [];
    let curN = 0, lastN = 0, refs = [];
    let phase = 'menu', msg = '';
    let drawing = false, hostTimer = null;
    let wake = null, stRef = null, starting = false;
    let blocked = false, latestState = null;
    let playingSeed, lobbyDraft;
    let roundActionPending = false;
    let qrRole = 'play', resultsOpen = false;
    let connected = true, presenceRef = null;
    let presenceCallback = null, disconnectRef = null;

    const baseTitle = document.title;
    const amSpectator = () =>
      !!(roster[uid] && roster[uid].spectator);

    const cardsReady = () => new Promise(res => {
      let t = 0;
      (function chk() {
        if (allCards.length || t++ > 150) res();
        else setTimeout(chk, 100);
      })();
    });

    const cycles = new Map();

    const ready = firebase.auth().signInAnonymously()
      .then(c => {
        uid = c.user.uid;
      })
      .catch(e => {
        msg = 'Sign-in failed: ' + (e.code || e.message);
        render();
      });

    const root = () => db.ref('udc/' + code);

    const menu = document.getElementById('themeMenu');
    const openBtn = document.getElementById('multiplayerButton');

    const css = document.createElement('style');
    css.textContent =
      '@keyframes udcTurnPulse{0%,100%{outline-color:transparent}50%{outline-color:var(--accent)}}' +
      '#coverCard.udc-yourturn{outline:3px solid var(--accent);outline-offset:6px;animation:udcTurnPulse 1.2s ease-in-out infinite}' +
      '@media (prefers-reduced-motion:reduce){#coverCard.udc-yourturn{animation:none;outline-color:var(--accent)}}';
    css.textContent +=
      '#udcOnlineBox.udc-lobby{box-sizing:border-box;width:100%;max-width:640px}' +
      '.udcLobbyInvite{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;align-items:start}' +
      '.udcLobbySettings summary{cursor:pointer;font-weight:700;color:var(--muted);margin:8px 0}' +
      '@media(max-width:440px){.udcLobbyInvite{grid-template-columns:1fr}}' +
      '#udcRoomInvite{position:relative;z-index:20;color:var(--panel-text)}' +
      '#udcRoomCode{border:1px solid var(--accent);border-radius:999px;padding:6px 14px;background:var(--panel-bg);color:inherit;font:700 14px Tahoma,sans-serif;cursor:pointer}' +
      '#udcRoomQRPanel{position:fixed;inset:0;box-sizing:border-box;width:264px;max-width:calc(100vw - 24px);max-height:calc(100% - 24px);margin:auto;padding:0;border:0;border-radius:16px;background:var(--panel-bg);color:var(--panel-text);text-align:center;box-shadow:0 12px 40px #0008}' +
      '#udcRoomQRPanel::backdrop{background:rgba(0,0,0,.72)}' +
      '#udcRoomQRPanel form{padding:16px}' +
      '#udcRoomQRTitle{margin:0 0 12px;font:700 20px Tahoma,sans-serif}' +
      '#udcRoomQRClose{display:block;margin:12px auto 0;padding:6px 14px;border:1px solid var(--accent);border-radius:999px;background:var(--panel-bg);color:inherit;cursor:pointer}' +
      '#udcRoomQR{display:flex;justify-content:center;font-size:13px}' +
      '#udcRoomJoinLink{display:inline-block;margin-top:6px;color:inherit}';
    document.head.appendChild(css);

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML =
      '<div class="setup-box" id="udcOnlineBox"></div>';
    document.body.appendChild(overlay);
    const box = overlay.firstChild;

    // ---- Live emoji reactions ----
    const REACTION_DEFAULTS = ['🍻', '🥴', '😂', '💀'];

    const reactionBar = document.createElement('div');
    reactionBar.id = 'udcReactionBar';
    reactionBar.setAttribute('aria-label', 'Game reactions');
    reactionBar.innerHTML =
      '<span class="udcReactionHint">Hold an emoji to customise</span>' +
      '<div class="udcReactionButtons"></div>';

    const reactionButtons =
      reactionBar.querySelector('.udcReactionButtons');

    const cardEl = document.getElementById('coverCard');
    const roomInvite = document.createElement('div');
    roomInvite.id = 'udcRoomInvite';
    roomInvite.hidden = true;
    roomInvite.innerHTML =
      '<button type="button" id="udcRoomCode" aria-haspopup="dialog" aria-expanded="false" aria-controls="udcRoomQRPanel"></button>';
    cardEl.insertAdjacentElement('beforebegin', roomInvite);

    const roomCodeButton = roomInvite.querySelector('#udcRoomCode');
    const roomQRPanel = document.createElement('dialog');
    roomQRPanel.id = 'udcRoomQRPanel';
    roomQRPanel.setAttribute('aria-labelledby', 'udcRoomQRTitle');
    roomQRPanel.innerHTML =
      '<form method="dialog"><h2 id="udcRoomQRTitle"></h2>' +
      '<div id="udcRoomQR" role="status"></div>' +
      '<a id="udcRoomJoinLink">Join as player</a>' +
      '<button id="udcRoomQRClose" autofocus>Close</button></form>';
    document.body.appendChild(roomQRPanel);

    const roomQRTitle = roomQRPanel.querySelector('#udcRoomQRTitle');
    const roomQR = roomQRPanel.querySelector('#udcRoomQR');
    const roomJoinLink = roomQRPanel.querySelector('#udcRoomJoinLink');

    function hideRoomInvite() {
      roomInvite.hidden = true;
      if (roomQRPanel.open) roomQRPanel.close();
    }

    roomCodeButton.addEventListener('click', () => {
      if (!code || !active || roomQRPanel.open) return;

      const url = buildUrl('play');
      roomQRTitle.textContent = roomCodeButton.textContent;
      roomJoinLink.href = url;
      roomQRPanel.showModal();
      roomCodeButton.setAttribute('aria-expanded', 'true');
      renderInviteQR(roomQR, url, 'Use the player link below.', () => roomQRPanel.open);
    });

    roomQRPanel.addEventListener('close', () => {
      roomCodeButton.setAttribute('aria-expanded', 'false');
      if (!roomInvite.hidden) roomCodeButton.focus();
    });

    roomQRPanel.addEventListener('click', event => {
      if (event.target === roomQRPanel) roomQRPanel.close();
    });
    cardEl.insertAdjacentElement('afterend', reactionBar);

    const reactionLayer = document.createElement('div');
    reactionLayer.id = 'udcReactionLayer';
    document.body.appendChild(reactionLayer);

    const reactionCSS = document.createElement('style');
    reactionCSS.textContent = `
      #udcReactionBar {
        display: none;
        flex-direction: column;
        align-items: center;
        gap: 7px;
        margin: 4px auto 0;
        position: relative;
        z-index: 2;
        touch-action: pan-y;
      }
      #udcReactionBar.udc-visible {
        display: flex;
      }
      .udcReactionButtons {
        display: flex;
        justify-content: center;
        gap: 12px;
      }
      .udcReactionButtons button {
        width: 53px;
        height: 51px;
        border: 1px solid rgba(150,150,150,.4);
        border-radius: 16px;
        background: #16161657;
        font-size: 27px;
        cursor: pointer;
        touch-action: pan-y;
        user-select: none;
        -webkit-user-select: none;
      }
      .udcReactionButtons button:hover {
        transform: scale(1.08);
        background: #4242428F;
        border-color: rgba(150,150,150,.6);
      }
      .udcReactionButtons button:active {
        transform: scale(.95);
        background: #FFFFFFB7;
        border-color: rgba(150,150,150,.8);
      }
      .udcReactionHint {
        font-size: 11px;
        color: var(--muted,#aaa);
      }
      #udcReactionLayer {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 1200;
        overflow: hidden;
      }
      .udcReactionPop {
        position: absolute;
        bottom: 19%;
        width: max-content;
        font-size: 44px;
        animation: udcReactionRise 2.1s ease-out forwards;
        filter: drop-shadow(0 3px 6px #0008);
      }
      .udcReactionName {
        display: inline-block;
        vertical-align: middle;
        box-sizing: border-box;
        max-width: min(11rem, 28vw);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        margin-left: 4px;
        padding: 4px 7px;
        border-radius: 999px;
        background: #161616;
        color: #fff;
        font: 700 13px Tahoma, sans-serif;
      }
      @keyframes udcReactionRise {
        0% {
          opacity: 0;
          transform: translateY(20px) scale(.7);
        }
        16% { opacity: 1; }
        80% { opacity: 1; }
        100% {
          opacity: 0;
          transform: translateY(-190px) scale(1.4);
        }
      }
      @media(max-width:600px) {
        body.udc-reactions-active {
          min-height: 120svh;
          overflow-y: auto;
          align-items: stretch;
        }
        body.udc-reactions-active #app {
          flex-grow: 0;
          min-height: 100svh;
          justify-content: center;
          box-sizing: border-box;
          padding-top: 80px;
          padding-bottom: 20px;
        }
        body.udc-reactions-active #udcReactionBar {
          margin-top: 4px;
        }
        body.udc-reactions-active #rulesButtonContainer {
          position: relative;
          bottom: auto;
          padding: 12px 16px 85px;
          box-sizing: border-box;
        }
        body.udc-reactions-active #footer {
          position: relative;
          bottom: auto;
          padding-bottom: 12px;
        }
      }
      @media(prefers-reduced-motion:reduce) {
        .udcReactionPop {
          animation-duration: .6s;
        }
      }
    `;
    document.head.appendChild(reactionCSS);

    let reactionSlots;
    try {
      const stored = JSON.parse(
        localStorage.getItem('udcReactionSlots') || 'null'
      );
      reactionSlots =
        Array.isArray(stored) && stored.length === 4
          ? stored
          : REACTION_DEFAULTS.slice();
    } catch (_) {
      reactionSlots = REACTION_DEFAULTS.slice();
    }

    const reactionSeen = new Map();
    let reactionRef = null, reactionListener = null;

    function reactionTextColour(background) {
      const [red, green, blue] = background.slice(1).match(/../g).map(hex => {
        const channel = parseInt(hex, 16) / 255;
        return channel <= 0.04045
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4;
      });
      const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      const blackContrast = (luminance + 0.05) / 0.05;
      const whiteContrast = 1.05 / (luminance + 0.05);
      return blackContrast >= whiteContrast ? '#000' : '#fff';
    }

    function showReaction(emoji, name, colour) {
      const pop = document.createElement('span');
      pop.className = 'udcReactionPop';
      pop.textContent = emoji;
      const label = document.createElement('span');
      label.className = 'udcReactionName';
      label.textContent = name;
      if (typeof colour === 'string' && /^#[0-9a-f]{6}$/i.test(colour)) {
        label.style.backgroundColor = colour;
        label.style.color = reactionTextColour(colour);
      }
      pop.appendChild(label);
      reactionLayer.appendChild(pop);

      // The animation grows to 1.4× around the center of the reaction.
      const width = pop.offsetWidth;
      const edge = Math.ceil(width * 0.2) + 4;
      const available = reactionLayer.clientWidth - width - 2 * edge;
      const left = available > 0
        ? edge + Math.random() * available
        : Math.max(0, (reactionLayer.clientWidth - width) / 2);
      pop.style.left = left + 'px';
      setTimeout(() => pop.remove(), 2200);
    }

    function emojiOK(s) {
      if (!s || s.length > 32) return false;
      if (typeof Intl.Segmenter === 'function') {
        return [
          ...new Intl.Segmenter(undefined, {
            granularity: 'grapheme'
          }).segment(s)
        ].length === 1;
      }
      return [...s].length <= 10;
    }

    function setReactionVisible(on) {
      reactionBar.classList.toggle('udc-visible', !!on);
      document.body.classList.toggle(
        'udc-reactions-active', !!on
      );
    }

    function drawReactionButtons() {
      reactionButtons.replaceChildren();

      reactionSlots.forEach((emoji, index) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = emoji;
        b.setAttribute(
          'aria-label',
          'React ' + emoji + '; long press to change'
        );

        let timer = null, longPressed = false;
        let startX = 0, startY = 0;

        const cancel = () => {
          clearTimeout(timer);
          timer = null;
        };

        const customize = () => {
          longPressed = true;
          const replacement = prompt(
            'Choose an emoji for this button:',
            reactionSlots[index]
          );
          if (replacement === null) return;

          const value = replacement.trim();
          if (!emojiOK(value)) {
            return alert('Please enter one emoji.');
          }

          reactionSlots[index] = value;
          try {
            localStorage.setItem(
              'udcReactionSlots',
              JSON.stringify(reactionSlots)
            );
          } catch (_) {}

          drawReactionButtons();
        };

        b.addEventListener('pointerdown', e => {
          if (e.button !== 0) return;
          longPressed = false;
          startX = e.clientX;
          startY = e.clientY;
          cancel();
          timer = setTimeout(customize, 550);
        });

        b.addEventListener('pointermove', e => {
          if (Math.hypot(
            e.clientX - startX,
            e.clientY - startY
          ) > 12) cancel();
        });

        ['pointerup', 'pointercancel', 'pointerleave']
          .forEach(event => {
            b.addEventListener(event, cancel);
          });

        b.addEventListener('contextmenu', e => {
          e.preventDefault();
          cancel();
          customize();
        });

        b.addEventListener('click', e => {
          e.stopPropagation();
          if (longPressed) {
            longPressed = false;
            return;
          }
          sendReaction(reactionSlots[index]);
        });

        reactionButtons.appendChild(b);
      });
    }

    async function sendReaction(emoji) {
      if (!code || !active || !connected || !uid) return;
      try {
        await root().child('react/' + uid).set({
          e: emoji,
          t: firebase.database.ServerValue.TIMESTAMP
        });
      } catch (e) {
        say('Reaction not sent');
      }
    }

    function listenReactions() {
      if (reactionRef) return;
      reactionRef = root().child('react');

      let initialSnapshot = true;
      reactionListener = snapshot => {
        const showNewReactions = !initialSnapshot;
        initialSnapshot = false;
        const values = snapshot.val() || {};
        for (const [id, entry] of Object.entries(values)) {
          if (!entry || typeof entry.e !== 'string') continue;

          const stamp = Number(entry.t) || 0;
          const previous = reactionSeen.get(id);
          reactionSeen.set(
            id,
            Math.max(stamp, previous || 0)
          );

          if (
            showNewReactions &&
            stamp > (previous || 0) &&
            Date.now() - stamp < 8000
          ) {
            const player = roster[id] || order.find(p => p.uid === id);
            showReaction(entry.e, player?.name || 'Player', player?.colour);
          }
        }
      };

      reactionRef.on('value', reactionListener);
    }

    function stopReactions() {
      if (reactionRef && reactionListener) {
        reactionRef.off('value', reactionListener);
      }
      reactionRef = null;
      reactionListener = null;
      reactionSeen.clear();
      setReactionVisible(false);
    }

    drawReactionButtons();

    const toast = document.createElement('div');
    toast.style.cssText =
      'position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:#000c;color:#fff;padding:8px 14px;border-radius:999px;font:700 13px Tahoma,sans-serif;z-index:1500;display:none;max-width:90vw;text-align:center';
    document.body.appendChild(toast);

    let toastT;
    function say(t) {
      toast.textContent = t;
      toast.style.display = 'block';
      clearTimeout(toastT);
      toastT = setTimeout(() => {
        toast.style.display = 'none';
      }, 2600);
    }

    const mkBar = style => {
      const d = document.createElement('div');
      d.style.cssText = style;
      d.style.display = 'none';
      document.body.appendChild(d);
      return d;
    };

    const warnBar = mkBar(
      'position:fixed;left:8px;right:8px;top:calc(8px + env(safe-area-inset-top,0px));background:#b00020;color:#fff;font:700 13px Tahoma,sans-serif;padding:10px 12px;border-radius:10px;z-index:1450;cursor:pointer;text-align:center'
    );
    warnBar.textContent =
      '⚠️ Your cards are out of date. Tap to update.';

    warnBar.addEventListener('click', () => {
      overlay.style.display = 'flex';
      render();
    });

    openBtn.addEventListener('click', () => {
      menu.style.display = 'none';
      overlay.style.display = 'flex';
      render();
    });

    openBtn.hidden = false;

    overlay.addEventListener('click', e => {
      if (e.target === overlay) {
        overlay.style.display = 'none';
      }
    });

    const esc = s => String(s).replace(
      /[&<>"]/g,
      c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;'
      }[c])
    );

    const saved = k => {
      try {
        return localStorage.getItem(k) || '';
      } catch (e) {
        return '';
      }
    };

    const keep = (k, v) => {
      try {
        localStorage.setItem(k, v);
      } catch (e) {}
    };

    const byJoinTime = (a, b) =>
      (a[1].t || 0) - (b[1].t || 0);

    const onlineCount = () =>
      Object.values(roster).filter(p =>
        p && p.online !== false && !p.spectator
      ).length;
          function hintText(h) {
      const p = [];
      if (h.diff) p.push(
        h.diff === 'crazy' ? 'CRAZY difficulty' : 'Normal difficulty'
      );
      if (h.rounds) p.push(
        h.rounds === 'u' ? 'Unlimited rounds' :
        h.rounds + ' round' + (h.rounds === '1' ? '' : 's')
      );
      if (h.dm) p.push('Discord mode');
      return p.join(' · ');
    }

    function currentHint() {
      if (meta && meta.started) {
        return {
          diff: meta.diff || '',
          rounds: meta.unlimited ? 'u' : String(meta.rounds || ''),
          dm: !!meta.discord
        };
      }
      if (!isHost) return {};
      const draft = getLobbyDraft();
      return {
        diff: draft.diff,
        rounds: draft.unlimited ? 'u' : String(roundCount(draft.rounds)),
        dm: draft.discord
      };
    }

    function roundCount(value) {
      return Math.min(999, Math.max(1, parseInt(value, 10) || 5));
    }

    function getLobbyDraft() {
      if (!lobbyDraft) {
        lobbyDraft = {
          rounds: meta?.rounds || 5,
          unlimited: !!meta?.unlimited,
          diff: meta?.diff || difficulty,
          discord: meta?.discord ?? isDiscordModeOn(),
          cats: meta?.cats ? new Set(meta.cats) : null
        };
      }
      return lobbyDraft;
    }

    function lobbySettingsHTML() {
      const draft = getLobbyDraft();
      const categories = getUniqueCategories();
      const selected = draft.cats || enabledCategories;
      const categoryOptions = categories.map((category, index) =>
        '<label><input name="oCategory" type="checkbox" value="' + index + '"' +
        (selected.has(category) ? ' checked' : '') + '> ' + esc(category) + '</label>'
      ).join('');

      return '<div class="setup-field udcLobbySettings" id="oSettings" tabindex="-1">' +
        '<h3 style="font:20px/1.4 Arial, sans-serif;color:#9E9E9E"; font-weight:200;">Game settings</h3><div class="roundsRow">' +
        '<label>Rounds <input type="number" id="oRounds" min="1" max="999" value="' +
        esc(draft.rounds) + '"' + (draft.unlimited ? ' disabled' : '') + '></label>' +
        '<label><input type="checkbox" id="oUnl"' +
        (draft.unlimited ? ' checked' : '') + '> Unlimited</label></div>' +
        '<div class="roundsRow"><label>Difficulty <select id="oDifficulty">' +
        '<option value="normal">Normal</option><option value="crazy"' +
        (draft.diff === 'crazy' ? ' selected' : '') + '>Crazy</option></select></label>' +
        '<label><input type="checkbox" id="oDiscord"' +
        (draft.discord ? ' checked' : '') + '> Discord mode</label></div>' +
        '<div class="setup-btn-row"><button type="button" id="oSfw">All SFW</button>' +
        '<button type="button" id="oCompetitive">Competitive</button></div>' +
        '<details id="oCategories"><summary>Categories</summary>' +
        '<div class="category-list">' + (categoryOptions || 'Loading categories…') +
        '</div></details></div>';
    }

    const roleNow = () =>
      (phase === 'playing' || qrRole === 'watch')
        ? 'watch' : 'play';

    function buildUrl(role) {
      const u = new URL(location.href);
      u.search = '';
      u.hash = '';
      u.searchParams.set('join', code);
      if (role === 'watch') {
        u.searchParams.set('role', 'watch');
      }
      const h = currentHint();
      if (h.diff) u.searchParams.set('diff', h.diff);
      if (h.rounds) u.searchParams.set('rounds', h.rounds);
      if (h.dm) u.searchParams.set('dm', '1');
      return u.toString();
    }

    async function copyLink(url) {
      try {
        await navigator.clipboard.writeText(url);
        say('Link copied');
      } catch (x) {
        window.prompt('Copy this link', url);
      }
    }

    async function shareLink(url) {
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'Ultimate Drinking Cards',
            text: 'Join my game ' + code,
            url
          });
        } catch (x) {}
      } else {
        copyLink(url);
      }
    }

    function qrApi() {
      if (window.QRCode) {
        return typeof window.QRCode.toCanvas === 'function'
          ? 'toCanvas' : 'constructor';
      }
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
            const s = document.createElement('script');
            s.src = src;
            s.onload = () => res(true);
            s.onerror = () => {
              s.remove();
              res(false);
            };
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
      wrap.style.cssText =
        'background:#fff;padding:10px;border-radius:12px;line-height:0';
      el.appendChild(wrap);

      switch (qrApi()) {
        case 'toCanvas': {
          const cv = document.createElement('canvas');
          wrap.appendChild(cv);
          window.QRCode.toCanvas(
            cv, text,
            { width: 200, margin: 0, errorCorrectionLevel: 'M' },
            err => {
              if (err) el.textContent = 'Could not draw QR code';
            }
          );
          return true;
        }
        case 'constructor':
          new window.QRCode(wrap, {
            text,
            width: 200,
            height: 200,
            correctLevel: window.QRCode.CorrectLevel
              ? window.QRCode.CorrectLevel.M : undefined
          });
          return true;
        case 'kazuhiko': {
          const q = window.qrcode(0, 'M');
          q.addData(text);
          q.make();
          wrap.innerHTML = q.createSvgTag
            ? q.createSvgTag(4, 0)
            : q.createImgTag(4, 0);
          const c = wrap.firstElementChild;
          if (c) {
            c.style.width = '200px';
            c.style.height = '200px';
          }
          return true;
        }
        case 'qrious': {
          const cv = document.createElement('canvas');
          wrap.appendChild(cv);
          new window.QRious({
            element: cv,
            value: text,
            size: 200
          });
          return true;
        }
      }
      return false;
    }

    function shareHTML() {
      const watchOnly = phase === 'playing';
      return '<div class="setup-field" style="margin-top:14px"><label>' +
        (watchOnly ? 'Invite spectators' : 'Invite friends') +
        '</label>' +
        (watchOnly ? '' :
          '<div class="toggleButtonRow" style="margin-bottom:10px">' +
          '<button type="button" class="toggle-btn' +
          (qrRole === 'play' ? ' active' : '') +
          '" id="oQrPlay">Players</button>' +
          '<button type="button" class="toggle-btn' +
          (qrRole === 'watch' ? ' active' : '') +
          '" id="oQrWatch">Spectators</button></div>') +
        '<div id="oQR" style="display:flex;justify-content:center;min-height:60px;font-size:12px">Loading QR code…</div>' +
        '<div class="setup-btn-row" style="margin-top:10px">' +
        '<button id="oCopy">Copy link</button>' +
        '<button id="oShare">Share</button></div></div>';
    }

    function paintShare() {
      const holder = document.getElementById('oShareBox');
      if (!holder || !code) return;

      holder.innerHTML = shareHTML();
      const el = holder.querySelector('#oQR');
      renderInviteQR(el, buildUrl(roleNow()), 'Use Copy link or Share.');
    }

    async function renderInviteQR(el, url, fallback, visible = () => true) {
      el.textContent = 'Loading QR code…';
      let drawn = false;
      try {
        const ready = await ensureQR();
        if (!el.isConnected || !visible()) return;
        if (ready) drawn = drawQR(el, url);
      } catch (error) {
        if (!el.isConnected || !visible()) return;
      }
      if (!drawn) el.textContent = 'QR code unavailable. ' + fallback;
    }

    let shareT;
    function lobbyChanged(e) {
      if (!isHost || phase !== 'lobby') return;
      const input = e.target;
      const draft = getLobbyDraft();
      if (input.id === 'oRounds') draft.rounds = input.value;
      else if (input.id === 'oUnl') {
        draft.unlimited = input.checked;
        document.getElementById('oRounds').disabled = input.checked;
      } else if (input.id === 'oDifficulty') draft.diff = input.value;
      else if (input.id === 'oDiscord') draft.discord = input.checked;
      else if (input.name === 'oCategory') {
        draft.cats = new Set([...box.querySelectorAll('[name="oCategory"]:checked')]
          .map(option => getUniqueCategories()[Number(option.value)]));
        return;
      } else return;

      clearTimeout(shareT);
      shareT = setTimeout(paintShare, 300);
    }

    box.addEventListener('input', lobbyChanged);
    box.addEventListener('change', lobbyChanged);

    const LOCK_SEL =
      '#difficultyRow button, #discordModeCheckbox, #deckPresetButtons button, #categoryList input, #selectAllCategoriesButton, #deselectAllCategoriesButton';

    function lockSettings(on) {
      document.querySelectorAll(LOCK_SEL)
        .forEach(el => { el.disabled = on; });

      let note = document.getElementById('udcLockNote');

      if (on && !note) {
        note = document.createElement('p');
        note.id = 'udcLockNote';
        note.style.cssText =
          'font-size:12px;margin:0;padding:10px 16px 0;color:var(--muted)';
        note.textContent =
          '🔒 Difficulty, categories and Discord mode are locked during an online game.';
        menu.insertBefore(note, menu.firstChild);
      } else if (!on && note) {
        note.remove();
      }
    }

    function currentTurnStatus() {
      const player = order[currentPlayerIndex];
      if (!player) return 'Waiting for players';
      if (player.uid === uid && !amSpectator()) return 'Your turn!';
      return (player.name || 'Player') + "'s Turn.";
    }

    function paintOnlineTurn() {
      updateTurnTracker(active
        ? (finished() ? 'Game complete' : currentTurnStatus())
        : undefined);
    }

    function nudge() {
      if (!active || blocked || amSpectator() || finished()) return;
      const cur = order[currentPlayerIndex];
      if (!cur || cur.uid !== uid) return;
      coverCard.classList.add('udc-yourturn');
      document.title = '🎯 Your turn! · ' + baseTitle;
      try {
        vibrate([140, 90, 140, 90, 260]);
      } catch (x) {}
    }

    function clearNudge() {
      coverCard.classList.remove('udc-yourturn');
      document.title = baseTitle;
    }

    function tallyDrinks() {
      const len = order.length || 1;
      const rows = order.map(o => ({
        uid: o.uid,
        name: o.name,
        colour: o.colour,
        cards: 0,
        take: 0,
        give: 0,
        total: 0
      }));

      let reds = 0, blacks = 0;

      for (let n = 1; n <= curN; n++) {
        const c = cardFor(n);
        const r = rows[(n - 1) % len];
        if (!r) continue;

        r.cards++;
        if (c.type === 'red') reds++;

        if (c.type === 'black') {
          blacks++;
          if (!BLACK_CARDS_COUNT) continue;
        }

        const mult = c.type === 'red' ? 3 : 1;
        const d = parseDrinks(c.rule);
        r.take += d.take * mult;
        r.give += d.give * mult;
      }

      rows.forEach(r => {
        r.total = r.take + r.give;
      });

      return {
        rows, reds, blacks,
        cards: curN,
        total: rows.reduce((a, r) => a + r.total, 0)
      };
    }

    function resultsHTML() {
      const t = tallyDrinks();
      const done = finished();
      const sorted = t.rows.slice().sort((a, b) =>
        b.total - a.total ||
        String(a.name).localeCompare(String(b.name))
      );
      const max = sorted.length ? sorted[0].total : 0;

      let h =
        '<h2>' + (done ? '🏁 Game over' : '🍻 Drinks so far') +
        '</h2>' +
        '<p class="sub">' + t.cards + ' card' +
        (t.cards === 1 ? '' : 's') + ' drawn</p>' +
        '<div style="font-size:60px;color: var(--accent);font-weight:900;line-height:1">' +
        t.total + '</div>' +
        '<div style="font-size:12px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#555;margin:2px 0 18px">Total drinks</div>';

      h += sorted.map(r => {
        const pct = max
          ? Math.round(100 * r.total / max)
          : 0;

        return '<div style="text-align:left;margin-bottom:12px">' +
          '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-weight:700">' +
          '<span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' +
          esc(r.colour || '#999') +
          ';margin-right:7px"></span>' +
          esc(r.name || '?') +
          (r.uid === uid ? ' (you)' : '') +
          '</span><span style="font-size:20px">' +
          r.total + '</span></div>' +
          '<div style="height:6px;border-radius:3px;background:rgba(0,0,0,.1);margin:5px 0">' +
          '<div style="height:100%;width:' + pct +
          '%;border-radius:3px;background:' +
          esc(r.colour || '#999') +
          '"></div></div>' +
          '<div style="font-size:12px;color:#555">🍺 Take ' +
          r.take + ' · 🎯 Issue ' + r.give +
          ' · ' + r.cards + ' card' +
          (r.cards === 1 ? '' : 's') +
          '</div></div>';
      }).join('');

      if (max > 0) {
        const top = sorted
          .filter(r => r.total === max)
          .map(r => r.name)
          .join(' & ');
        h += '<p class="sub" style="margin:6px 0 4px">' +
          '<b>Most drinks:</b> ' + esc(top) +
          ' (' + max + ')</p>';
      } else if (t.cards) {
        h += '<p class="sub" style="margin:6px 0 4px">' +
          'No drink cards have turned up yet.</p>';
      }

      const notes = [];
      if (t.reds) {
        notes.push(t.reds + ' red card' +
          (t.reds === 1 ? '' : 's') + ' counted ×3');
      }
      if (t.blacks && !BLACK_CARDS_COUNT) {
        notes.push(t.blacks + ' inverted (black) card' +
          (t.blacks === 1 ? '' : 's') + ' not counted');
      }
      if (notes.length) {
        h += '<p class="sub" style="font-size:12px;margin:0 0 4px">' +
          esc(notes.join(' · ')) + '</p>';
      }

      h += '<div class="setup-btn-row">' +
        (done && isHost
          ? '<button id="oAgain">Play again</button>' +
            '<button id="oGameSettings" class="secondary-btn">Go to game settings</button>'
          : '') +
        '<button id="oResBack" class="' +
        (done ? (isHost ? 'secondary-btn' : '') : 'udc-back-to-game') +
        '">' + (done ? 'Close' : 'Back to game') +
        '</button></div>' +
        '<div class="setup-btn-row">' +
        '<button id="oLeave">Leave</button>' +
        '</div>' +
        '<p class="sub" style="font-size:11px;opacity:.55;margin:14px 0 0">' +
        'online script ' + VERSION + '</p>';

      return h;
    }

    function render() {
      box.classList.toggle('udc-lobby', phase === 'lobby');
      const categoriesOpen = box.querySelector('#oCategories')?.open;
      if (
        phase === 'playing' &&
        resultsOpen &&
        !blocked &&
        baseDeck.length &&
        meta
      ) {
        box.innerHTML = resultsHTML();
        return;
      }

      let h = '<h2>🌐 Online game</h2>';
      if (msg) {
        h += '<p class="sub" style="color:#b00020">' +
          esc(msg) + '</p>';
      }

      if (phase === 'menu') {
        const inv = pendingInvite;

        if (inv) {
          const ht = hintText(inv);
          h += '<p class="sub"><b>You’ve been invited to game ' +
            esc(inv.code) + '</b>' +
            (ht ? '<br>' + esc(ht) : '') +
            (inv.watch ? '<br>This is a spectator link' : '') +
            '</p>';
        } else {
          h += '<p class="sub">Everyone plays on their own phone and sees the same cards.</p>';
        }

        h += '<div class="setup-field"><label>Your name</label>' +
          '<div class="playerRow">' +
          '<input type="text" class="playerNameInput" id="oName" maxlength="16" value="' +
          esc(saved('udcOnName')) + '">' +
          '<input type="color" class="playerColourInput" id="oColour" value="' +
          (saved('udcOnColour') || '#5BFFF4') +
          '"></div></div>';

        if (!inv) {
          h += '<div class="setup-btn-row">' +
            '<button id="oHost">Host a game</button></div>';
        }

        h += '<div class="setup-field" style="margin-top:18px">' +
          '<label>' + (inv ? 'Game code' : 'Or join with a game code') +
          '</label><div class="playerRow">' +
          '<input type="text" id="oCode" maxlength="8" placeholder="CODE" autocapitalize="characters" style="text-transform:uppercase" value="' +
          esc(inv ? inv.code : '') +
          '"></div></div>' +
          '<div class="setup-btn-row">' +
          '<button id="oJoin">Join as player</button>' +
          '<button id="oWatch">Watch only</button></div>';

      } else if (phase === 'lobby') {
        h += '<div class="udcLobbyInvite"><div><p class="sub">Game code</p>' +
          '<div style="font-size:42px;font-weight:900;color:#fff;letter-spacing:.1em;margin-bottom:12px">' +
          esc(code) + '</div>' +
          '<div class="setup-field"><label id="oCount"></label>' +
          '<div id="oRoster"></div></div></div><div id="oShareBox"></div></div>';

        if (isHost) {
          h += lobbySettingsHTML() +
            '<div class="setup-btn-row"><button id="oStart">Start game</button></div>';
        } else if (amSpectator()) {
          h += '<p class="sub">You’re watching. Waiting for the host to start…</p>';
        } else {
          h += '<p class="sub">Waiting for the host to start…</p>';
        }

        h += '<div class="setup-btn-row">' +
          '<button id="oLeave">Leave</button>' +
          '</div>';

      } else {
        h += '<p class="sub">Game <b>' + esc(code) +
          '</b>' +
          (isHost
            ? ' · you are the host (you can draw on anyone’s turn, e.g. if someone is away)'
            : amSpectator()
              ? ' · you are watching'
              : '') +
          '</p>';

        if (blocked) {
          h += '<p class="sub" style="color:#b00020">' +
            '<b>⚠️ Your card list doesn’t match the host’s</b> ' +
            '(different app version or cached cards). ' +
            'Drawing and card updates are paused until it matches.</p>' +
            '<div class="setup-btn-row">' +
            '<button id="oUpdate">Update cards</button>' +
            '<button class="secondary-btn" id="oReload">Reload page</button>' +
            '</div>';
        }

        h += '<div class="setup-field">' +
          '<label id="oCount"></label>' +
          '<div id="oRoster"></div></div>' +
          (curN > 0 && !blocked
            ? '<div class="setup-btn-row"><button id="oResults">🍻 Drinks tally</button></div>'
            : '') +
          '<div id="oShareBox"></div>' +
          '<div class="setup-btn-row">' +
          '<button id="oClose">Back to game</button>' +
          '<button id="oLeave">Leave</button>' +
          '</div>';
      }

      h += '<p class="sub" style="font-size:11px;opacity:.55;margin:14px 0 0">' +
        VERSION + '</p>';

      box.innerHTML = h;
      const categoryInputs = box.querySelectorAll('[name="oCategory"]');
      if (categoryInputs.length) {
        const categories = getUniqueCategories();
        categoryInputs.forEach(input => {
          input.style.accentColor = categoryColours[categories[Number(input.value)]] || '#999999';
        });
      }
      if (categoriesOpen && box.querySelector('#oCategories')) {
        box.querySelector('#oCategories').open = true;
      }
      paintRoster();
      paintShare();
    }

    function paintRoster() {
      const list = document.getElementById('oRoster');
      const cnt = document.getElementById('oCount');
      if (!list) return;

      const specs = Object.entries(roster)
        .filter(([, p]) => p && p.spectator)
        .sort(byJoinTime);

      let rows;

      if (phase === 'playing') {
        rows = order.map((o, i) => ({
          id: o.uid,
          name: o.name,
          colour: o.colour,
          p: roster[o.uid],
          turn: i === currentPlayerIndex
        }));
      } else {
        rows = Object.entries(roster)
          .filter(([, p]) => p && !p.spectator)
          .sort(byJoinTime)
          .map(([id, p]) => ({
            id,
            name: p.name,
            colour: p.colour,
            p
          }));
      }

      let html = rows.map(r => {
        const off = !r.p || r.p.online === false;
        return '<div style="text-align:left;padding:4px 0;font-weight:700;opacity:' +
          (off ? '.45' : '1') +
          ';color:' + esc(r.colour || '#999') + '">' +
          (r.turn ? '▶ ' : '● ') +
          esc(r.name || '?') +
          (r.id === uid ? ' (you)' : '') +
          (meta && meta.host === r.id ? ' 👑' : '') +
          (off ? ' · offline' : '') +
          '</div>';
      }).join('');

      html += specs.map(([id, p]) =>
        '<div style="text-align:left;padding:3px 0;font-weight:600;opacity:' +
        (p.online === false ? '.4' : '.75') +
        ';color:' + esc(p.colour || '#999') +
        '">👀 ' + esc(p.name || '?') +
        (id === uid ? ' (you)' : '') +
        (p.online === false ? ' · offline' : '') +
        '</div>'
      ).join('');

      list.innerHTML = html;

      if (cnt) {
        cnt.textContent =
          (phase === 'playing' ? 'Players' : 'Players here') +
          ' (' + rows.length + ')' +
          (specs.length ? ' · ' + specs.length + ' watching' : '');
      }

      const st = document.getElementById('oStart');
      if (st) {
        const ok = onlineCount() >= MIN_PLAYERS;
        st.disabled = !ok;
        st.textContent = ok
          ? 'Start game'
          : 'Need ' + MIN_PLAYERS + '+ players';
      }
    }

    box.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.id === 'oCode') {
        const b = document.getElementById(
          pendingInvite && pendingInvite.watch
            ? 'oWatch' : 'oJoin'
        );
        if (b) b.click();
      }
    });

    box.addEventListener('click', async e => {
      const btn = e.target.closest('button');
      const id = btn && btn.id;
      if (!id) return;

      if (id === 'oClose') {
        overlay.style.display = 'none';
      } else if (id === 'oLeave') {
        await leave();
      } else if (
        id === 'oHost' ||
        id === 'oJoin' ||
        id === 'oWatch'
      ) {
        const name =
          (document.getElementById('oName').value || '')
            .trim() || 'Player';
        const colour =
          document.getElementById('oColour').value;

        keep('udcOnName', name);
        keep('udcOnColour', colour);

        if (id !== 'oHost') {
          code = (document.getElementById('oCode').value || '')
            .toUpperCase().replace(/[^A-Z0-9]/g, '');
          if (pendingInvite &&
              pendingInvite.code !== code) {
            pendingInvite = null;
          }
        }

        await enter(
          id === 'oHost' ? 'host' :
          id === 'oWatch' ? 'watch' : 'join',
          name,
          colour
        );
      } else if (id === 'oStart') {
        await startGame(btn);
      } else if (id === 'oQrPlay' || id === 'oQrWatch') {
        qrRole = id === 'oQrWatch' ? 'watch' : 'play';
        paintShare();
      } else if (id === 'oCopy') {
        copyLink(buildUrl(roleNow()));
      } else if (id === 'oShare') {
        shareLink(buildUrl(roleNow()));
      } else if (id === 'oUpdate') {
        await updateCards(btn);
      } else if (id === 'oReload') {
        location.reload();
      } else if (id === 'oResults') {
        resultsOpen = true;
        render();
      } else if (id === 'oResBack') {
        resultsOpen = false;
        render();
        overlay.style.display = 'none';
      } else if (id === 'oSfw' || id === 'oCompetitive') {
        const categories = getUniqueCategories();
        const preset = id === 'oSfw' ? 'sfw' : 'competitive';
        const selected = new Set(deckPresetCategories(preset, categories));
        getLobbyDraft().cats = selected;
        box.querySelectorAll('[name="oCategory"]').forEach(option => {
          option.checked = selected.has(categories[Number(option.value)]);
        });
        box.querySelector('#oCategories').open = true;
      } else if (id === 'oAgain') {
        await finishRound(true);
      } else if (id === 'oGameSettings') {
        await finishRound(false);
      }
    });
        const randomCode = () => {
      const A = 'ABCDEFGHJKMNPQRSTUVWXYZ';
      let c = '';
      for (let i = 0; i < 5; i++) {
        c += A[Math.floor(Math.random() * A.length)];
      }
      return c;
    };

    async function enter(mode, name, colour) {
      await ready;
      if (!uid) return;
      msg = '';
      const spectate = mode === 'watch';

      if (mode === 'host') {
        let ok = false;
        for (let k = 0; k < 6 && !ok; k++) {
          code = randomCode();
          try {
            const res = await root().child('meta').transaction(
              cur => cur ? undefined : {
                host: uid,
                started: false,
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                lastActivity: firebase.database.ServerValue.TIMESTAMP
              }
            );
            ok = res.committed;
          } catch (x) {
            msg = 'Could not create game (' +
              (x.code || x.message) + ')';
            code = null;
            return render();
          }
        }
        if (!ok) {
          msg = 'Could not find a free game code, try again.';
          code = null;
          return render();
        }
        isHost = true;
      } else {
        if (!code) {
          msg = 'Type the game code first.';
          return render();
        }

        let m;
        try {
          m = (await root().child('meta').once('value')).val();
        } catch (x) {
          msg = 'Could not reach the game (' +
            (x.code || x.message) + ')';
          code = null;
          return render();
        }

        if (!m) {
          msg = 'No game found with that code.';
          code = null;
          return render();
        }

        isHost = m.host === uid;
      }

      const me = root().child('players/' + uid);

      try {
        const ex = (await me.once('value')).val();
        if (ex) {
          await me.update({
            name,
            colour,
            online: true,
            lastActivity: firebase.database.ServerValue.TIMESTAMP,
            ...(mode === 'join' && ex.spectator ? { spectator: false } : {})
          });
        } else {
          await me.set(Object.assign({
            name,
            colour,
            online: true,
            t: firebase.database.ServerValue.TIMESTAMP
          }, spectate ? { spectator: true } : {}));
        }
      } catch (x) {
        msg = 'Could not join (' +
          (x.code || x.message) + ')';
        code = null;
        return render();
      }

      keep('udcOnSession', code);
      pendingInvite = null;
      phase = 'lobby';
      lobbyDraft = null;
      attach();
      cardsReady().then(() => {
        if (phase === 'lobby' && !box.querySelector('[name="oCategory"]')) render();
      });
      presence();
      render();
    }

    function presence() {
      const me = root().child('players/' + uid);
      const c = db.ref('.info/connected');
      disconnectRef = me;
      presenceRef = c;

      presenceCallback = async snapshot => {
        connected = snapshot.val() === true;

        if (!connected) {
          clearNudge();
          say('Connection lost — reconnecting…');
          return;
        }

        try {
          await me.onDisconnect().update({
            online: false
          });
          if (code) {
            await me.update({ online: true });
          }
        } catch (e) {
          say('Could not restore presence; reconnecting…');
        }
      };

      c.on('value', presenceCallback);
    }

    async function leave() {
      const c = code;
      await detach();

      try {
        if (c && uid) {
          const r = db.ref('udc/' + c);
          const alone = Object.keys(roster)
            .filter(i => i !== uid).length === 0;

          if (alone) {
            await r.remove();
          } else if (started) {
            await r.child('players/' + uid + '/online')
              .set(false);
          } else {
            await r.child('players/' + uid).remove();
          }
        }
      } catch (x) {}

      keep('udcOnSession', '');
      location.reload();
    }

    async function detach() {
      hideRoomInvite();
      stopReactions();
      clearTimeout(hostTimer);

      if (presenceRef && presenceCallback) {
        presenceRef.off('value', presenceCallback);
      }
      presenceRef = null;
      presenceCallback = null;

      if (disconnectRef) {
        try {
          await disconnectRef.onDisconnect().cancel();
        } catch (e) {}
        disconnectRef = null;
      }

      refs.forEach(r => {
        try { r.off(); } catch (e) {}
      });
      refs = [];
    }

    async function startGame(btn) {
      if (
        !isHost ||
        onlineCount() < MIN_PLAYERS ||
        !connected
      ) return;

      const draft = getLobbyDraft();
      const cats = [...(draft.cats || enabledCategories)];
      const disc = draft.discord;
      const raw = buildRaw(new Set(cats), disc);

      if (!raw.length) {
        msg = 'Choose at least one category with cards.';
        render();
        box.querySelector('#oCategories').open = true;
        return;
      }

      const unl = draft.unlimited;
      const rounds = roundCount(draft.rounds);

      const sorted = Object.entries(roster)
        .filter(([, p]) =>
          p && p.online !== false && !p.spectator
        )
        .sort(byJoinTime);

      const seed = Math.random().toString(36).slice(2);
      btn.disabled = true;

      try {
        await root().child('meta').transaction(
          cur => (cur && cur.host === uid && !cur.started)
            ? Object.assign({}, cur, {
                started: true,
                lastActivity: firebase.database.ServerValue.TIMESTAMP,
                seed,
                cats,
                diff: draft.diff,
                discord: disc,
                rounds,
                unlimited: unl,
                sig: deckSig(raw),
                count: sorted.length,
                total: unl
                  ? 100000
                  : rounds * sorted.length,
                order: sorted.map(([id, p]) => ({
                  uid: id,
                  name: p.name,
                  colour: p.colour
                }))
              })
            : undefined
        );
      } catch (x) {
        msg = 'Could not start (' +
          (x.code || x.message) + ')';
        render();
      }
    }

    function attach() {
      const r = root();

      const on = (ref, fn) => {
        ref.on('value', fn, x => {
          msg = x.code || x.message;
          render();
        });
        refs.push(ref);
      };

      on(r.child('players'), s => {
        const prev = roster;
        roster = s.val() || {};

        if (started) {
          for (const id in roster) {
            if (id === uid || !prev[id]) continue;

            if (
              prev[id].online !== false &&
              roster[id].online === false
            ) {
              say(roster[id].name + ' disconnected');
            } else if (
              prev[id].online === false &&
              roster[id].online !== false
            ) {
              say(roster[id].name + ' is back');
            }
          }
        }

        paintRoster();
        checkHost();

        if (isHost && started) {
          enrollLatePlayers();
        }
      });

      on(r.child('meta'), s => {
        const m = s.val();

        if (!m) {
          if (metaSeen) {
            hideRoomInvite();
            say('This game was closed');
            keep('udcOnSession', '');
            setTimeout(() => location.reload(), 1500);
          }
          return;
        }

        metaSeen = true;
        meta = m;

        const wasHost = isHost;
        isHost = m.host === uid;

        if (started && m.started && m.seed !== playingSeed) {
          resetToLobby(true);
        }

        if (m.started && !started) {
          if (!starting) {
            starting = true;
            cardsReady().then(() => {
              starting = false;
              if (!started && meta && meta.started) {
                startLocal(meta);
              }
            });
          }
        } else if (!m.started && started) {
          resetToLobby();
        } else if (wasHost !== isHost) {
          if (isHost) say('You are now the host 👑');
          render();
        } else {
          paintRoster();
        }

        if (
          started &&
          m.started &&
          JSON.stringify(order) !==
            JSON.stringify(m.order || [])
        ) {
          order = m.order || [];
          players = order.map(p => ({
            name: p.name,
            colour: p.colour
          }));

          const nextIndex = latestState &&
            order.findIndex(p =>
              p.uid === latestState.next
            );

          if (nextIndex >= 0) {
            currentPlayerIndex = nextIndex;
          }

          paintOnlineTurn();
          paintRoster();
        }

        checkHost();
        if (isHost && started) {
          enrollLatePlayers();
        }
      });
    }

    let enrolling = false;

    async function enrollLatePlayers() {
      if (
        enrolling ||
        !isHost ||
        !meta ||
        !meta.started
      ) return;

      const waiting = Object.entries(roster)
        .filter(([id, p]) =>
          p &&
          p.online !== false &&
          !p.spectator &&
          !(meta.order || []).some(o => o.uid === id)
        );

      if (!waiting.length) return;
      enrolling = true;

      try {
        await root().child('meta').transaction(m => {
          if (!m || !m.started || m.host !== uid) return;

          const existing = new Set(
            (m.order || []).map(p => p.uid)
          );

          const additions = waiting
            .filter(([id]) => !existing.has(id))
            .map(([id, p]) => ({
              uid: id,
              name: p.name,
              colour: p.colour
            }));

          if (!additions.length) return;

          return {
            ...m,
            order: [...(m.order || []), ...additions],
            total: m.unlimited
              ? m.total
              : (m.total || 0) +
                (m.rounds || 0) * additions.length
          };
        });
      } catch (e) {
        say('Could not add late player');
      } finally {
        enrolling = false;
      }
    }

    function checkHost() {
      clearTimeout(hostTimer);
      if (!meta || !meta.host) return;

      const h = roster[meta.host];
      if (h && h.online !== false) return;

      hostTimer = setTimeout(async () => {
        const old = meta && meta.host;
        const cur = roster[old];

        if (!old || (cur && cur.online !== false)) return;

        const inGame = id =>
          !started || order.some(o => o.uid === id);

        const cands = Object.entries(roster)
          .filter(([id, p]) =>
            p &&
            p.online !== false &&
            !p.spectator &&
            inGame(id)
          )
          .sort(byJoinTime);

        if (!cands.length || cands[0][0] !== uid) return;

        try {
          await root().child('meta/host')
            .transaction(c =>
              c === old ? uid : undefined
            );
        } catch (x) {}
      }, HOST_GRACE_MS);
    }

    function buildRaw(cats, discord) {
      const raw = allCards
        .filter(g => cats.has(g.Category || ''))
        .flatMap(g =>
          (Array.isArray(g.Rules) ? g.Rules : [])
            .filter(rule =>
              !(discord && shouldRemoveForDiscord(rule))
            )
            .map(rule => ({
              Category: g.Category || '',
              Colour: g.Colour || g.Color ||
                g.colour || '#999999',
              Rule: rule
            }))
        );

      raw.sort((a, b) =>
        a.Category < b.Category ? -1 :
        a.Category > b.Category ? 1 :
        a.Rule < b.Rule ? -1 :
        a.Rule > b.Rule ? 1 : 0
      );

      return raw;
    }

    const deckSig = raw =>
      raw.length + ':' +
      xmur3(raw.map(c =>
        c.Category + '\u0001' + c.Rule
      ).join('\u0002'))().toString(36);

    function deckFor(cycle) {
      if (!cycles.has(cycle)) {
        if (cycles.size > 4) cycles.clear();
        cycles.set(
          cycle,
          shuffled(
            baseDeck,
            rngOf(meta.seed + '|deck|' + cycle)
          )
        );
      }
      return cycles.get(cycle);
    }

    function cardFor(n) {
      const len = baseDeck.length;
      const card = deckFor(
        Math.floor((n - 1) / len)
      )[(n - 1) % len];

      const crazy = meta.diff === 'crazy';
      const red = crazy
        ? CRAZY_RED_CHANCE
        : NORMAL_RED_CHANCE;
      const black = crazy
        ? CRAZY_BLACK_CHANCE
        : NORMAL_BLACK_CHANCE;

      const r = rngOf(meta.seed + '|type|' + n)();
      const type =
        r < red ? 'red' :
        r < red + black ? 'black' : 'white';

      const rule = meta.discord
        ? seededCall(
            rngOf(meta.seed + '|rule|' + n),
            () => applyDiscordTransforms(card.Rule)
          )
        : card.Rule;

      const content =
        '<div class="instructionText">' +
        rule + '</div>' +
        (type === 'red'
          ? '<div class="tripleBadge">×3!</div>'
          : '') +
        '<div class="categoryText" style="color: ' +
        card.Colour + ';">' +
        card.Category + '</div>';

      return {
        type,
        content,
        colour: card.Colour,
        rule: String(rule).replace(/<[^>]*>/g, ' ')
      };
    }

    function startLocal(m) {
      playingSeed = m.seed;
      lobbyDraft = null;
      started = true;
      active = true;
      phase = 'playing';
      blocked = false;
      roomCodeButton.textContent = 'Room ' + code;
      roomInvite.hidden = false;

      setReactionVisible(true);
      listenReactions();

      order = m.order || [];
      enabledCategories = new Set(m.cats || []);
      setDifficulty(m.diff || 'normal');
      discordModeCheckbox.checked = !!m.discord;
      randomiseOrderCheckbox.checked = false;

      players = order.map(p => ({
        name: p.name,
        colour: p.colour
      }));

      trackingEnabled = true;
      gameStarted = true;
      currentPlayerIndex = 0;
      currentRound = 1;

      unlimitedRounds = !!m.unlimited;
      totalRounds = unlimitedRounds
        ? Infinity : m.rounds;

      baseDeck = buildRaw(
        new Set(m.cats || []),
        !!m.discord
      );

      buildDeckFromEnabledCategories();
      buildCategoryList();
      lockSettings(true);
      closeSetupOverlay();
      rebuildAllDraws();
      paintOnlineTurn();

      overlay.style.display = 'none';

      blocked = !!(
        m.sig &&
        m.sig !== deckSig(baseDeck)
      );

      warnBar.style.display =
        blocked ? 'block' : 'none';

      if (blocked) {
        overlay.style.display = 'flex';
      }

      render();
      keepAwake();

      if (stRef) {
        try { stRef.off(); } catch (x) {}
      }

      const st = root().child('state');
      stRef = st;

      st.on('value', s => {
        const value = s.val();
        if (value?.seed && value.seed !== playingSeed) return;
        latestState = value;

        if (latestState?.n) {
          applyState(latestState);
        } else {
          clearNudge();
          setTimeout(() => {
            if (playingSeed === m.seed && !curN) nudge();
          }, 500);
        }
      });

      refs.push(st);
    }

    async function updateCards(btn) {
      if (btn) btn.disabled = true;

      try {
        const r = await fetch(
          'AppFiles/Data/cards.json',
          { cache: 'reload' }
        );

        if (!r.ok) {
          throw new Error('HTTP ' + r.status);
        }

        allCards = [...(await r.json())];
        rebuildAllDraws();

        baseDeck = buildRaw(
          new Set(meta.cats || []),
          !!meta.discord
        );

        cycles.clear();

        if (meta.sig === deckSig(baseDeck)) {
          blocked = false;
          msg = '';
          warnBar.style.display = 'none';

          buildDeckFromEnabledCategories();
          buildCategoryList();
          lockSettings(true);

          overlay.style.display = 'none';
          say('Cards updated');

          if (latestState) {
            applyState(latestState);
          }
          return;
        }

        msg = 'Still different from the host’s list. Try “Reload page”, or ask the host to refresh too.';
      } catch (x) {
        msg = 'Could not update cards (' +
          (x.code || x.message) + ')';
      }

      render();
    }

    function resetToLobby(replaying = false) {
      hideRoomInvite();
      if (stRef) {
        try { stRef.off(); } catch (x) {}
        stRef = null;
      }

      stopReactions();

      started = false;
      active = false;
      phase = 'lobby';
      drawing = false;
      blocked = false;
      latestState = null;
      lobbyDraft = null;
      playingSeed = undefined;

      lastN = curN = 0;
      cycles.clear();
      baseDeck = [];
      order = [];

      players = [];
      trackingEnabled = false;
      gameStarted = false;
      currentPlayerIndex = 0;
      currentRound = 1;

      coverCard.classList.remove(
        'flipped',
        'face-up',
        'type-black',
        'type-red'
      );

      cardFront.classList.remove(
        'type-black',
        'type-red'
      );

      showingFront = true;
      cardFront.innerHTML = 'Ultimate Drinking Cards';
      cardBack.innerHTML = '';

      resultsOpen = false;
      clearNudge();

      warnBar.style.display = 'none';
      lockSettings(false);

      buildDeckFromEnabledCategories();
      preloadNextCard();
      paintOnlineTurn();

      if (replaying) return;
      msg = '';
      overlay.style.display = 'flex';
      render();

      say(isHost
        ? 'Game restarted'
        : 'The host restarted the game'
      );
    }

    async function finishRound(replay) {
      if (!isHost || !active || !finished() || !connected || roundActionPending) return;
      roundActionPending = true;
      const buttons = [...box.querySelectorAll('#oAgain, #oGameSettings')];
      buttons.forEach(button => { button.disabled = true; });

      try {
        if (replay) {
          const seed = Math.random().toString(36).slice(2);
          await root().update({
            'meta/seed': seed,
            'meta/lastActivity': firebase.database.ServerValue.TIMESTAMP,
            state: { n: 0, seed }
          });
        } else {
          await restartAll();
          box.querySelector('#oSettings')?.focus();
        }
      } catch (x) {
        say('Could not start another game: ' + (x.code || x.message));
      } finally {
        roundActionPending = false;
        buttons.forEach(button => { button.disabled = false; });
      }
    }

    async function restartAll() {
      try {
        await root().update({
          'meta/started': false,
          'meta/lastActivity': firebase.database.ServerValue.TIMESTAMP,
          state: null
        });
      } catch (x) {
        say('Could not restart: ' +
          (x.code || x.message));
      }
    }

    menu.addEventListener('click', async e => {
      const b = e.target.closest &&
        e.target.closest(
          '#restartGameButton, #editPlayersButton'
        );

      if (!b || !code) return;

      e.stopImmediatePropagation();
      e.preventDefault();
      menu.style.display = 'none';

      if (b.id === 'editPlayersButton') {
        if (isHost && phase === 'lobby') {
          overlay.style.display = 'flex';
          render();
          box.querySelector('#oSettings')?.focus();
          return;
        }
        return say('In online games, players join from their own phones');
      }

      if (!active) {
        return say('The game hasn’t started yet');
      }

      if (!isHost) {
        return say('Only the host can restart the game');
      }

      if (!confirm(
        'Restart the game for everyone? You’ll all go back to the lobby.'
      )) return;

      await restartAll();
    }, true);

    function applyState(s) {
      if (
        !s ||
        !s.n ||
        s.n <= lastN ||
        !baseDeck.length ||
        blocked
      ) return;

      clearNudge();

      const n = s.n;
      const seed = playingSeed;
      const len = order.length || 1;

      lastN = curN = n;
      drawnCount = Math.max(-1, n - 2);

      const drawnIndex = order.findIndex(p =>
        p.uid === s.by
      );

      currentPlayerIndex = drawnIndex >= 0
        ? drawnIndex
        : (n - 1) % len;

      currentRound =
        Math.floor((n - 1) / len) + 1;

      const c = cardFor(n);

      cardBack.dataset.content = c.content;
      cardBack.dataset.type = c.type;
      cardBack.dataset.categoryColour = c.colour;

      flipCard();

      const nextIndex = order.findIndex(p =>
        p.uid === s.next
      );

      if (nextIndex >= 0) {
        currentPlayerIndex = nextIndex;
      }
      paintOnlineTurn();
      paintRoster();

      setTimeout(() => {
        if (playingSeed === seed && curN === n) nudge();
      }, 750);

      if (finished()) {
        setTimeout(() => {
          if (playingSeed === seed && curN === n && !blocked) {
            resultsOpen = true;
            overlay.style.display = 'flex';
            render();
          }
        }, 2200);
      }
    }

    const finished = () =>
      !unlimitedRounds &&
      curN >= (
        (meta && meta.total) ||
        totalRounds * players.length
      );

    const canDraw = () =>
      !amSpectator() &&
      (
        isHost ||
        (
          order[currentPlayerIndex] &&
          order[currentPlayerIndex].uid === uid
        )
      );

    async function draw() {
      if (drawing || !connected) {
        if (!connected) {
          say('Waiting for connection…');
        }
        return;
      }

      if (!baseDeck.length) {
        return say('No cards in the selected categories.');
      }

      drawing = true;
      clearNudge();

      const n = curN + 1;
      const seed = playingSeed;

      try {
        const res = await root()
          .child('state')
          .transaction(cur => {
            if (
              seed !== playingSeed ||
              (cur?.seed && cur.seed !== seed) ||
              ((cur && cur.n) || 0) !== n - 1 ||
              !order.length
            ) return;

            const currentUid =
              (cur && cur.next) || order[0].uid;

            if (!isHost && currentUid !== uid) {
              return;
            }

            const index = order.findIndex(p =>
              p.uid === currentUid
            );

            if (index < 0) return;

            return {
              n,
              prev: n - 1,
              seed,
              by: uid,
              lastActivity: firebase.database.ServerValue.TIMESTAMP,
              next: order[
                (index + 1) % order.length
              ].uid
            };
          });

        if (!res.committed) {
          say('Someone just drew, hang on…');
        }
      } catch (x) {
        say('Could not draw: ' +
          (x.code || x.message));
      } finally {
        drawing = false;
      }
    }

    function intercept(e) {
      const inLobby =
        !!code && phase === 'lobby';

      if (!active && !inLobby) return;

      if (
        e.type === 'keydown' &&
        !(
          e.key === ' ' ||
          e.key === 'Enter' ||
          e.code === 'Space'
        )
      ) return;

      e.stopImmediatePropagation();
      e.preventDefault();

      if (inLobby) {
        overlay.style.display = 'flex';
        render();
        return say('Waiting for the host to start');
      }

      if (!connected) {
        return say('Reconnecting — please wait');
      }

      if (blocked) {
        overlay.style.display = 'flex';
        render();
        return say('Update your cards first');
      }

      if (amSpectator()) {
        return say('You’re watching. Only players can draw.');
      }

      if (finished()) {
        return say('Game complete! 🎉');
      }

      if (!canDraw()) {
        return say(currentTurnStatus());
      }

      draw();
    }

    coverCard.addEventListener(
      'click', intercept, true
    );
    coverCard.addEventListener(
      'keydown', intercept, true
    );

    async function keepAwake() {
      try {
        if (
          navigator.wakeLock &&
          document.visibilityState === 'visible' &&
          !wake
        ) {
          wake = await navigator.wakeLock.request('screen');
          wake.addEventListener('release', () => {
            wake = null;
          });
        }
      } catch (x) {}
    }

    document.addEventListener(
      'visibilitychange',
      () => {
        if (active) keepAwake();
      }
    );

    if (invite) {
      overlay.style.display = 'flex';
      render();
    }

    (async function resume() {
      const c = saved('udcOnSession');
      if (!c) return;

      if (invite && invite.code !== c) return;

      await ready;
      if (!uid) return;

      await cardsReady();

      try {
        code = c;

        const m = (
          await root().child('meta').once('value')
        ).val();

        const mine = m && (
          await root()
            .child('players/' + uid)
            .once('value')
        ).val();

        if (!m || !mine) {
          code = null;
          keep('udcOnSession', '');
          return;
        }

        await enter(
          mine.spectator ? 'watch' : 'join',
          mine.name,
          mine.colour
        );

        if (code) {
          say('Rejoined game ' + code);
          if (!m.started) {
            overlay.style.display = 'flex';
            render();
          }
        }
      } catch (x) {
        code = null;
      }
    })();

  } // end init
})();