// Shared card wording for local and online play.

  function getRandomPlayerName(excludeName) {
    const pool = (Array.isArray(players) && players.length > 0) ? players : null;
    if (!pool) return "[random player]";
    const candidates = excludeName
      ? pool.filter(p => p.name !== excludeName)
      : pool;
    const use = candidates.length ? candidates : pool;
    return use[Math.floor(Math.random() * use.length)].name;
  }

function shouldRemoveForDiscord(rule) {
  const r = String(rule);
  // Remove if it needs a physical environment, props, or spatial positioning.
  return /\b(point|pointing|walk|room|floor|eye contact|clink)\b/i.test(r);
}

function applyDiscordTransforms(rule, playerCount = players.length) {
  let text = String(rule);
  if (playerCount === 2) return text;
  text = text.replace(/the player to your left/gi, "the previous player");
  text = text.replace(/the player to your right/gi, "the next player");
  text = text.replace(/the player opposite/gi, () => getRandomPlayerName());
  return text;
}

  function rewordTwoPlayerCard(rule, otherName) {
    const name = String(otherName ?? "").trim();
    const namedOther = name && !/^player(?:\s+\d+)?$/i.test(name) ? escapeHTML(name) : "";
    const other = match => namedOther || (/^[A-Z]/.test(match) ? "The other player" : "the other player");
    const inflections = {
      votes: "vote", guesses: "guess", takes: "take", plays: "play",
      strikes: "strike", drinks: "drink", holds: "hold", says: "say",
      points: "point", closes: "close", does: "do", has: "have", is: "are"
    };

    let text = rule.replace(/\bEveryone drinks for every sibling they have\b/gi,
      "Both of you drink for every sibling you have");
    text = text.replace(
      /\b(everyone|all players)(?!\s+(?:else|except|but)\b)(?:\s+(democratically|collectively))?(?:\s+(votes|guesses|takes|plays|strikes|drinks|holds|says|points|closes|does|has|is))?\b/gi,
      (match, group, adverb, verb, offset, source) => {
        const rest = source.slice(offset + match.length);
        const before = source.slice(0, offset);
        const capital = /^[A-Z]/.test(group);
        if (/\b(?:show|tell|ask)\s*$/i.test(before)) return match;
        if (!verb && /^\s+(?:who|whose|with|without|wearing|born|in|not|older|younger|shorter|taller|left-handed|right-handed)\b/i.test(rest)) {
          return capital ? "Anyone" : "anyone";
        }
        return (capital ? "Both of you" : "both of you") +
          (adverb ? " " + adverb : "") + (verb ? " " + inflections[verb.toLowerCase()] : "");
      }
    );

    return text.replace(
      /\[player[_ ]name\]|\b(?:everyone (?:else|except you|but you)|all other players|the player (?:after you|farthest from you|before you|to your (?:left|right)|opposite(?: you)?)|the (?:next|previous) player|another player|(?:show|tell|ask)\s+everyone)\b/gi,
      (match, offset, source) => {
        if (/^the next player$/i.test(match) &&
            /\b(?:they|that player)\s+(?:pick|choose|select)s?\s*$/i.test(source.slice(0, offset))) {
          return match;
        }
        const verb = match.match(/^(show|tell|ask)\s+/i);
        return verb ? verb[0] + other("everyone") : other(match);
      }
    );
  }



  function minimumCardPlayers(rule) {
    const text = String(rule);
    return /\b(?:pick two people to perform a dance move|switch places with someone across from you|the player to your left drinks, thumbs down means the player to your right drinks)\b/i.test(text)
      ? 3
      : 1;
  }
