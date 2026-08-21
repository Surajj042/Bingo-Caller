"use strict";

const TOTAL_NUMBERS = 90;

const currentNumberEl = document.getElementById("current-number");
const boardEl = document.getElementById("board");
const historyEl = document.getElementById("history");
const remainingEl = document.getElementById("remaining");
const statusEl = document.getElementById("status");
const nextBtn = document.getElementById("next-btn");
const resetBtn = document.getElementById("reset-btn");
const boardToggleBtn = document.getElementById("board-toggle");

let shuffled = [];
let drawnCount = 0;

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function isGameOver() {
  return drawnCount >= TOTAL_NUMBERS;
}

function buildBoard() {
  const fragment = document.createDocumentFragment();
  for (let n = 1; n <= TOTAL_NUMBERS; n++) {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.dataset.number = n;
    cell.textContent = n;
    fragment.appendChild(cell);
  }
  boardEl.replaceChildren(fragment);
}

function clearCurrentHighlight() {
  const prev = boardEl.querySelector(".cell.current");
  if (prev) prev.classList.remove("current");
}

function updateRemaining() {
  remainingEl.textContent = TOTAL_NUMBERS - drawnCount;
}

function drawNext() {
  if (isGameOver()) return;

  const number = shuffled[drawnCount];
  drawnCount++;

  clearCurrentHighlight();
  const cell = boardEl.querySelector(`[data-number="${number}"]`);
  cell.classList.add("drawn", "current");

  currentNumberEl.classList.remove("pop");
  void currentNumberEl.offsetWidth; // restart the pop animation
  currentNumberEl.textContent = number;
  currentNumberEl.classList.add("pop");

  const chip = document.createElement("span");
  chip.className = "chip";
  chip.textContent = number;
  historyEl.prepend(chip);

  updateRemaining();

  if (isGameOver()) {
    nextBtn.disabled = true;
    statusEl.textContent = "All Numbers Drawn!";
  }
}

function resetGame() {
  shuffled = shuffle(Array.from({ length: TOTAL_NUMBERS }, (_, i) => i + 1));
  drawnCount = 0;

  clearCurrentHighlight();
  boardEl.querySelectorAll(".cell.drawn").forEach((cell) => {
    cell.classList.remove("drawn");
  });

  currentNumberEl.classList.remove("pop");
  currentNumberEl.textContent = "\u2014";

  historyEl.replaceChildren();
  statusEl.textContent = "";
  updateRemaining();

  nextBtn.disabled = false;
}

document.addEventListener("keydown", (event) => {
  if (event.repeat) return;

  const focusedOnButton = document.activeElement?.tagName === "BUTTON";

  if (
    event.code === "Space" &&
    !event.ctrlKey && !event.metaKey && !event.altKey
  ) {
    // Let the browser activate a focused button normally.
    if (focusedOnButton || isGameOver()) return;
    event.preventDefault(); // stop the page from scrolling
    drawNext();
  } else if (
    (event.key === "r" || event.key === "R") &&
    !event.ctrlKey && !event.metaKey && !event.altKey
  ) {
    resetGame();
  }
});

function toggleBoard() {
  const hidden = boardEl.classList.toggle("hidden");
  boardToggleBtn.textContent = hidden ? "Show" : "Hide";
  boardToggleBtn.setAttribute("aria-expanded", String(!hidden));
}

nextBtn.addEventListener("click", drawNext);
resetBtn.addEventListener("click", resetGame);
boardToggleBtn.addEventListener("click", toggleBoard);

buildBoard();
resetGame();
