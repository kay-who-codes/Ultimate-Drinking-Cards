// Rules dialog and searchable card list.
;(() => {
  // ---------- Rules modal ----------
  const showRulesLink = document.getElementById("showRulesLink");
  const rulesModal = document.getElementById("rulesModal");
  const closeRulesButton = document.getElementById("closeRulesButton");
  const viewAllCardsButton = document.getElementById("viewAllCardsButton");
  const rulesText = document.getElementById("rulesText");

  let rulesViewMode = "rules";

  const embeddedRulesHTML = `
    <h2>How to Play</h2>
    <ol>
      <li>Take it in turns tapping the card to draw a new one.</li>
      <li><span class="rule-card-tag white">White card</span> Perform the instruction shown on the card.</li>
      <li><span class="rule-card-tag black">Black card</span> Invert the instruction, then perform the inverted version.</li>
      <li><span class="rule-card-tag red">Red card</span> Perform the instruction, but do it <strong>three times</strong>!</li>
    </ol>
    <h3>Black cards:</h3>
    <ul>
      <li>The player who draws a black card determines the inversion of the instruction.</li>
      <li>Some inverted instructions make more sense than others.</li>
      <li>Don't worry if a card isn't easily invertible &mdash; just try it, stay chill, and have fun.</li>
    </ul>
    <p class="tip">Tip: use the ⚙️ menu to add players, set the number of rounds, change the theme, or turn categories on/off at any time.</p>
  `;

  function buildAllCardsControlsHTML() {
    const categories = getUniqueCategories();
    const options = categories
      .map((cat) => `<option value="${escapeHTML(cat)}">${escapeHTML(cat)}</option>`)
      .join("");
    return `
      <div class="all-cards-controls">
        <input type="text" id="allCardsSearchInput" placeholder="Search cards...">
        <select id="allCardsCategoryFilter">
          <option value="">All Categories</option>
          ${options}
        </select>
      </div>
    `;
  }

  function buildAllCardsListHTML(searchTerm, categoryFilter) {
    if (!allDraws.length) {
      return `<p class="all-cards-empty">Cards are still loading &mdash; give it a moment and try again.</p>`;
    }

    const term = (searchTerm || "").trim().toLowerCase();
    const filtered = allDraws.filter((c) => {
      const matchesCategory = !categoryFilter || c.Category === categoryFilter;
      if (!matchesCategory) return false;
      if (!term) return true;
      const rule = (c.Rule || "").toLowerCase();
      const category = (c.Category || "").toLowerCase();
      return rule.includes(term) || category.includes(term);
    });

    if (!filtered.length) {
      return `<p class="all-cards-empty">No cards match your search.</p>`;
    }

    const rows = filtered
      .map((c) => {
        const colour = c.Colour || "#999999";
        return `
          <li>
            <span class="all-cards-category-tag" style="background-color: ${colour};">${escapeHTML(c.Category || "")}</span>
            ${escapeHTML(c.Rule || "")}
          </li>
        `;
      })
      .join("");

    return `<p class="all-cards-count">Showing ${filtered.length} of ${allDraws.length} cards</p><ul class="all-cards-list">${rows}</ul>`;
  }

  function displayEmbeddedRules() {
    rulesText.innerHTML = embeddedRulesHTML;
    rulesViewMode = "rules";
    viewAllCardsButton.textContent = "View All Cards";
    rulesModal.style.display = "flex";
  }

  function displayAllCards() {
    rulesText.innerHTML = `
      <h2>All Cards</h2>
      ${buildAllCardsControlsHTML()}
      <div id="allCardsListContainer">${buildAllCardsListHTML("", "")}</div>
    `;
    rulesViewMode = "cards";
    viewAllCardsButton.textContent = "Back to Rules";

    const searchInput = document.getElementById("allCardsSearchInput");
    const categoryFilter = document.getElementById("allCardsCategoryFilter");
    const listContainer = document.getElementById("allCardsListContainer");

    function refreshList() {
      listContainer.innerHTML = buildAllCardsListHTML(searchInput.value, categoryFilter.value);
    }

    searchInput.addEventListener("input", refreshList);
    categoryFilter.addEventListener("change", refreshList);
  }

  showRulesLink.addEventListener("click", (event) => {
    event.preventDefault();
    displayEmbeddedRules();
  });

  viewAllCardsButton.addEventListener("click", () => {
    if (rulesViewMode === "rules") {
      displayAllCards();
    } else {
      displayEmbeddedRules();
    }
  });

  closeRulesButton.addEventListener("click", () => {
    rulesModal.style.display = "none";
  });

  rulesModal.addEventListener("click", (e) => {
    if (e.target === rulesModal) rulesModal.style.display = "none";
  });
})();
