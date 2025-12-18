// Set the date and time for the countdown (20th July 2024, 15:00 UTC)
const countdownDate = new Date('2024-10-19T16:00:00Z').getTime();

// Update the countdown every second
const countdownElement = document.getElementById('countdown');
const timerInterval = setInterval(updateCountdown, 1000);

function updateCountdown() {
    // Get today's date and time
    const now = new Date().getTime();

    // Find the distance between now and the countdown date
    const distance = countdownDate - now;

    // Calculate days, hours, minutes, and seconds
    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    // Display the countdown
    countdownElement.innerHTML = `${days}d ${hours}h ${minutes}m ${seconds}s`;

    // If the countdown is over, stop the timer
    if (distance < 0) {
        clearInterval(timerInterval);
        countdownElement.innerHTML = "The event has started!";
    }
}