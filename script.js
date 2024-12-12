document.addEventListener("DOMContentLoaded", function () {
    const coverCard = document.getElementById('coverCard');
    const resetButton = document.getElementById('resetButton');
    const flipSound = document.getElementById('flipSound');
    const cardContainer = document.querySelector('.card-container');

    let cardData = [];
    let currentCardIndex = 0;

    // Fetch cards data from cards.json
    fetch('cards.json')
        .then(response => response.json())
        .then(data => {
            cardData = data;
            showCard();
        })
        .catch(error => console.error('Error loading cards.json:', error));

    // Function to generate and display the next card
    function showCard() {
        if (cardData.length === 0) {
            resetButton.classList.remove('hidden');
            return;
        }

        // Get the current card data
        const currentCard = cardData[currentCardIndex];

        // Create the game card HTML
        const gameCard = document.createElement('div');
        gameCard.classList.add('card', 'game-card');
        gameCard.innerHTML = `
            <div class="instructionText">${currentCard.Rule}</div>
            <div class="categoryText" style="color: ${currentCard.Colour};">${currentCard.Category}</div>
        `;

        // Position the new card below the current one
        gameCard.style.transform = 'translateY(100%)';

        // Add click event to trigger flying off
        gameCard.addEventListener('click', () => slideAndReveal(gameCard));

        // Append the game card to the container
        cardContainer.appendChild(gameCard);

        // Play flip sound immediately
        flipSound.play();

        // Increment the card index for the next flip
        currentCardIndex++;

        // Hide the cover card after the first game card is shown
        if (currentCardIndex === 1) {
            coverCard.classList.add('hidden');
        }
    }

    // Function to randomly slide the current card off the screen and reveal the next card
    function slideAndReveal(currentCard) {
        // Random directions array
        const directions = [
            'left', 'right', 'top', 'bottom', 
            'top-left', 'top-right', 'bottom-left', 'bottom-right'
        ];

        const randomDirection = directions[Math.floor(Math.random() * directions.length)];

        // Play the flip sound
        flipSound.play();

        // Slide the current card off-screen in the chosen direction
        switch (randomDirection) {
            case 'left':
                currentCard.style.transform = 'translateX(-1000px)';
                break;
            case 'right':
                currentCard.style.transform = 'translateX(1000px)';
                break;
            case 'top':
                currentCard.style.transform = 'translateY(-1000px)';
                break;
            case 'bottom':
                currentCard.style.transform = 'translateY(1000px)';
                break;
            case 'top-left':
                currentCard.style.transform = 'translate(-1000px, -1000px)';
                break;
            case 'top-right':
                currentCard.style.transform = 'translate(1000px, -1000px)';
                break;
            case 'bottom-left':
                currentCard.style.transform = 'translate(-1000px, 1000px)';
                break;
            case 'bottom-right':
                currentCard.style.transform = 'translate(1000px, 1000px)';
                break;
            default:
                currentCard.style.transform = 'translateX(-1000px)';
                break;
        }

        // After the card has moved off-screen, replace it with the next card
        setTimeout(() => {
            cardContainer.removeChild(currentCard);
            // Show the next card
            if (currentCardIndex < cardData.length) {
                showCard();
            }
        }, 500);  // The time should match the transition duration
    }

    // Reset button functionality
    resetButton.addEventListener('click', () => {
        resetButton.classList.add('hidden');
        coverCard.classList.remove('hidden');
        cardContainer.innerHTML = '';
        cardData = []; // Reset the card data if necessary
        currentCardIndex = 0;
        fetch('cards.json')
            .then(response => response.json())
            .then(data => {
                cardData = data;
            })
            .catch(error => console.error('Error reloading cards:', error));
    });
});
