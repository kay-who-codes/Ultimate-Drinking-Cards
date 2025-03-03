const coverCard = document.getElementById("coverCard");
const cardFront = coverCard.querySelector(".card-front");
const cardBack = coverCard.querySelector(".card-back");

let cards = [];
let showingFront = true; // Track whether the front or back is being displayed

// Load cards from JSON
fetch("cards.json")
  .then((response) => response.json())
  .then((data) => {
    cards = [...data];
    preloadNextCard(); // Preload the first card on load
  })
  .catch((error) => console.error("Error loading cards:", error));

// Generate content for a card
function generateCardContent(card) {
  const inverted = Math.random() < 0.15; // 15% chance to invert colours
  
  return {
    content: `
      <div class="instructionText" style="color: ${inverted ? "#ffffff" : "#000000"};">
        ${card.Rule}
      </div>
      <div class="categoryText" style="color: ${card.Colour};">
        ${card.Category}
      </div>
    `,
    backgroundColor: inverted ? "#000000" : "#ffffff",
    textColor: inverted ? "#ffffff" : "#000000",
  };
}

// Preload the content for the next card
function preloadNextCard() {
  if (cards.length === 0) {
    cardBack.innerHTML = `
      <div class="instructionText" style="color: #000;">
        No more cards!
      </div>
    `;
    cardBack.style.backgroundColor = "#ffffff";
    cardBack.style.color = "#000000";
    return;
  }

  const randomIndex = Math.floor(Math.random() * cards.length);
  const newCard = cards.splice(randomIndex, 1)[0];
  const { content, backgroundColor, textColor } = generateCardContent(newCard);

  // Store the content for later
  cardBack.dataset.content = content;
  cardBack.dataset.backgroundColor = backgroundColor;
  cardBack.dataset.textColor = textColor;
  cardBack.dataset.categoryColour = newCard.Colour;  // Store the Category Colour
}

// Apply preloaded content to the visible card
function applyPreloadedContent(isFront = true) {
  if (isFront) {
    cardFront.innerHTML = cardBack.dataset.content || "";
    cardFront.style.backgroundColor = cardBack.dataset.backgroundColor || "#ffffff";
    cardFront.style.color = cardBack.dataset.textColor || "#000000";
  } else {
    cardBack.innerHTML = cardBack.dataset.content || "";
    cardBack.style.backgroundColor = cardBack.dataset.backgroundColor || "#ffffff";
    cardBack.style.color = cardBack.dataset.textColor || "#000000";
  }

  // Apply Category Text Colour after half of the flip animation
  const categoryTextElements = document.querySelectorAll('.categoryText');
  categoryTextElements.forEach(element => {
    // Delay the colour change until halfway through the animation
    setTimeout(() => {
      element.style.color = cardBack.dataset.categoryColour || "#000000";  // Apply the Category Colour dynamically
    }, 250);  // Change the colour after 250ms (halfway through the 0.5s animation)
  });
}

// Flip card function
function flipCard() {
  const audio = new Audio("flip.mp3");
  audio.play();

  // Preload the next card before flipping
  preloadNextCard();

  // Apply content to the visible card
  if (showingFront) {
    applyPreloadedContent(false); // Apply to back
  } else {
    applyPreloadedContent(true); // Apply to front
  }

  // Toggle flip animation
  coverCard.classList.toggle("flipped");
  showingFront = !showingFront; // Switch between front and back
}

// Event listener for card flip animation end
coverCard.addEventListener("transitionend", () => {
  if (!showingFront) {
    // After the flip, update the content
    applyPreloadedContent(false);
  }
});

// Add click event to initiate flip
coverCard.addEventListener("click", flipCard);

// Modal functionality

const showRulesLink = document.getElementById("showRulesLink");
const rulesModal = document.getElementById("rulesModal");
const closeRulesButton = document.getElementById("closeRulesButton");
const rulesText = document.getElementById("rulesText");

// Rules embedded directly in the JavaScript
const embeddedRules = `
How to Play:

Take it in turns tapping the card to draw a new card.

If your drawn card is white, perform the instruction on the card.

If your drawn card is black, invert the instruction, perform the inverted instruction.

Some inverted cards make more sense than others. Don't worry if a card isn't obviously invertable, just try it, chill, and have fun.
`;

// Function to display the rules
function displayEmbeddedRules() {
  rulesText.textContent = embeddedRules; // Display the rules text in the modal
  rulesModal.style.display = "flex"; // Show the modal
}

// Event listener for the "View Game Rules" link
showRulesLink.addEventListener("click", (event) => {
  event.preventDefault(); // Prevent default link behaviour
  displayEmbeddedRules(); // Show the rules modal
});

// Event listener for closing the modal
closeRulesButton.addEventListener("click", () => {
  rulesModal.style.display = "none"; // Hide the modal
});
