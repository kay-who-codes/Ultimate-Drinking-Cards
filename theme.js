// theme.js — Theme menu: swatches, custom colour picker, and persistence via localStorage.
// Extracted from the main inline script. Loaded before it, so its immediate-run code
// (buildThemeSwatches/applyTheme calls) executes first; its click-handler callbacks
// (editPlayersButton/restartGameButton) reference game-state functions defined in the
// main script, which is fine since they only run later, on click.

  // ---------- Theme menu ----------
  const cogButton = document.getElementById("cogButton");
  const themeMenu = document.getElementById("themeMenu");
  const themeSwatchRow = document.getElementById("themeSwatchRow");
  const editPlayersButton = document.getElementById("editPlayersButton");
  const restartGameButton = document.getElementById("restartGameButton");
  const categoryList = document.getElementById("categoryList");

    const customThemePanel = document.getElementById("customThemePanel");
  const customBgInput = document.getElementById("customBgInput");
  const customAccentInput = document.getElementById("customAccentInput");
  const customCardBgInput = document.getElementById("customCardBgInput");
  const customPanelBgInput = document.getElementById("customPanelBgInput");

  // Every theme now also controls the black-card and red-card variants,
  // so switching themes recolours the cards themselves, not just the UI chrome.
  // animatedBg: "spooky" opts a theme into the drifting Halloween emoji layer.
  const themes = [
    { id: "classic",  label: "Classic",  bg: "#080808F1", accent: "#FFFDFD",
      cardBg: "#ffffff", cardText: "#000000",
      cardBlackBg: "#000000", cardBlackText: "#ffffff",
      cardRedBg: "#DB0000", cardRedText: "#ffffff",
      panelBg: "#e3e3e3", panelText: "#000000", accentText: "#000000" },
    
    { id: "darker",     label: "Darker",     bg: "#080808", accent: "#303030",
      cardBg: "#111111", cardText: "#E7E7E7",
      cardBlackBg: "#000000", cardBlackText: "#ffffff",
      cardRedBg: "#571212", cardRedText: "#ffffff",
      panelBg: "#eeeeee", panelText: "#101010", accentText: "#101010" },
      
    { id: "crimson", label: "Crimson", bg: "#1A0101", accent: "#FF4B4B",
      cardBg: "#ffffff", cardText: "#000000",
      cardBlackBg: "#000000", cardBlackText: "#ffffff",
      cardRedBg: "#DB0000", cardRedText: "#ffffff",
      panelBg: "#e3e3e3", panelText: "#160606", accentText: "#000000" },

    { id: "sunset", label: "Sunset", bg: "#381B02", accent: "#FF9A47",
      cardBg: "#FFFBF6", cardText: "#1D140E",
      cardBlackBg: "#000000", cardBlackText: "#ffffff",
      cardRedBg: "#DB0000", cardRedText: "#ffffff",
      panelBg: "#FDE7DB", panelText: "#241205", accentText: "#241205" },

    { id: "wheat", label: "Wheat", bg: "#3B2E04", accent: "#FFFB00",
      cardBg: "#FFFFE6", cardText: "#1B190D",
      cardBlackBg: "#000000", cardBlackText: "#ffffff",
      cardRedBg: "#DB0000", cardRedText: "#ffffff",
      panelBg: "#fdeedb", panelText: "#242205", accentText: "#242305" },

    { id: "acid", label: "Acid", bg: "#0C1607", accent: "#26DD35",
      cardBg: "#e2f5e9", cardText: "#0C1308",
      cardBlackBg: "#000000", cardBlackText: "#ffffff",
      cardRedBg: "#DB0000", cardRedText: "#ffffff",
      panelBg: "#d1e8d9", panelText: "#0d1f16", accentText: "#0d1f16" },

    { id: "seasalt", label: "Seasalt", bg: "#031812", accent: "#00FFD5",
      cardBg: "#FFFFE6", cardText: "#241205",
      cardBlackBg: "#000000", cardBlackText: "#ffffff",
      cardRedBg: "#DB0000", cardRedText: "#ffffff",
      panelBg: "#e4f2fb", panelText: "#001a1a", accentText: "#001a1a" },

    { id: "midnight", label: "Midnight", bg: "#050814", accent: "#327AFF",
      cardBg: "#eef3ff", cardText: "#0b0f2b",
      cardBlackBg: "#000000", cardBlackText: "#ffffff",
      cardRedBg: "#DB0000", cardRedText: "#ffffff",
      panelBg: "#e6ecff", panelText: "#0b0f2b", accentText: "#0b0f2b" },

    { id: "plum", label: "Plum", bg: "#0E0818", accent: "#9F6BFF",
      cardBg: "#f6ecff", cardText: "#1e0f24",
      cardBlackBg: "#000000", cardBlackText: "#ffffff",
      cardRedBg: "#DB0000", cardRedText: "#ffffff",
      panelBg: "#efe1fb", panelText: "#180F24", accentText: "#160F24" },

    { id: "rose", label: "Rose", bg: "#240F22", accent: "#FF6BDA",
      cardBg: "#FFECFA", cardText: "#120C14",
      cardBlackBg: "#000000", cardBlackText: "#ffffff",
      cardRedBg: "#DB0000", cardRedText: "#ffffff",
      panelBg: "#FBE1F7", panelText: "#240F22", accentText: "#240F1F" },
    
      { id: "sky", label: "Sky", bg: "#10243e", accent: "#438ec1",
      cardBg: "#f5f9ff", cardText: "#101c2b",
      cardBlackBg: "#000000", cardBlackText: "#ffffff",
      cardRedBg: "#DB0000", cardRedText: "#ffffff",
      panelBg: "#e7eff8", panelText: "#101c2b" },




    { id: "brewery", label: "Brewery", bg: "#221D04", accent: "#FFE341",
      cardBg: "#FFFFE6", cardText: "#241205",
      cardBlackBg: "#000000", cardBlackText: "#FFDF27",
      cardRedBg: "#DB0000", cardRedText: "#ffffff",
      panelBg: "#fdeedb", panelText: "#242305", accentText: "#242305",
      animatedBg: "brewery" },

    { id: "ocean", label: "Ocean", bg: "#04121f", accent: "#2ec4ff",
      cardBg: "#eaf7ff", cardText: "#04121f",
      cardBlackBg: "#000000", cardBlackText: "#9fe4ff",
      cardRedBg: "#DB0000", cardRedText: "#ffffff",
      panelBg: "#e4f2fb", panelText: "#04121f", 
      animatedBg: "ocean"},

    { id: "halloween", label: "Halloween", bg: "#0E0918", accent: "#6A05BD",
      cardBg: "#DDFFDD", cardText: "#1a0d02",
      cardBlackBg: "#000000", cardBlackText: "#FF7C10",
      cardRedBg: "#DB0000", cardRedText: "#ffffff",
      panelBg: "#f5e6d3", panelText: "#1a0d02", accentText: "#1a0d02",
      animatedBg: "spooky" },
    
    { id: "christmas", label: "Christmas", bg: "#0C1313", accent: "#A9FF8F",
      cardBg: "#FFDBDB", cardText: "#1a0d02",
      cardBlackBg: "#000000", cardBlackText: "#52FF8C",
      cardRedBg: "#DB0000", cardRedText: "#ffffff",
      panelBg: "#f5f0e6", panelText: "#1a0d02",
      animatedBg: "christmas" },

  ];

  // Animated Theme Emojis
const EMOJI_SETS = {
  brewery:   ["🍺", "🍻", "🥂"],
  ocean:     ["🌊", "🐠", "🐚", "🫧"],
  spooky:    ["🕷️", "👻", "🕸️", "🎃", "🦇"],
  christmas: ["❄️"],
};
const EMOJI_COUNT = 14;
  let emojiContainer = null;
let currentEmojiSet = null;

function buildEmojiBackground(setName) {
  const emojis = EMOJI_SETS[setName];
  if (!emojis) return;

  // Reuse the container, but repopulate if the set changed.
  if (!emojiContainer) {
    emojiContainer = document.createElement("div");
    emojiContainer.id = "spookyBg";          // keep the id so existing CSS applies
    emojiContainer.setAttribute("aria-hidden", "true");
    document.body.appendChild(emojiContainer);
  }
  if (currentEmojiSet === setName) return;   // already built for this set
  currentEmojiSet = setName;

  // Tag the container so per-set CSS (e.g. falling vs rising emoji) can match.
  emojiContainer.classList.toggle("christmas", setName === "christmas");

  emojiContainer.innerHTML = "";

  emojiContainer.innerHTML = "";
  for (let i = 0; i < EMOJI_COUNT; i++) {
    const el = document.createElement("span");
    el.className = "spookyEmoji";
    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];

    const left = Math.random() * 100;
    const size = 22 + Math.random() * 46;
    const blur = 1 + Math.random() * 3;
    const duration = 14 + Math.random() * 18;
    const delay = -Math.random() * duration;
    const opacity = 0.18 + Math.random() * 0.22;

    el.style.left = `${left}vw`;
    el.style.fontSize = `${size}px`;
    el.style.filter = `blur(${blur}px)`;
    el.style.animationDuration = `${duration}s`;
    el.style.animationDelay = `${delay}s`;
    el.style.opacity = opacity.toFixed(2);

    emojiContainer.appendChild(el);
  }
}

function setEmojiBackground(setName) {
  if (setName) {
    buildEmojiBackground(setName);
    if (emojiContainer) emojiContainer.classList.add("active");
  } else if (emojiContainer) {
    emojiContainer.classList.remove("active");
  }
}

  function readableTextColor(hex) {
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 150 ? "#000000" : "#ffffff";
  }

  function hexToRgba(hex, alpha = 1) {
  if (typeof hex !== "string") return `rgba(153,153,153,${alpha})`;
  const c = hex.replace('#', '').trim();
  const full = c.length === 3 ? c.split('').map(x => x + x).join('') : c;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return `rgba(153,153,153,${alpha})`;
  const r = parseInt(full.substring(0, 2), 16);
  const g = parseInt(full.substring(2, 4), 16);
  const b = parseInt(full.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

  const SKY_DAY_MINUTES = 24 * 60;
  const SKY_PHASES = [
    { minute: 6 * 60,       colours: ["#25284d", "#a45176", "#fabb90"] }, // Dawn
    { minute: 9 * 60,       colours: ["#174674", "#438ec1", "#bddfeb"] }, // Morning
    { minute: 13 * 60,      colours: ["#104674", "#2f84bb", "#80c6de"] }, // Afternoon
    { minute: 18 * 60 + 30, colours: ["#2c254d", "#a54f63", "#f6ad66"] }, // Evening
    { minute: 23 * 60,      colours: ["#080c20", "#25395d", "#475e83"] }  // Night
  ];
  let skyUpdateTimer = null;
  let skyCloudLayer = null;

  const skyThemeStyle = document.createElement("style");
  skyThemeStyle.textContent = `
    html[data-udc-sky] body {
      background-image: var(--udc-sky-gradient);
      background-attachment: fixed;
      isolation: isolate;
    }

    .udc-sky-clouds {
      position: fixed;
      inset: 0 0 auto;
      height: calc(100vh / 3);
      height: calc(100dvh / 3);
      overflow: hidden;
      pointer-events: none;
      z-index: -1;
    }

    .udc-sky-cloud {
      --cloud-size: min(var(--cloud-width), 400vw, 80vh);
      position: absolute;
      left: 0;
      top: clamp(0px, var(--cloud-top), 100% - var(--cloud-size));
      font-size: var(--cloud-size);
      line-height: 1;
      opacity: var(--cloud-opacity);
      animation: udc-sky-cloud-drift var(--cloud-duration) linear
        var(--cloud-delay) infinite var(--cloud-direction);
    }

    @keyframes udc-sky-cloud-drift {
      from { transform: translateX(-100%); }
      to { transform: translateX(100vw); }
    }

    @media (prefers-reduced-motion: reduce) {
      .udc-sky-cloud {
        left: var(--cloud-static-left);
        transform: translateX(-50%);
        animation: none;
      }
    }
  `;
  document.head.appendChild(skyThemeStyle);

  function mixSkyColour(from, to, progress) {
    const channels = [1, 3, 5].map(index => {
      const start = parseInt(from.slice(index, index + 2), 16);
      const end = parseInt(to.slice(index, index + 2), 16);
      return Math.round(start + (end - start) * progress)
        .toString(16).padStart(2, "0");
    });
    return "#" + channels.join("");
  }

  function skyColoursAt(date) {
    const minute = date.getHours() * 60 + date.getMinutes() +
      date.getSeconds() / 60 + date.getMilliseconds() / 60000;
    const first = SKY_PHASES[0];
    const last = SKY_PHASES[SKY_PHASES.length - 1];
    const nextIndex = SKY_PHASES.findIndex(phase => phase.minute > minute);
    const start = nextIndex <= 0 ? last : SKY_PHASES[nextIndex - 1];
    const end = nextIndex < 0 ? first : SKY_PHASES[nextIndex];
    const startMinute = start.minute - (nextIndex === 0 ? SKY_DAY_MINUTES : 0);
    const endMinute = end.minute + (nextIndex < 0 ? SKY_DAY_MINUTES : 0);
    const progress = (minute - startMinute) / (endMinute - startMinute);
    return start.colours.map((colour, index) => mixSkyColour(colour, end.colours[index], progress));
  }

  function skyGradient([top, accent, horizon]) {
    return `linear-gradient(180deg, ${top} 0%, ${accent} 30%, ${horizon} 100%)`;
  }

function saturateSkyColour(hex, multiplier) {
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const min = Math.min(...rgb);
  const max = Math.max(...rgb);
  if (min === max) return hex;

  const lightness = (min + max) / 2;
  const halfRange = (max - min) / 2;
  const maxScale = Math.min(lightness, 255 - lightness) / halfRange;
  const scale = Math.min(multiplier, maxScale);

  return "#" + rgb.map(channel =>
    Math.round(lightness + (channel - lightness) * scale)
      .toString(16).padStart(2, "0")
  ).join("");
}

function updateSkyTheme() {
  const root = document.documentElement;
  const colours = skyColoursAt(new Date());
  const midpoint = mixSkyColour(colours[1], colours[2], (50 - 44) / (100 - 44));
  const accent = saturateSkyColour(midpoint, 2.5);

  root.style.setProperty("--udc-sky-gradient", skyGradient(colours));
  root.style.setProperty("--accent", accent);
  root.style.setProperty("--accent-text", readableTextColor(accent));
}

  function buildSkyClouds() {
    const layer = document.createElement("div");
    layer.className = "udc-sky-clouds";
    layer.setAttribute("aria-hidden", "true");
    const cloudEmoji = "☁️";

    // Each direction shares its own cycle so clouds in that group stay staggered.
    const tracks = [
      { count: 3, direction: "normal", duration: 220 + Math.random() * 40 },
      { count: 2, direction: "reverse", duration: 270 + Math.random() * 50 }
    ];

    let cloudIndex = 0;
    for (const track of tracks) {
      const trackOffset = Math.random();
      for (let i = 0; i < track.count; i++) {
        const phase = (trackOffset + (i + Math.random() * 0.3) / track.count) % 1;
        const cloud = document.createElement("span");
        cloud.className = "udc-sky-cloud";
        cloud.textContent = cloudEmoji;
        cloud.style.setProperty("--cloud-width", (88 + Math.random() * 76) + "px");
        cloud.style.setProperty("--cloud-top", (cloudIndex * 12 + Math.random() * 8) + "%");
        cloud.style.setProperty("--cloud-opacity", (0.18 + Math.random() * 0.15).toFixed(2));
        cloud.style.setProperty("--cloud-duration", track.duration + "s");
        cloud.style.setProperty("--cloud-delay", (-phase * track.duration) + "s");
        cloud.style.setProperty("--cloud-direction", track.direction);
        cloud.style.setProperty("--cloud-static-left", (12 + cloudIndex * 19) + "%");
        layer.appendChild(cloud);
        cloudIndex++;
      }
    }

    document.body.appendChild(layer);
    return layer;
  }

  function stopSkyTheme() {
    if (skyUpdateTimer === null) return;
    clearInterval(skyUpdateTimer);
    skyUpdateTimer = null;
    skyCloudLayer?.remove();
    skyCloudLayer = null;
    const root = document.documentElement;
    root.removeAttribute("data-udc-sky");
    root.style.removeProperty("--udc-sky-gradient");
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && skyUpdateTimer !== null) updateSkyTheme();
  });

  function applyTheme(themeId) {
    stopSkyTheme();
    if (themeId === "custom") {
      customThemePanel.style.display = "block";
      document.querySelectorAll(".theme-swatch").forEach(el => {
        el.classList.toggle("active", el.dataset.themeId === "custom");
      });
      setEmojiBackground(false);
      try { localStorage.setItem("udcTheme", "custom"); } catch (e) {}
      return;
    }
    customThemePanel.style.display = "none";

    const t = themes.find(t => t.id === themeId) || themes[0];
    const root = document.documentElement;
    root.style.setProperty("--bg", t.bg);
    root.style.setProperty("--accent", t.accent);
    root.style.setProperty("--accent-text", readableTextColor(t.accent));
    root.style.setProperty("--card-bg", t.cardBg);
    root.style.setProperty("--card-text", t.cardText);
    root.style.setProperty("--card-black-bg", t.cardBlackBg);
    root.style.setProperty("--card-black-text", t.cardBlackText);
    root.style.setProperty("--card-red-bg", t.cardRedBg);
    root.style.setProperty("--card-red-text", t.cardRedText);
    root.style.removeProperty("--menu-glass-tint");
    root.style.setProperty("--panel-bg", t.panelBg);
    root.style.setProperty("--panel-text", t.panelText);

    if (t.id === "sky") {
      updateSkyTheme();
      root.setAttribute("data-udc-sky", "");
      skyCloudLayer = buildSkyClouds();
      skyUpdateTimer = setInterval(updateSkyTheme, 10000);
    }

  // Only themes that opt in get the drifting emoji layer.
  setEmojiBackground(t.animatedBg || null);

    document.querySelectorAll(".theme-swatch").forEach(el => {
      el.classList.toggle("active", el.dataset.themeId === themeId);
    });
    try { localStorage.setItem("udcTheme", themeId); } catch (e) {}
  }

  function applyCustomTheme(save = true) {
    stopSkyTheme();
    const bg = customBgInput.value;
    const accent = customAccentInput.value;
    const cardBg = customCardBgInput.value;
    const panelBg = customPanelBgInput.value;
    const root = document.documentElement;
    root.style.setProperty("--bg", bg);
    root.style.setProperty("--accent", accent);
    root.style.setProperty("--accent-text", readableTextColor(accent));
    root.style.setProperty("--card-bg", cardBg);
    root.style.setProperty("--card-text", readableTextColor(cardBg));
    root.style.setProperty("--card-black-bg", "#000000");
    root.style.setProperty("--card-black-text", "#ffffff");
    root.style.setProperty("--card-red-bg", "#8b0000");
    root.style.setProperty("--card-red-text", "#ffffff");
    root.style.setProperty("--panel-bg", panelBg);
    root.style.setProperty("--menu-glass-tint", hexToRgba(panelBg, 0.28));
    root.style.setProperty("--panel-text", readableTextColor(panelBg));
    setEmojiBackground(false);
    document.querySelectorAll(".theme-swatch").forEach(el => {
      el.classList.toggle("active", el.dataset.themeId === "custom");
    });
    if (save) {
      try {
        localStorage.setItem("udcTheme", "custom");
        localStorage.setItem("udcCustomColors", JSON.stringify({ bg, accent, cardBg, panelBg }));
      } catch (e) {}
    }
  }

  [customBgInput, customAccentInput, customCardBgInput, customPanelBgInput].forEach(input => {
    input.addEventListener("input", () => applyCustomTheme(true));
  });

function buildThemeSwatches() {
  themeSwatchRow.innerHTML = "";

  // Optional emoji shown on top of an animated theme's swatch.
  const SWATCH_EMOJI = {
    brewery: "🍺",
    ocean: "🌊",
    halloween: "🎃",
    christmas: "🎄",
  };

  themes.forEach(t => {
    const sw = document.createElement("div");
    sw.className = "theme-swatch";
    sw.dataset.themeId = t.id;
    sw.title = t.label;
    sw.style.backgroundImage = t.id === "sky"
      ? `linear-gradient(90deg, ${SKY_PHASES[1].colours.join(", ")})`
      : `radial-gradient(circle, ${t.accent} 0 90%, ${t.bg} 38%)`;

    const emoji = SWATCH_EMOJI[t.id];
    if (emoji) {
      const glyph = document.createElement("span");
      glyph.className = "theme-swatch-emoji";
      glyph.textContent = emoji;
      glyph.setAttribute("aria-hidden", "true"); // title already names the theme
      sw.appendChild(glyph);
    }

    sw.addEventListener("click", () => applyTheme(t.id));
    themeSwatchRow.appendChild(sw);
  });

    const customSw = document.createElement("div");
    customSw.className = "theme-swatch";
    customSw.dataset.themeId = "custom";
    customSw.title = "Custom";
    customSw.style.backgroundImage =
      "linear-gradient(90deg, #ff5470, #ffc857, #5ee49a, #52b9ff, #a76bff)";
    customSw.addEventListener("click", () => applyTheme("custom"));
    themeSwatchRow.prepend(customSw);
  }

  cogButton.addEventListener("click", (e) => {
    e.stopPropagation();
    themeMenu.style.display = themeMenu.style.display === "block" ? "none" : "block";
  });

  document.addEventListener("click", (e) => {
    if (themeMenu.style.display === "block" && !themeMenu.contains(e.target) && e.target !== cogButton) {
      themeMenu.style.display = "none";
    }
  });

  editPlayersButton.addEventListener("click", () => {
    themeMenu.style.display = "none";
    resetSetupFields(
      players.length ? players : ["", ""],
      Number.isFinite(totalRounds) ? totalRounds : 5,
      unlimitedRounds,
      trackingEnabled,
      randomiseOrderCheckbox.checked          // ADDED
    );
    openSetupOverlay();
  });

  restartGameButton.addEventListener("click", () => {
    themeMenu.style.display = "none";
    if (trackingEnabled && players.length === 0) {
      resetSetupFields();
      openSetupOverlay();
      return;
    }
    currentPlayerIndex = 0;
    currentRound = 1;
    gameStarted = true;
    buildDeckFromEnabledCategories();
    preloadNextCard();
    updateTurnTracker();
  });

  // Load saved theme (defaults to monochrome)
  try {
    const savedTheme = localStorage.getItem("udcTheme");
    buildThemeSwatches();
    if (savedTheme === "custom") {
      const saved = JSON.parse(localStorage.getItem("udcCustomColors") || "null");
      if (saved) {
        customBgInput.value = saved.bg;
        customAccentInput.value = saved.accent;
        customCardBgInput.value = saved.cardBg;
        customPanelBgInput.value = saved.panelBg;
        applyCustomTheme(false);
        customThemePanel.style.display = "block";
        document.querySelectorAll(".theme-swatch").forEach(el => {
          el.classList.toggle("active", el.dataset.themeId === "custom");
        });
      } else {
        applyTheme("mono");
      }
    } else {
      applyTheme(savedTheme || "mono");
    }
  } catch (e) {
    buildThemeSwatches();
    applyTheme("mono");
  }
