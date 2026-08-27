"use strict";

const TOTAL_NUMBERS = 90;

const currentNumberEl = document.getElementById("current-number");
const boardEl = document.getElementById("board");
const historyEls = [
  document.getElementById("history-left"),
  document.getElementById("history-right"),
];
const remainingEl = document.getElementById("remaining");
const statusEl = document.getElementById("status");
const nextBtn = document.getElementById("next-btn");
const resetBtn = document.getElementById("reset-btn");
const boardFab = document.getElementById("board-fab");
const boardBackdrop = document.getElementById("board-backdrop");
const boardCloseBtn = document.getElementById("board-close");
const settingsBtn = document.getElementById("settings-btn");
const settingsBackdrop = document.getElementById("settings-backdrop");
const settingsCloseBtn = document.getElementById("settings-close");
const spinToggle = document.getElementById("spin-toggle");
const spinOptions = document.getElementById("spin-options");
const durationRow = document.getElementById("duration-row");
const minDurationRange = document.getElementById("min-duration");
const maxDurationRange = document.getElementById("max-duration");
const minValueEl = document.getElementById("min-value");
const maxValueEl = document.getElementById("max-value");
const effectSelect = document.getElementById("effect-select");
const soundSelect = document.getElementById("sound-select");
const selectLayer = document.getElementById("select-layer");
const layerMenu = selectLayer.querySelector(".select-layer-menu");

const SETTINGS_KEY = "bingo-settings";
const DEFAULT_SETTINGS = {
  spinEnabled: true,
  minDuration: 5,
  maxDuration: 30,
  spinEffect: "reel",
  spinSound: "ticks",
};
const SPIN_EFFECTS = [
  "numbers",
  "tumble",
  "glow",
  "reel",
  "bounce",
  "shake",
  "blur",
  "spin",
  "random",
  "none",
];
const SPIN_SOUNDS = [
  "rumble",
  "sweep",
  "ticks",
  "quiet",
  "whoosh",
  "engine",
  "pulse",
  "surges",
  "random",
  "none",
];
const EFFECT_CHOICES = SPIN_EFFECTS.filter(
  (effect) => effect !== "random" && effect !== "none"
);
const SOUND_CHOICES = SPIN_SOUNDS.filter(
  (sound) => sound !== "random" && sound !== "none"
);

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      if (!SPIN_EFFECTS.includes(parsed.spinEffect)) {
        parsed.spinEffect = DEFAULT_SETTINGS.spinEffect;
      }
      if (!SPIN_SOUNDS.includes(parsed.spinSound)) {
        parsed.spinSound = DEFAULT_SETTINGS.spinSound;
      }
      return parsed;
    }
  } catch (err) {
    // ignore malformed or blocked storage
  }
  return { ...DEFAULT_SETTINGS };
}

const settings = loadSettings();

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    // ignore storage failures
  }
}

let shuffled = [];
let drawnCount = 0;

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

let spinActive = false;
let revealTimer = null;
let tickTimer = null;
let cycleRemaining = [];
let lastShownNumber = "\u2014";
let currentSpinSound = null;

let audioCtx = null;
let spinSoundNodes = null;

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

function ensureAudio() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) audioCtx = new Ctx();
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function randomNoiseBuffer(ctx) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function playTick() {
  const ctx = ensureAudio();
  if (!ctx) return;

  const activeSound = currentSpinSound;
  if (activeSound === "none") return;

  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  if (activeSound === "pulse") {
    osc.type = "sine";
    osc.frequency.setValueAtTime(120, t);
    gain.gain.setValueAtTime(0.16, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  } else {
    const freq = 600 + Math.random() * 900;
    const level = activeSound === "ticks" ? 0.13 : 0.06;
    osc.type = "square";
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.4, t + 0.04);
    gain.gain.setValueAtTime(level, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  }

  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.1);
}

function startSpinSound() {
  const ctx = ensureAudio();
  if (!ctx) return;

  stopSpinSound();

  const activeSound = currentSpinSound;

  if (activeSound === "none" || activeSound === "ticks" || activeSound === "pulse") {
    spinSoundNodes = null;
    return;
  }

  if (activeSound === "sweep" || activeSound === "engine") {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(activeSound === "engine" ? 90 : 180, ctx.currentTime);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = activeSound === "engine" ? 500 : 900;
    filter.Q.value = 0.5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.setTargetAtTime(activeSound === "engine" ? 0.06 : 0.035, ctx.currentTime, 0.1);

    if (activeSound === "engine") {
      const sub = ctx.createOscillator();
      sub.type = "square";
      sub.frequency.setValueAtTime(45, ctx.currentTime);
      const subGain = ctx.createGain();
      subGain.gain.value = 0.4;
      sub.connect(subGain).connect(gain);
      osc.start();
      sub.start();
      osc.connect(filter).connect(gain).connect(ctx.destination);
      spinSoundNodes = { type: "engine", src: osc, sub, gain };
      return;
    }

    osc.connect(filter).connect(gain).connect(ctx.destination);
    osc.start();
    spinSoundNodes = { type: activeSound, src: osc, osc, gain };
    return;
  }

  if (activeSound === "whoosh") {
    const src = ctx.createBufferSource();
    src.buffer = randomNoiseBuffer(ctx);
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 300;
    filter.Q.value = 1.2;

    const gain = ctx.createGain();
    gain.gain.value = 0.06;

    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start();
    spinSoundNodes = { type: "whoosh", src, filter, gain };
    return;
  }

  const src = ctx.createBufferSource();
  src.buffer = randomNoiseBuffer(ctx);
  src.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 900;
  filter.Q.value = 0.4;

  const gain = ctx.createGain();
  const level =
    activeSound === "quiet" ? 0.08 : activeSound === "surges" ? 0.16 : 0.18;
  gain.gain.value = level;

  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start();

  spinSoundNodes = { type: activeSound, src, gain, baseGain: level };
}

function updateSpinSound(progress) {
  if (!spinSoundNodes) return;
  const nodes = spinSoundNodes;
  const t = audioCtx.currentTime;

  if (nodes.type === "sweep") {
    nodes.osc.frequency.setTargetAtTime(180 + 1500 * progress, t, 0.05);
  } else if (nodes.type === "engine") {
    nodes.osc.frequency.setTargetAtTime(90 + 230 * progress, t, 0.05);
    nodes.sub.frequency.setTargetAtTime(45 + 115 * progress, t, 0.05);
  } else if (nodes.type === "whoosh") {
    nodes.filter.frequency.setTargetAtTime(300 + 2600 * progress, t, 0.05);
    nodes.gain.gain.setTargetAtTime(0.05 + 0.1 * progress, t, 0.1);
  } else if (nodes.type === "surges") {
    nodes.gain.gain.setTargetAtTime(
      nodes.baseGain * (0.6 + 0.4 * Math.sin(progress * Math.PI * 6)),
      t,
      0.08
    );
  }
}

function stopSpinSound() {
  if (!spinSoundNodes) return;
  const { src, gain, sub } = spinSoundNodes;
  gain.gain.cancelScheduledValues(audioCtx.currentTime);
  gain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.03);
  src.stop(audioCtx.currentTime + 0.2);
  if (sub) sub.stop(audioCtx.currentTime + 0.2);
  spinSoundNodes = null;
}

function playReveal() {
  const ctx = ensureAudio();
  if (!ctx) return;

  const t = ctx.currentTime;
  [523.25, 659.25, 783.99].forEach((freq, i) => {
    const start = t + i * 0.09;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.4);
  });
}

function showCyclingNumber() {
  let n;
  do {
    n = cycleRemaining[Math.floor(Math.random() * cycleRemaining.length)];
  } while (
    cycleRemaining.length > 1 &&
    n === Number(currentNumberEl.textContent)
  );
  currentNumberEl.textContent = n;
}

function revealNumber(number) {
  drawnCount++;
  lastShownNumber = number;

  clearCurrentHighlight();
  const cell = boardEl.querySelector(`[data-number="${number}"]`);
  cell.classList.add("drawn", "current");

  currentNumberEl.classList.remove("pop");
  void currentNumberEl.offsetWidth; // restart the pop animation
  currentNumberEl.textContent = number;
  currentNumberEl.classList.add("pop");

  for (const el of historyEls) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = number;
    el.prepend(chip);
  }

  updateRemaining();

  if (isGameOver()) {
    nextBtn.disabled = true;
    currentNumberEl.classList.add("finished");
    statusEl.textContent = "All Numbers Drawn!";
  }
}

function getActiveEffect() {
  if (settings.spinEffect === "random") {
    return EFFECT_CHOICES[Math.floor(Math.random() * EFFECT_CHOICES.length)];
  }
  return settings.spinEffect;
}

function getActiveSound() {
  if (settings.spinSound === "random") {
    return SOUND_CHOICES[Math.floor(Math.random() * SOUND_CHOICES.length)];
  }
  return settings.spinSound;
}

function applySpinEffect() {
  const active = getActiveEffect();
  clearSpinEffects();
  if (active !== "none") {
    currentNumberEl.classList.add(`effect-${active}`);
  }
}

function clearSpinEffects() {
  for (const id of EFFECT_CHOICES) {
    currentNumberEl.classList.remove(`effect-${id}`);
  }
}

function finishSpinCleanup() {
  spinActive = false;
  currentNumberEl.classList.remove("spinning");
  clearSpinEffects();
  document.body.classList.remove("is-spinning");
  nextBtn.disabled = isGameOver();
  if (!isGameOver()) statusEl.textContent = "";
}

function finishSpin(finalNumber) {
  clearTimeout(revealTimer);
  clearTimeout(tickTimer);
  stopSpinSound();
  playReveal();
  revealNumber(finalNumber);
  finishSpinCleanup();
}

function cancelSpin() {
  if (!spinActive) return;
  clearTimeout(revealTimer);
  clearTimeout(tickTimer);
  stopSpinSound();
  finishSpinCleanup();
  currentNumberEl.textContent = lastShownNumber;
}

function startSpin() {
  if (spinActive || isGameOver()) return;

  spinActive = true;
  nextBtn.disabled = true;
  currentNumberEl.classList.remove("pop");
  currentNumberEl.classList.add("spinning");
  applySpinEffect();
  document.body.classList.add("is-spinning");
  statusEl.textContent = "Generating\u2026";

  const finalNumber = shuffled[drawnCount];
  currentSpinSound = getActiveSound();

  if (prefersReducedMotion) {
    revealTimer = setTimeout(() => {
      playReveal();
      revealNumber(finalNumber);
      finishSpinCleanup();
    }, 1500);
    return;
  }

  ensureAudio();
  startSpinSound();

  const duration =
    1000 *
    (settings.minDuration +
      (drawnCount / TOTAL_NUMBERS) *
        (settings.maxDuration - settings.minDuration));
  cycleRemaining = shuffled.slice(drawnCount);

  let elapsed = 0;
  function tick() {
    const progress = Math.min(elapsed / duration, 1);
    const interval = 70 + 320 * progress * progress;
    tickTimer = setTimeout(() => {
      showCyclingNumber();
      playTick();
      updateSpinSound(progress);
      elapsed += interval;
      tick();
    }, interval);
  }
  tick();

  revealTimer = setTimeout(() => finishSpin(finalNumber), duration);
}

function drawNext() {
  if (spinActive || isGameOver()) return;
  if (!settings.spinEnabled) {
    revealNumber(shuffled[drawnCount]);
    return;
  }
  startSpin();
}

function resetGame() {
  cancelSpin();
  shuffled = shuffle(Array.from({ length: TOTAL_NUMBERS }, (_, i) => i + 1));
  drawnCount = 0;
  lastShownNumber = "\u2014";

  clearCurrentHighlight();
  boardEl.querySelectorAll(".cell.drawn").forEach((cell) => {
    cell.classList.remove("drawn");
  });

  currentNumberEl.classList.remove("pop");
  currentNumberEl.classList.remove("finished");
  currentNumberEl.textContent = "\u2014";

  historyEls.forEach((el) => el.replaceChildren());
  statusEl.textContent = "";
  updateRemaining();

  nextBtn.disabled = false;
}

const anySelectOpen = () =>
  document.querySelector(".select.open") !== null;

document.addEventListener("keydown", (event) => {
  if (anySelectOpen()) {
    if (event.key === "Escape") {
      closeAllSelects();
      return;
    }
    const list = layerMenu;
    if (!list) return;
    const items = Array.from(list.querySelectorAll("[role='option']"));
    const current = items.indexOf(document.activeElement);
    if (
      (event.key === "ArrowDown" || event.key === "ArrowUp") &&
      current === -1
    ) {
      const target =
        list.querySelector(".selected") ||
        (event.key === "ArrowDown" ? items[0] : items[items.length - 1]);
      if (target) {
        event.preventDefault();
        target.focus();
        target.scrollIntoView({ block: "nearest" });
      }
      return;
    }
    if (event.key === "ArrowDown" && current < items.length - 1) {
      event.preventDefault();
      items[current + 1].focus();
      items[current + 1].scrollIntoView({ block: "nearest" });
    } else if (event.key === "ArrowUp" && current > 0) {
      event.preventDefault();
      items[current - 1].focus();
      items[current - 1].scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter" && current !== -1) {
      event.preventDefault();
      items[current].click();
    }
    return;
  }

  if (event.repeat) return;

  const focusedOnButton = document.activeElement?.tagName === "BUTTON";

  if (
    event.code === "Space" &&
    !event.ctrlKey && !event.metaKey && !event.altKey
  ) {
    // Let the browser activate a focused button normally.
    if (focusedOnButton || spinActive || isGameOver()) return;
    event.preventDefault(); // stop the page from scrolling
    drawNext();
  } else if (
    (event.key === "r" || event.key === "R") &&
    !event.ctrlKey && !event.metaKey && !event.altKey
  ) {
    resetGame();
  } else if (event.key === "Escape") {
    setBoardOpen(false);
    setSettingsOpen(false);
  }
});

function isBoardOpen() {
  return document.body.classList.contains("board-open");
}

function setBoardOpen(open) {
  document.body.classList.toggle("board-open", open);
  boardFab.setAttribute("aria-expanded", String(open));
}

function isSettingsOpen() {
  return document.body.classList.contains("settings-open");
}

function setSettingsOpen(open) {
  document.body.classList.toggle("settings-open", open);
  settingsBtn.setAttribute("aria-expanded", String(open));
  if (!open) closeAllSelects();
}

function setSelectValue(select, value) {
  select.dataset.option = value;
  const label = select.querySelector(".select-value");
  const item = select.querySelector(`[data-value="${value}"]`);
  label.textContent = item ? item.textContent : value;
  select.querySelectorAll("[role='option']").forEach((option) => {
    const active = option.dataset.value === value;
    option.classList.toggle("selected", active);
    option.setAttribute("aria-selected", String(active));
  });
}

let activeSelect = null;

function closeAllSelects() {
  document.querySelectorAll(".select.open").forEach((select) => {
    select.classList.remove("open");
    select.querySelector(".select-trigger").setAttribute("aria-expanded", "false");
  });
  selectLayer.classList.remove("open");
  layerMenu.replaceChildren();
  activeSelect = null;
}

function buildLayerItems(select) {
  const items = Array.from(select.querySelectorAll(".select-menu li"));
  for (const source of items) {
    const option = document.createElement("li");
    option.setAttribute("role", "option");
    option.dataset.value = source.dataset.value;
    option.textContent = source.textContent;
    option.tabIndex = -1;
    const active = source.classList.contains("selected");
    option.classList.toggle("selected", active);
    option.setAttribute("aria-selected", String(active));
    layerMenu.appendChild(option);
  }
}

function openSelect(select) {
  closeAllSelects();
  activeSelect = select;
  buildLayerItems(select);

  select.classList.add("open");
  select.querySelector(".select-trigger").setAttribute("aria-expanded", "true");

  const trigger = select.querySelector(".select-trigger");
  const rect = trigger.getBoundingClientRect();

  selectLayer.style.left = `${rect.left}px`;
  selectLayer.style.width = `${rect.width}px`;
  selectLayer.classList.add("open");

  const menuHeight = layerMenu.offsetHeight;
  const gap = 8;
  const spaceBelow = window.innerHeight - rect.bottom;
  if (spaceBelow >= menuHeight + gap) {
    selectLayer.style.top = `${rect.bottom + gap}px`;
  } else {
    selectLayer.style.top = `${Math.max(gap, rect.top - menuHeight - gap)}px`;
  }
}

function toggleSelect(select) {
  if (select.classList.contains("open")) {
    closeAllSelects();
  } else {
    openSelect(select);
  }
}

function updateSettingsUI() {
  spinToggle.checked = settings.spinEnabled;
  spinOptions.classList.toggle("hidden", !settings.spinEnabled);
  durationRow.classList.toggle("hidden", !settings.spinEnabled);

  minDurationRange.max = settings.maxDuration;
  minDurationRange.value = settings.minDuration;
  maxDurationRange.min = settings.minDuration;
  maxDurationRange.value = settings.maxDuration;

  minValueEl.textContent = `${settings.minDuration}s`;
  maxValueEl.textContent = `${settings.maxDuration}s`;

  setSelectValue(effectSelect, settings.spinEffect);
  setSelectValue(soundSelect, settings.spinSound);
}

nextBtn.addEventListener("click", drawNext);
resetBtn.addEventListener("click", resetGame);
currentNumberEl.addEventListener("click", drawNext);

boardFab.addEventListener("click", () => setBoardOpen(!isBoardOpen()));
boardCloseBtn.addEventListener("click", () => setBoardOpen(false));
boardBackdrop.addEventListener("click", () => setBoardOpen(false));

settingsBtn.addEventListener("click", () => setSettingsOpen(!isSettingsOpen()));
settingsCloseBtn.addEventListener("click", () => setSettingsOpen(false));
settingsBackdrop.addEventListener("click", () => setSettingsOpen(false));

spinToggle.addEventListener("change", () => {
  settings.spinEnabled = spinToggle.checked;
  saveSettings();
  updateSettingsUI();
});

minDurationRange.addEventListener("input", () => {
  settings.minDuration = Math.min(Number(minDurationRange.value), settings.maxDuration);
  saveSettings();
  updateSettingsUI();
});

maxDurationRange.addEventListener("input", () => {
  settings.maxDuration = Math.max(Number(maxDurationRange.value), settings.minDuration);
  saveSettings();
  updateSettingsUI();
});

Array.from(document.querySelectorAll(".select")).forEach((select) => {
  const trigger = select.querySelector(".select-trigger");
  trigger.addEventListener("click", () => toggleSelect(select));
});

layerMenu.addEventListener("click", (event) => {
  const option = event.target.closest("[role='option']");
  if (!option || !activeSelect) return;
  if (activeSelect.id === "effect-select") {
    settings.spinEffect = option.dataset.value;
  } else {
    settings.spinSound = option.dataset.value;
  }
  saveSettings();
  updateSettingsUI();
  closeAllSelects();
});

document.addEventListener("click", (event) => {
  if (
    !event.target.closest(".select") &&
    !event.target.closest("#select-layer")
  ) {
    closeAllSelects();
  }
});

document.addEventListener("scroll", (event) => {
  if (!activeSelect) return;
  if (selectLayer.contains(event.target)) return;
  closeAllSelects();
}, true);

window.addEventListener("resize", () => {
  if (activeSelect) closeAllSelects();
});

buildBoard();
updateSettingsUI();
resetGame();
