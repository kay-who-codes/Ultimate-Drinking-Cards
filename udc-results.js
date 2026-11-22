/* Shared results for online play and Local Tracker. */
const UDCResults = (() => {
  const esc = value => String(value).replace(/[&<>"]/g,
    char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));

  const BLACK_CARDS_COUNT = false;
  const NUM_WORDS = {
    a: 1, an: 1, one: 1, two: 2, three: 3,
    four: 4, five: 5, six: 6, seven: 7,
    eight: 8, nine: 9, ten: 10
  };
  const NUM_PAT = '(a|an|one|two|three|four|five|six|seven|eight|nine|ten|\\d{1,2})';
  const DRINK_PAT = '\\s+(?:more\\s+)?(?:(?:big|large|small|full|long|quick|huge|good|massive)\\s+)?(?:drinks?|swigs?)\\b';
  const DRINK_VERB_RE = new RegExp([
    '\\bas you\\s+drinks?\\b',
    '\\b(?:take|takes|have|has|drink|drinks)\\s+(?<takeCount>' + NUM_PAT + ')' + DRINK_PAT,
    '\\b(?:issue|issues|give|gives|hand out|hands out|assign|assigns|distribute|distributes|dish out|dishes out)\\s+(?:out\\s+)?(?<giveCount>' + NUM_PAT + ')' + DRINK_PAT,
    '\\b(?:drink|drinks|swig|swigs)\\b(?:\\s+(?<frequency>once|twice|thrice|' + NUM_PAT +
      '\\s+times))?(?=\\s*(?:$|[,):]|\\b(?:and|then|or)\\b))'
  ].join('|'), 'gi');
  const EXCLUDED_ASSIGNMENT_RE = /\bassign(?:s|ing)?\s+(?:someone|somebody|another player|a player|any player)\b/i;
  const DRAWER_RE = /^(?:you|the (?:current player|player who drew this card))$/i;
  const OTHER_PLAYER_RE = /^(?:they|he|she|(?:that|this|another|one|either) (?:player|person)|the (?:chosen|selected|nominated|voted) (?:player|person))$/i;

    function numOf(x) {
    x = String(x).toLowerCase();
    return NUM_WORDS[x] || parseInt(x, 10) || 0;
  }

  function parseDrinks(rule, playerCount) {
    const t = String(rule).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    const result = {
      take: 0, assigned: 0, possible: 0, likelyMin: 0, likelyMax: 0,
      expectedTake: 0, expectedUnassigned: 0,
      conditional: [], excluded: EXCLUDED_ASSIGNMENT_RE.test(t)
    };
    if (result.excluded) return result;

    for (const clause of t.split(/[.!?;]+/)) {
      const text = clause.trim();

      if (/^everyone\s*,?\s*drink\s+if\b/i.test(text)) {
        result.expectedUnassigned += playerCount * 0.5;
        continue;
      }
      if (/^drink\s+if\b/i.test(text)) {
        result.expectedTake += 0.5;
        continue;
      }

      for (const match of text.matchAll(DRINK_VERB_RE)) {
        const prefix = text.slice(0, match.index).trim();
        const { takeCount, giveCount, frequency } = match.groups;
        if (/^as you\b/i.test(match[0])) {
          // Estimate how many of the other players match the drawer.
          const low = Math.floor(Math.max(0, playerCount - 1) / 2);
          result.likelyMin += low;
          result.likelyMax += playerCount === 3 || playerCount < 2
            ? low
            : Math.ceil(playerCount / 2);
          continue;
        }

        const explicitCount = takeCount || giveCount;
        const count = explicitCount
          ? numOf(explicitCount)
          : frequency
            ? ({ once: 1, twice: 2, thrice: 3 }[frequency.toLowerCase()] ||
              numOf(frequency.split(' ')[0]))
            : 1;
        const subject = prefix.replace(/^.*(?:\b(?:then|and)\b|:)\s*/i, '').trim();

        if (/\bor(?:\s+else)?$/i.test(prefix)) {
          result.possible += count;
        } else if (/\b(?:do not|don't|never|does not|doesn't)\s*$/i.test(prefix)) {
          continue;
        } else if (giveCount || OTHER_PLAYER_RE.test(subject)) {
          result.assigned += count;
        } else if (!subject || DRAWER_RE.test(subject) || /=\s*$/.test(prefix)) {
          result.take += count;
        } else if (takeCount || /^(?:if\b|everyone\b|anyone\b|whoever\b)|,$/i.test(subject)) {
          result.conditional.push({ count, text });
        }
      }
    }
    return result;
  }

    function tallyDrinks(roster, draws, breakdownLimit) {
      const rows = roster.map(o => ({
        uid: o.uid,
        name: o.name,
        colour: o.colour,
        cards: 0,
        total: 0,
        expectedTake: 0
      }));
      const playersById = new Map(rows.map(row => [row.uid, row]));
      const conditional = [];
      const breakdown = [];
      let cardCount = 0;
      let reds = 0, blacks = 0, unknown = 0;
      let expectedUnassigned = 0;
      let possible = 0, likelyMin = 0, likelyMax = 0, excluded = 0;

      for (const { card: c, recipient, playerCount } of draws) {
        const n = ++cardCount;
        const row = playersById.get(recipient);
        if (row) row.cards++;
        const detail = n <= breakdownLimit
          ? { n, type: c.type, rule: c.rule, category: c.category, player: row?.name }
          : null;
        if (detail) breakdown.push(detail);

        if (c.type === 'red') reds++;
        if (c.type === 'black') {
          blacks++;
          if (!BLACK_CARDS_COUNT) {
            if (detail) detail.excluded = 'Inverted card · excluded from the tally';
            continue;
          }
        }

        const mult = c.type === 'red' ? 3 : 1;
        const drinks = parseDrinks(c.rule, playerCount);
        if (drinks.excluded) excluded++;
        if (detail) {
          if (drinks.excluded) detail.excluded = 'Open-ended assignment · excluded from the tally';
          detail.known = row ? drinks.take * mult : 0;
          detail.unassigned = (drinks.assigned + (row ? 0 : drinks.take)) * mult;
          detail.expected = (drinks.expectedTake + drinks.expectedUnassigned) * mult;
          detail.expectedUnassigned = (drinks.expectedUnassigned + (row ? 0 : drinks.expectedTake)) * mult;
          detail.possible = drinks.possible * mult;
          detail.likelyMin = drinks.likelyMin * mult;
          detail.likelyMax = drinks.likelyMax * mult;
          detail.conditional = drinks.conditional.map(item => item.count * mult);
        }
        possible += drinks.possible * mult;
        likelyMin += drinks.likelyMin * mult;
        likelyMax += drinks.likelyMax * mult;
        if (row) row.total += drinks.take * mult;
        else unknown += drinks.take * mult;
        unknown += drinks.assigned * mult;

        const expectedTake = drinks.expectedTake * mult;
        expectedUnassigned += drinks.expectedUnassigned * mult;
        if (row) row.expectedTake += expectedTake;
        else expectedUnassigned += expectedTake;

        for (const instruction of drinks.conditional) {
          conditional.push({ ...instruction, count: instruction.count * mult, card: n });
        }
      }

      return {
        rows, reds, blacks, unknown, possible, likelyMin, likelyMax, conditional, excluded, breakdown,
        expectedUnassigned,
        expectedTotal: expectedUnassigned + rows.reduce((sum, row) => sum + row.expectedTake, 0),
        cards: cardCount,
        total: unknown + rows.reduce((sum, row) => sum + row.total, 0)
      };
    }

    function resultPlayerName(player) {
      return esc(player.name || '?');
    }

    function cardBreakdownHTML(entries, count, open) {
      if (!entries.length) return '';
      const cards = entries.map(card => {
        const badges = card.excluded ? [card.excluded] : [
          card.known && card.known + ' known',
          card.unassigned && card.unassigned + ' unassigned',
          card.expected && card.expected + ' expected' +
            (card.expectedUnassigned ? ' (' + card.expectedUnassigned + ' unassigned)' : ''),
          card.possible && 'Up to ' + card.possible + ' possible',
          card.likelyMax && (card.likelyMin === card.likelyMax
            ? card.likelyMin : card.likelyMin + '–' + card.likelyMax) + ' likely',
          ...card.conditional.map(value => value + ' per qualifying player')
        ].filter(Boolean);
        if (!badges.length) badges.push('No drinks counted');

        const typeLabel = { white: 'White', red: 'Red ×3', black: 'Black' }[card.type];
        return `
          <li class="udc-breakdown-card udc-breakdown-${card.type}">
            <header>
              <span>Card ${card.n} · ${esc(typeLabel)}</span>
              <span>${esc(card.category || '')}</span>
            </header>
            <p class="udc-breakdown-rule">${esc(card.rule)}</p>
            <p class="udc-breakdown-owner">${card.player ? esc(card.player) + '’s turn' : 'Turn owner unknown'}</p>
            <ul class="udc-breakdown-badges">
              ${badges.map(badge => '<li>' + esc(badge) + '</li>').join('')}
            </ul>
          </li>`;
      }).join('');

      return `
        <details id="oCardBreakdown" class="udc-results-details"${open ? ' open' : ''}>
          <summary>Card-by-card breakdown (${count})</summary>
          <ol class="udc-breakdown-list">${cards}</ol>
          ${entries.length < count
            ? '<button type="button" class="secondary-btn udc-results-secondary" id="oMoreBreakdown">Show more cards</button>'
            : ''}
        </details>`;
    }

    function resultsHTML(t, { done, uid, actions, breakdownOpen, titleId = "udcResultsTitle" }) {
      const sorted = t.rows.slice().sort((a, b) =>
        b.total - a.total || String(a.name).localeCompare(String(b.name))
      );
      const max = sorted.length ? sorted[0].total : 0;
      const showExpected = sorted.some(row => row.expectedTake > 0);

      const metric = (label, value, note = '') => `
        <div class="udc-results-metric">
          <dt>${label}</dt>
          <dd>${value}</dd>
          ${note ? `<dd class="udc-results-note">${note}</dd>` : ''}
        </div>`;

      const likelyRange = t.likelyMin === t.likelyMax
        ? t.likelyMin
        : `${t.likelyMin}–${t.likelyMax}`;

      const metrics = [
        metric('Drinks with a known count', t.total),
        metric('Unknown recipients', t.unknown, 'Included in the known total'),
        t.expectedTotal && metric(
          'Expected from “drink if”',
          t.expectedTotal,
          `${t.expectedUnassigned} unassigned · assumes a 50% chance per player`
        ),
        t.possible && metric('Possible drinks', `Up to ${t.possible}`),
        t.likelyMax && metric('Likely drinks', likelyRange, 'Estimated from player count')
      ].filter(Boolean).join('');

      const playerRows = sorted.map(row => {
        const colour = /^#[0-9a-f]{6}$/i.test(row.colour || '') ? row.colour : '';
        const dotStyle = colour ? ` style="--player-colour: ${colour}"` : '';

        return `
          <tr>
            <th scope="row">
              <div class="udc-results-player">
                <span class="udc-results-dot" aria-hidden="true"${dotStyle}></span>
                <span class="udc-results-player-name">
                  ${resultPlayerName(row)}${row.uid === uid ? ' (you)' : ''}
                </span>
              </div>
              <div class="udc-results-note">
                ${row.cards} recorded turn${row.cards === 1 ? '' : 's'}
              </div>
            </th>
            <td>${row.total}</td>
            ${showExpected ? `<td>${row.expectedTake || 0}</td>` : ''}
          </tr>`;
      }).join('');

      const board = sorted.length ? `
        <table class="udc-results-board">
          <caption>Player scores</caption>
          <thead>
            <tr>
              <th scope="col">Player</th>
              <th scope="col">Known</th>
              ${showExpected ? '<th scope="col">Expected</th>' : ''}
            </tr>
          </thead>
          <tbody>${playerRows}</tbody>
        </table>` : '';

      let ranking = '';
      if (max > 0) {
        const top = sorted
          .filter(row => row.total === max)
          .map(resultPlayerName)
          .join(' &amp; ');
        ranking = `<p class="udc-results-note"><b>Most attributed drinks</b> · ${top} (${max})</p>`;
      } else if (
        t.cards && !t.total && !t.expectedTotal && !t.possible &&
        !t.likelyMax && !t.conditional.length && !t.excluded
      ) {
        ranking = '<p class="udc-results-note">No drink cards have turned up yet.</p>';
      }

      const conditional = t.conditional.length ? `
        <details class="udc-results-details">
          <summary>Conditional instructions (${t.conditional.length})</summary>
          <p class="udc-results-note">The number of qualifying players is unknown.</p>
          <ul>
            ${t.conditional.map(row => `
              <li>
                <b>Card ${row.card} · ${row.count} per qualifying player</b><br>
                ${esc(row.text)}
              </li>`).join('')}
          </ul>
        </details>` : '';

      const notes = [];
      if (t.excluded) {
        notes.push(`${t.excluded} open-ended assignment card${t.excluded === 1 ? '' : 's'} excluded`);
      }
      if (t.reds) {
        notes.push(`${t.reds} red card${t.reds === 1 ? '' : 's'} counted ×3`);
      }
      if (t.blacks && !BLACK_CARDS_COUNT) {
        notes.push(`${t.blacks} inverted (black) card${t.blacks === 1 ? '' : 's'} not counted`);
      }

      return `
        <section class="udc-results" aria-labelledby="${esc(titleId)}">
          <header class="udc-results-header">
            <h2 id="${esc(titleId)}">${done ? '🏁 Game over' : '🍻 Drinks so far'}</h2>
            <p class="udc-results-meta">${t.cards} card${t.cards === 1 ? '' : 's'} drawn</p>
          </header>

          <dl class="udc-results-metrics">${metrics}</dl>
          ${board}
          ${ranking}
          ${conditional}
          ${cardBreakdownHTML(t.breakdown, t.cards, breakdownOpen)}
          ${notes.length ? `<p class="udc-results-note">${esc(notes.join(' · '))}</p>` : ''}

          <div class="setup-btn-row udc-results-actions">
            ${actions}
          </div>
        </section>`;
    }

  return { tally: tallyDrinks, render: resultsHTML, pageSize: 24 };
})();
