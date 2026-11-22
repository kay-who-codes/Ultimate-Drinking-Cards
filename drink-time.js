/* Drink Time! uses one weighted roll per card slot. */
const DRINK_TIME_CATEGORY = "Drink Time!";
const DRINK_TIME_COLOUR = "#ff00ff";
const LEGACY_DRINK_TIME_CARDS = [
  [2, "Drink! Drink! Drink! Everybody drinks!"],
  [1, "Everyone except you drinks."],
  [2, "The player after you drinks."],
  [2, "The player before you drinks."],
  [4, "Take a drink."],
  [2, "Take two drinks."],
  [1, "Take three drinks."]
];

const DRINK_TIME_CARDS = [
  [5, "Drink! Drink! Drink! Everybody drinks!"],
  [2, "Everyone except you drinks."],
  [2, "The player after you drinks."],
  [2, "The player before you drinks."],
  [10, "Take a drink."],
  [5, "Take two drinks."],
  [2, "Take three drinks."],
  [1, "Take four drinks."]
];

function drawDrinkTimeCard(random, weights = DRINK_TIME_CARDS) {
  const roll = random() * 100;
  let threshold = 0;
  for (const [chance, rule] of weights) {
    threshold += chance;
    if (roll < threshold) {
      return { Category: DRINK_TIME_CATEGORY, Colour: DRINK_TIME_COLOUR, RawRule: rule, Rule: rule };
    }
  }
  return null;
}

function generateDrinkTimeCards(standardCount, random) {
  const extras = [];
  const totalWeight = DRINK_TIME_CARDS.reduce((sum, [chance]) => sum + chance, 0);
  if (totalWeight >= 100) throw new RangeError("Drink Time! weights must add up to less than 100.");

  // Keep rolling until all standard slots have been placed.
  for (let standard = 0; standard < standardCount;) {
    const extra = drawDrinkTimeCard(random);
    if (extra) extras.push(extra);
    else standard++;
  }
  return extras;
}
