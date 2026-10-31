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
  const themes = [
    { id: "mono",     label: "Mono",     bg: "#101010", accent: "#9a9a9a",
      cardBg: "#ffffff", cardText: "#000000",
      cardBlackBg: "#000000", cardBlackText: "#ffffff",
      cardRedBg: "#4d4d4d", cardRedText: "#ffffff",
      panelBg: "#eeeeee", panelText: "#101010" },
    { id: "classic",  label: "Classic",  bg: "#131313", accent: "#ff6347",
      cardBg: "#ffffff", cardText: "#000000",
      cardBlackBg: "#000000", cardBlackText: "#ffffff",
      cardRedBg: "#8b0000", cardRedText: "#ffffff",
      panelBg: "#e3e3e3", panelText: "#000000" },
    { id: "midnight", label: "Midnight", bg: "#0b0f2b", accent: "#5da9ff",
      cardBg: "#eef3ff", cardText: "#0b0f2b",
      cardBlackBg: "#050814", cardBlackText: "#bcd4ff",
      cardRedBg: "#7a1030", cardRedText: "#ffe3ec",
      panelBg: "#e6ecff", panelText: "#0b0f2b" },
    { id: "emerald",  label: "Emerald",  bg: "#0d1f16", accent: "#3ddc84",
      cardBg: "#eafff2", cardText: "#0d1f16",
      cardBlackBg: "#04120a", cardBlackText: "#9df5c0",
      cardRedBg: "#6e1414", cardRedText: "#ffe3e3",
      panelBg: "#e2f5e9", panelText: "#0d1f16" },
    { id: "plum",     label: "Plum",     bg: "#1e0f24", accent: "#c66bff",
      cardBg: "#f6ecff", cardText: "#1e0f24",
      cardBlackBg: "#100713", cardBlackText: "#e2b8ff",
      cardRedBg: "#7a1140", cardRedText: "#ffe1ef",
      panelBg: "#efe1fb", panelText: "#1e0f24" },
    { id: "sunset",   label: "Sunset",   bg: "#241205", accent: "#ffb347",
      cardBg: "#fff4e6", cardText: "#241205",
      cardBlackBg: "#130a03", cardBlackText: "#ffd699",
      cardRedBg: "#8a1a1a", cardRedText: "#ffe6e6",
      panelBg: "#fdeedb", panelText: "#241205" },
  ];

  const customThemePanel = document.getElementById("customThemePanel");
  const customBgInput = document.getElementById("customBgInput");
  const customAccentInput = document.getElementById("customAccentInput");
  const customCardBgInput = document.getElementById("customCardBgInput");
  const customPanelBgInput = document.getElementById("customPanelBgInput");

  function readableTextColor(hex) {
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 150 ? "#000000" : "#ffffff";
  }

  function applyTheme(themeId) {
    if (themeId === "custom") {
      customThemePanel.style.display = "block";
      document.querySelectorAll(".theme-swatch").forEach(el => {
        el.classList.toggle("active", el.dataset.themeId === "custom");
      });
      try { localStorage.setItem("udcTheme", "custom"); } catch (e) {}
      return;
    }
    customThemePanel.style.display = "none";

    const t = themes.find(t => t.id === themeId) || themes[0];
    const root = document.documentElement;
    root.style.setProperty("--bg", t.bg);
    root.style.setProperty("--accent", t.accent);
    root.style.setProperty("--card-bg", t.cardBg);
    root.style.setProperty("--card-text", t.cardText);
    root.style.setProperty("--card-black-bg", t.cardBlackBg);
    root.style.setProperty("--card-black-text", t.cardBlackText);
    root.style.setProperty("--card-red-bg", t.cardRedBg);
    root.style.setProperty("--card-red-text", t.cardRedText);
    root.style.setProperty("--panel-bg", t.panelBg);
    root.style.setProperty("--panel-text", t.panelText);
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
    root.style.setProperty("--card-bg", cardBg);
    root.style.setProperty("--card-text", readableTextColor(cardBg));
    root.style.setProperty("--card-black-bg", "#000000");
    root.style.setProperty("--card-black-text", "#ffffff");
    root.style.setProperty("--card-red-bg", "#8b0000");
    root.style.setProperty("--card-red-text", "#ffffff");
    root.style.setProperty("--panel-bg", panelBg);
    root.style.setProperty("--panel-text", readableTextColor(panelBg));
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
    themes.forEach(t => {
      const sw = document.createElement("div");
      sw.className = "theme-swatch";
      sw.dataset.themeId = t.id;
      sw.title = t.label;
      sw.style.background = `linear-gradient(135deg, ${t.bg} 50%, ${t.accent} 50%)`;
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
      trackingEnabled
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