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

  // Every theme now also controls the black-card and red-card variants,
  // so switching themes recolours the cards themselves, not just the UI chrome.
  // animatedBg: "spooky" opts a theme into the drifting Halloween emoji layer.
  const themes = [
    { id: "classic",  label: "Classic",  bg: "#131313", accent: "#FFFDFD",
      cardBg: "#ffffff", cardText: "#000000",
      cardBlackBg: "#000000", cardBlackText: "#ffffff",
      cardRedBg: "#DB0000", cardRedText: "#ffffff",
      panelBg: "#e3e3e3", panelText: "#000000", accentText: "#000000" },
    
    { id: "mono",     label: "Mono",     bg: "#101010", accent: "#9a9a9a",
      cardBg: "#ffffff", cardText: "#000000",
      cardBlackBg: "#000000", cardBlackText: "#ffffff",
      cardRedBg: "#DB0000", cardRedText: "#ffffff",
      panelBg: "#eeeeee", panelText: "#101010", accentText: "#101010" },
      
    { id: "crimson", label: "Crimson", bg: "#180707", accent: "#FF4B4B",
      cardBg: "#ffffff", cardText: "#000000",
      cardBlackBg: "#000000", cardBlackText: "#ffffff",
      cardRedBg: "#DB0000", cardRedText: "#ffffff",
      panelBg: "#e3e3e3", panelText: "#160606", accentText: "#000000" },

    { id: "sunset", label: "Sunset", bg: "#241205", accent: "#FF9A47",
      cardBg: "#fff4e6", cardText: "#241205",
      cardBlackBg: "#000000", cardBlackText: "#ffffff",
      cardRedBg: "#DB0000", cardRedText: "#ffffff",
      panelBg: "#FDE7DB", panelText: "#241205", accentText: "#241205" },

    { id: "wheat", label: "Wheat", bg: "#232405", accent: "#EEFF00",
      cardBg: "#FFFFE6", cardText: "#241205",
      cardBlackBg: "#000000", cardBlackText: "#ffffff",
      cardRedBg: "#DB0000", cardRedText: "#ffffff",
      panelBg: "#fdeedb", panelText: "#242205", accentText: "#242305" },

    { id: "acid", label: "Acid", bg: "#0d1f16", accent: "#3DDC52",
      cardBg: "#e2f5e9", cardText: "#0d1f16",
      cardBlackBg: "#000000", cardBlackText: "#ffffff",
      cardRedBg: "#DB0000", cardRedText: "#ffffff",
      panelBg: "#d1e8d9", panelText: "#0d1f16", accentText: "#0d1f16" },

    { id: "seasalt", label: "Seasalt", bg: "#001a1a", accent: "#00FFD5",
      cardBg: "#FFFFE6", cardText: "#241205",
      cardBlackBg: "#000000", cardBlackText: "#ffffff",
      cardRedBg: "#DB0000", cardRedText: "#ffffff",
      panelBg: "#e4f2fb", panelText: "#001a1a", accentText: "#001a1a" },

    { id: "midnight", label: "Midnight", bg: "#0b0f2b", accent: "#5da9ff",
      cardBg: "#eef3ff", cardText: "#0b0f2b",
      cardBlackBg: "#000000", cardBlackText: "#ffffff",
      cardRedBg: "#DB0000", cardRedText: "#ffffff",
      panelBg: "#e6ecff", panelText: "#0b0f2b", accentText: "#0b0f2b" },

    { id: "plum", label: "Plum", bg: "#170F24", accent: "#9F6BFF",
      cardBg: "#f6ecff", cardText: "#1e0f24",
      cardBlackBg: "#000000", cardBlackText: "#ffffff",
      cardRedBg: "#DB0000", cardRedText: "#ffffff",
      panelBg: "#efe1fb", panelText: "#180F24", accentText: "#160F24" },

    { id: "rose", label: "Rose", bg: "#240F22", accent: "#FF6BDA",
      cardBg: "#FFECFA", cardText: "#1e0f24",
      cardBlackBg: "#000000", cardBlackText: "#ffffff",
      cardRedBg: "#DB0000", cardRedText: "#ffffff",
      panelBg: "#FBE1F7", panelText: "#240F22", accentText: "#240F1F" },




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

  const customThemePanel = document.getElementById("customThemePanel");
  const customBgInput = document.getElementById("customBgInput");
  const customAccentInput = document.getElementById("customAccentInput");
  const customCardBgInput = document.getElementById("customCardBgInput");
  const customPanelBgInput = document.getElementById("customPanelBgInput");

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

  function applyTheme(themeId) {
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
    root.style.setProperty("--panel-bg", t.panelBg);
    root.style.setProperty("--panel-text", t.panelText);

  // Only themes that opt in get the drifting emoji layer.
  setEmojiBackground(t.animatedBg || null);

    document.querySelectorAll(".theme-swatch").forEach(el => {
      el.classList.toggle("active", el.dataset.themeId === themeId);
    });
    try { localStorage.setItem("udcTheme", themeId); } catch (e) {}
  }

  function applyCustomTheme(save = true) {
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
    sw.style.background = `radial-gradient(circle, ${t.accent} 0 90%, ${t.bg} 38%)`;

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
    customSw.style.background = "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)";
    customSw.addEventListener("click", () => applyTheme("custom"));
    themeSwatchRow.appendChild(customSw);
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