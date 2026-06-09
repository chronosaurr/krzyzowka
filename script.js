const API_BASE_URL = 'http://127.0.0.1:8000/api';

const boardElement = document.getElementById('board');
const cluesAcrossElement = document.getElementById('clues-across');
const cluesDownElement = document.getElementById('clues-down');
const verifyBtn = document.getElementById('verify-btn');
const btnNormal = document.getElementById('btn-normal');
const btnHard = document.getElementById('btn-hard');
const successModal = document.getElementById('success-modal');
const closeModalBtn = document.getElementById('close-modal-btn');

let layoutData = [];
let currentDirection = 'r';
const cellMap = new Map(); 

function renderCrossword() {
    let maxRow = 0;
    let maxCol = 0;
    let wordCounter = 1;
    const startPositions = {};

    // 1. Obliczamy wymiary planszy i przypisujemy numery słowom
    layoutData.forEach(word => {
        const key = `${word.row}-${word.col}`;
        if (!startPositions[key]) {
            startPositions[key] = wordCounter++;
        }
        word.displayNumber = startPositions[key];

        const endRow = word.row + (word.direction === 'd' ? word.length - 1 : 0);
        const endCol = word.col + (word.direction === 'r' ? word.length - 1 : 0);
        
        if (endRow > maxRow) maxRow = endRow;
        if (endCol > maxCol) maxCol = endCol;
    });

    // 2. Konfiguracja CSS Grid
    boardElement.style.gridTemplateRows = `repeat(${maxRow + 1}, var(--cell-size))`;
    boardElement.style.gridTemplateColumns = `repeat(${maxCol + 1}, var(--cell-size))`;

    // 3. Renderowanie kratek (cells) i podpowiedzi (clues)
    layoutData.forEach(word => {
        const clueLi = document.createElement('li');
        clueLi.innerHTML = `<strong>${word.displayNumber}.</strong> ${word.clue}`;
        
        // podswietlanie słowa na planszy po najechaniu na pytanie
        clueLi.addEventListener('mouseenter', () => {
            for (let i = 0; i < word.length; i++) {
                const r = word.row + (word.direction === 'd' ? i : 0);
                const c = word.col + (word.direction === 'r' ? i : 0);
                const cell = cellMap.get(`${r}-${c}`);
                if (cell) cell.cell.classList.add('highlighted-word');
            }
        });

        // Usuwanie podświetlenia gdy kursor zjeżdża z pytania
        clueLi.addEventListener('mouseleave', () => {
            for (let i = 0; i < word.length; i++) {
                const r = word.row + (word.direction === 'd' ? i : 0);
                const c = word.col + (word.direction === 'r' ? i : 0);
                const cell = cellMap.get(`${r}-${c}`);
                if (cell) cell.cell.classList.remove('highlighted-word');
            }
        });

        // Kliknięcie w pytanie ustawia odpowiedni kierunek i przeniesienie kursora na pierwszą kratkę
        clueLi.addEventListener('click', () => {
            currentDirection = word.direction; 
            const firstCell = cellMap.get(`${word.row}-${word.col}`);
            if (firstCell) firstCell.input.focus();
        });

        if (word.direction === 'r') {
            cluesAcrossElement.appendChild(clueLi);
        } else {
            cluesDownElement.appendChild(clueLi);
        }

        // Rysowanie kratek
        for (let i = 0; i < word.length; i++) {
            const r = word.row + (word.direction === 'd' ? i : 0);
            const c = word.col + (word.direction === 'r' ? i : 0);
            const key = `${r}-${c}`;

            if (!cellMap.has(key)) {
                const cellDiv = document.createElement('div');
                cellDiv.className = 'cell';
                cellDiv.style.gridRow = r + 1;
                cellDiv.style.gridColumn = c + 1;

                const input = document.createElement('input');
                input.maxLength = 1;
                input.dataset.row = r;
                input.dataset.col = c;
                
                // automatyczne przechodzenie do następnej kratki po wpisaniu litery
                input.addEventListener('input', function() {
                    this.value = this.value.toUpperCase();

                    if (this.value !== '') {
                        let nextR = r + (currentDirection === 'd' ? 1 : 0);
                        let nextC = c + (currentDirection === 'r' ? 1 : 0);
                        let nextCell = cellMap.get(`${nextR}-${nextC}`);

                        if (!nextCell) {
                            const fallbackDir = currentDirection === 'r' ? 'd' : 'r';
                            const fbR = r + (fallbackDir === 'd' ? 1 : 0);
                            const fbC = c + (fallbackDir === 'r' ? 1 : 0);
                            const fbCell = cellMap.get(`${fbR}-${fbC}`);
                            
                            if (fbCell) {
                                currentDirection = fallbackDir;
                                nextCell = fbCell;
                            }
                        }

                        if (nextCell) nextCell.input.focus();
                    }
                });

                // cofanie się do poprzedniej kratki po naciśnięciu backspace if obecna kratka jest pusta
                input.addEventListener('keydown', function(e) {
                    if (e.key === 'Backspace' && this.value === '') {
                        let prevR = r - (currentDirection === 'd' ? 1 : 0);
                        let prevC = c - (currentDirection === 'r' ? 1 : 0);
                        let prevCell = cellMap.get(`${prevR}-${prevC}`);
                        if (prevCell) {
                            e.preventDefault();
                            prevCell.input.focus();
                            prevCell.input.value = '';
                        }
                    }
                });

                cellDiv.appendChild(input);
                boardElement.appendChild(cellDiv);
                cellMap.set(key, { cell: cellDiv, input: input });
            }

            // Dodawanie numerka dla początkowych kratek
            if (r === word.row && c === word.col) {
                const existingCell = cellMap.get(key).cell;
                if (!existingCell.querySelector('.cell-number')) {
                    const numDiv = document.createElement('div');
                    numDiv.className = 'cell-number';
                    numDiv.textContent = word.displayNumber;
                    existingCell.appendChild(numDiv);
                }
            }
        }
    });

    setupKeyboardNavigation();
}

// 4. Obsługa strzałek na klawiaturze 
function setupKeyboardNavigation() {
    boardElement.addEventListener('keydown', (e) => {
        if (e.target.tagName !== 'INPUT') return;

        const r = parseInt(e.target.dataset.row);
        const c = parseInt(e.target.dataset.col);
        let nextR = r;
        let nextC = c;

        // Aktualizujemy preferowany kierunek na podstawie użytych strzałek
        if (e.key === 'ArrowRight') { nextC++; currentDirection = 'r'; }
        else if (e.key === 'ArrowLeft') { nextC--; currentDirection = 'r'; }
        else if (e.key === 'ArrowDown') { nextR++; currentDirection = 'd'; }
        else if (e.key === 'ArrowUp') { nextR--; currentDirection = 'd'; }
        else return;

        const nextCell = cellMap.get(`${nextR}-${nextC}`);
        if (nextCell) {
            e.preventDefault(); 
            nextCell.input.focus();
        }
    });
}

// 5. Zbieranie haseł i wysyłanie ich do weryfikacji na backendzie
verifyBtn.addEventListener('click', async () => {
    const answersPayload = [];

    layoutData.forEach(word => {
        let userAnswer = "";
        for (let i = 0; i < word.length; i++) {
            const r = word.row + (word.direction === 'd' ? i : 0);
            const c = word.col + (word.direction === 'r' ? i : 0);
            const cell = cellMap.get(`${r}-${c}`);
            userAnswer += cell.input.value || " ";
        }
        answersPayload.push({
            word_id: word.word_id,
            user_answer: userAnswer.trim()
        });
    });

    try {
        const response = await fetch(`${API_BASE_URL}/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ answers: answersPayload })
        });

        if (!response.ok) throw new Error('Błąd weryfikacji');
        
        const data = await response.json();
        
        cellMap.forEach(item => {
            item.cell.classList.remove('correct', 'incorrect');
        });

        data.results.forEach(result => {
            const wordConfig = layoutData.find(w => w.word_id === result.word_id);
            if (!wordConfig) return;

            const statusClass = result.is_correct ? 'correct' : 'incorrect';

            for (let i = 0; i < wordConfig.length; i++) {
                const r = wordConfig.row + (wordConfig.direction === 'd' ? i : 0);
                const c = wordConfig.col + (wordConfig.direction === 'r' ? i : 0);
                const cell = cellMap.get(`${r}-${c}`);
                cell.cell.classList.add(statusClass);
            }
        });

        const isAllCorrect = data.results.every(result => result.is_correct);
        
        if (isAllCorrect && data.results.length > 0) {
            successModal.style.display = 'flex'; 
        } else {
            successModal.style.display = 'none';
        }

    } catch (error) {
        console.error(error);
        alert("Wystąpił problem z połączeniem. Spróbuj ponownie.");
    }
});

// Obsługa zamknięcia okienka krzyżykiem
closeModalBtn.addEventListener('click', () => {
    successModal.style.display = 'none';
});

// ciemne tlo 
successModal.addEventListener('click', (e) => {
    if (e.target === successModal) {
        successModal.style.display = 'none';
    }
});

async function loadCrossword(endpoint) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`);
        if (!response.ok) throw new Error('Błąd podczas pobierania krzyżówki');
        
        const data = await response.json();
        layoutData = data.layout;
        
        // 1. Czyszczenie starej planszy i list
        boardElement.innerHTML = '';
        cluesAcrossElement.innerHTML = '';
        cluesDownElement.innerHTML = '';
        cellMap.clear();
        successModal.style.display = 'none';

        // 2. Rysowanie nowej
        renderCrossword();
    } catch (error) {
        console.error(error);
        boardElement.innerHTML = `<p style="color: red;">Nie udało się załadować krzyżówki.</p>`;
    }
}

// Inicjalizacja przy starcie strony
function init() {
    loadCrossword('/crossword');
}

btnNormal.addEventListener('click', () => {
    loadCrossword('/crossword/new/normal');
});

btnHard.addEventListener('click', () => {
    loadCrossword('/crossword/new/hard');
});

init();

