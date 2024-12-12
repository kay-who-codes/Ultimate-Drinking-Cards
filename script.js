document.addEventListener("DOMContentLoaded", () => {
    const coverCard = document.getElementById("cover-card");
    const gameCard = document.getElementById("game-card");
    const flipSound = document.getElementById("flip-sound");
    const refreshButton = document.getElementById("refresh-btn");
    const cardElement = document.getElementById("card");
    const instructionText = document.getElementById("instruction-text");
    const categoryText = document.getElementById("category-text");

    let allCards = [];
    let availableCards = [];

    // Try to load card data
    fetch('cards.json')
        .then(response => response.json())
        .then(data => {
            allCards = data; // Directly assign the array of cards
            availableCards = [...allCards]; // Make a copy of all cards for availability
            displayCoverCard();
        })
        .catch(error => {
            console.error('Error loading cards:', error);
            alert("There was an error loading the cards. Please check the file path.");
        });

    // Display the cover card
    function displayCoverCard() {
        cardElement.classList.remove('flipped');
        instructionText.textContent = '';
        categoryText.textContent = '';
        refreshButton.classList.add('hidden');
    }

    // Shuffle the cards and display a new one
    function shuffleAndDisplayCard() {
        if (availableCards.length === 0) {
            availableCards = [...allCards]; // Reshuffle when all cards are used
            refreshButton.classList.remove('hidden');
        }

        const randomIndex = Math.floor(Math.random() * availableCards.length);
        const selectedCard = availableCards.splice(randomIndex, 1)[0]; // Remove card from available list

        instructionText.textContent = selectedCard.Rule;
        categoryText.textContent = selectedCard.Category;
        gameCard.style.backgroundColor = selectedCard.Colour;

        // Play sound and flip card
        flipSound.play();
        cardElement.classList.add('flipped');
    }

    // Event listener for card click to flip and show new card
    coverCard.addEventListener("click", shuffleAndDisplayCard);

    // Event listener for refresh button to reshuffle cards
    refreshButton.addEventListener("click", () => {
        availableCards = [...allCards]; // Reshuffle cards
        shuffleAndDisplayCard();
        refreshButton.classList.add('hidden');
    });
});
