let startTime, interval;
let inProgress = false;
let leaderboard = [];

const startButton = document.getElementById('start-game');
const usernameInput = document.getElementById('username');
const statusText = document.getElementById('pitstop-status');
const timerText = document.getElementById('pitstop-timer');
const pitstopControls = document.getElementById('pitstop-controls');
const leaderboardBody = document.getElementById('leaderboard-body');
const rankingSection = document.getElementById('ranking');

startButton.addEventListener('click', function () {
    const username = usernameInput.value.trim();
    if (username === "") {
        alert("Please enter your name to start the game!");
        return;
    }

    // Ocultar input de nombre y mostrar los controles del pitstop
    document.getElementById('user-input').style.display = 'none';
    pitstopControls.style.display = 'block';
    
    startPitstop(username);
});

function startPitstop(username) {
    if (inProgress) return; // Evita reiniciar si ya está en progreso

    inProgress = true;
    let randomTime = (Math.random() * (5 - 2) + 2).toFixed(2); // Tiempo aleatorio entre 2 y 5 segundos

    // Iniciar cronómetro y cambiar el estado
    statusText.innerText = "Changing tires...";
    statusText.classList.add('ready');
    timerText.innerText = "Time: 0.00s";

    let elapsed = 0;
    interval = setInterval(() => {
        elapsed += 0.01;
        timerText.innerText = `Time: ${elapsed.toFixed(2)}s`;
    }, 10);

    // Simular pitstop en el tiempo aleatorio
    setTimeout(() => {
        clearInterval(interval);
        inProgress = false;

        // Mostrar el tiempo aleatorio en pantalla
        statusText.innerText = "Pitstop complete!";
        timerText.innerText = `Time: ${randomTime}s`;

        // Agregar el tiempo al ranking
        updateLeaderboard(username, randomTime);
    }, randomTime * 1000); // Convertir segundos a milisegundos
}

function updateLeaderboard(username, time) {
    leaderboard.push({ username: username, time: parseFloat(time) });
    leaderboard.sort((a, b) => a.time - b.time); // Ordenar el ranking por tiempo más bajo

    // Mostrar el ranking
    rankingSection.style.display = 'block';
    leaderboardBody.innerHTML = ""; // Limpiar la tabla
    leaderboard.forEach((entry, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${entry.username}</td>
            <td>${entry.time.toFixed(2)}s</td>
        `;
        leaderboardBody.appendChild(row);
    });

    // Reiniciar el juego para el siguiente jugador
    resetGame();
}

function resetGame() {
    // Mostrar de nuevo el input para el siguiente jugador
    document.getElementById('user-input').style.display = 'block';
    pitstopControls.style.display = 'none';
    usernameInput.value = "";
    statusText.innerText = "Ready to take the challenge? Click start!";
    timerText.innerText = "Time: 0.00s";
}
