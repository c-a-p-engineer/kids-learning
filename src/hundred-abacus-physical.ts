import { audioService } from "./app/audio";
import "./styles/hundred-abacus-physical.scss";

const ROOT_ID = "hundred-abacus-experience";
const BOARD_SELECTOR = '[data-role="problem-abacus"], [data-role="free-abacus"]';
const BEAD_EDGE_PERCENT = 5;
const BEAD_STEP_PERCENT = 5.6;
const SOUND_THROTTLE_MS = 32;
const MOVE_DURATION_MS = 360;
const MOVE_STAGGER_MS = 18;

let dragging = false;
let dragBoard: HTMLElement | null = null;
let lastInteractionValue: number | null = null;
let lastSoundAt = 0;

function isVisibleBoard(board: HTMLElement): boolean {
  const screen = board.closest<HTMLElement>(".hundred-abacus-screen");
  return Boolean(screen?.classList.contains("is-active"));
}

function readBoardValue(board: HTMLElement): number {
  const value = Number(board.getAttribute("aria-valuenow") ?? "0");
  return Number.isFinite(value) ? value : 0;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function playAbacusSound(previousValue: number, value: number): void {
  if (previousValue === value) return;
  const now = performance.now();
  if (now - lastSoundAt < SOUND_THROTTLE_MS) return;
  lastSoundAt = now;

  audioService.resume();
  const increasing = value > previousValue;
  const baseFrequency = increasing ? 520 : 390;

  audioService.playTone({
    frequency: baseFrequency,
    sweepToFrequency: increasing ? 430 : 330,
    type: "triangle",
    gain: 0.15,
    durationMs: 72,
  });
  audioService.playTone({
    frequency: increasing ? 920 : 760,
    type: "square",
    gain: 0.055,
    durationMs: 34,
    startDelayMs: 7,
  });

  if (value > 0 && value % 10 === 0) {
    audioService.playTone({
      frequency: 1040,
      sweepToFrequency: 1320,
      type: "sine",
      gain: 0.11,
      durationMs: 125,
      startDelayMs: 42,
    });
  } else if (value > 0 && value % 5 === 0) {
    audioService.playTone({
      frequency: 820,
      type: "sine",
      gain: 0.09,
      durationMs: 95,
      startDelayMs: 38,
    });
  }
}

function playInteractionValue(board: HTMLElement, value: number): void {
  const previousValue = lastInteractionValue ?? readBoardValue(board);
  if (previousValue === value) return;
  playAbacusSound(previousValue, value);
  lastInteractionValue = value;
}

function colorClass(rowIndex: number, columnIndex: number): "is-red" | "is-yellow" {
  const firstHalfRed = rowIndex % 2 === 0;
  const firstHalf = columnIndex < 5;
  return firstHalf === firstHalfRed ? "is-red" : "is-yellow";
}

function countedInRow(value: number, rowIndex: number): number {
  return Math.max(0, Math.min(10, value - rowIndex * 10));
}

function beadPosition(columnIndex: number, counted: boolean): number {
  const offsetIndex = counted ? 9 - columnIndex : columnIndex;
  const offset = offsetIndex * BEAD_STEP_PERCENT;
  return counted ? 100 - BEAD_EDGE_PERCENT - offset : BEAD_EDGE_PERCENT + offset;
}

function targetValueForBead(rowIndex: number, columnIndex: number, counted: boolean): number {
  const rowStart = rowIndex * 10;
  if (counted) {
    return rowStart + (9 - columnIndex);
  }
  return rowStart + (10 - columnIndex);
}

function animateMovedBead(
  bead: HTMLElement,
  row: HTMLElement,
  oldPosition: number,
  newPosition: number,
  movementOrder: number,
): void {
  if (prefersReducedMotion() || typeof bead.animate !== "function") return;

  const direction = newPosition > oldPosition ? 1 : -1;
  const middlePosition = oldPosition + (newPosition - oldPosition) * 0.56;
  bead.animate(
    [
      {
        left: `${oldPosition}%`,
        transform: "translate(-50%, -50%) scale(1)",
        filter: "brightness(1)",
      },
      {
        left: `${middlePosition}%`,
        transform: `translate(calc(-50% + ${direction * 0.12}rem), -50%) scale(1.2)`,
        filter: "brightness(1.3) drop-shadow(0 0 0.42rem rgba(255, 255, 255, 0.8))",
        offset: 0.58,
      },
      {
        left: `${newPosition}%`,
        transform: "translate(-50%, -50%) scale(1)",
        filter: "brightness(1.04)",
      },
    ],
    {
      duration: MOVE_DURATION_MS,
      delay: movementOrder * MOVE_STAGGER_MS,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      fill: "both",
    },
  );

  if (typeof row.animate === "function") {
    row.animate(
      [
        { backgroundColor: "rgba(255, 255, 255, 0)" },
        { backgroundColor: "rgba(255, 244, 171, 0.48)", offset: 0.48 },
        { backgroundColor: "rgba(255, 255, 255, 0)" },
      ],
      {
        duration: MOVE_DURATION_MS + movementOrder * MOVE_STAGGER_MS,
        easing: "ease-out",
      },
    );
  }
}

function arrangeBoard(board: HTMLElement): void {
  const value = readBoardValue(board);
  const storedPrevious = board.dataset.abacusVisualValue;
  const previousValue = storedPrevious === undefined ? value : Number(storedPrevious);
  const shouldAnimate = Number.isFinite(previousValue) && previousValue !== value;
  const increasing = value > previousValue;

  board.classList.add("hundred-abacus-board--physical");
  board.dataset.abacusVisualValue = String(value);

  board.querySelectorAll<HTMLElement>(".hundred-abacus-row").forEach((row, rowIndex) => {
    const counted = countedInRow(value, rowIndex);
    const previousCounted = countedInRow(previousValue, rowIndex);
    const firstCountedColumn = 10 - counted;
    const previousFirstCountedColumn = 10 - previousCounted;

    row.classList.add("hundred-abacus-row--physical");
    row.setAttribute("aria-label", `${rowIndex + 1}だんめ、右に${counted}こ、数に入る`);
    row.querySelectorAll<HTMLElement>(".hundred-abacus-gap").forEach((gap) => gap.remove());

    const beads = Array.from(row.querySelectorAll<HTMLElement>(".hundred-abacus-bead"));
    beads.forEach((bead, columnIndex) => {
      bead.dataset.abacusColumn = String(columnIndex);
      const countedBead = columnIndex >= firstCountedColumn;
      const previouslyCounted = columnIndex >= previousFirstCountedColumn;
      const targetValue = targetValueForBead(rowIndex, columnIndex, countedBead);
      const disabled = bead.classList.contains("is-disabled");

      if (disabled) {
        delete bead.dataset.abacusValue;
        bead.setAttribute("aria-hidden", "true");
      } else {
        bead.dataset.abacusValue = String(targetValue);
        bead.removeAttribute("aria-hidden");
        bead.setAttribute(
          "aria-label",
          countedBead
            ? `${targetValue}にへらす。右の玉を左へ戻す`
            : `${targetValue}にふやす。左の玉を右へ動かす`,
        );
      }

      bead.classList.remove("is-active", "is-counted", "is-uncounted", "is-red", "is-yellow");
      bead.classList.add(colorClass(rowIndex, columnIndex));
      bead.classList.add(countedBead ? "is-counted" : "is-uncounted");

      const newPosition = beadPosition(columnIndex, countedBead);
      bead.style.setProperty("--abacus-position", `${newPosition}%`);

      if (shouldAnimate && previouslyCounted !== countedBead) {
        const oldPosition = beadPosition(columnIndex, previouslyCounted);
        const movementOrder = increasing ? 9 - columnIndex : columnIndex;
        animateMovedBead(bead, row, oldPosition, newPosition, movementOrder);
      }
    });
  });
}

function keyboardNextValue(board: HTMLElement, event: KeyboardEvent): number | null {
  const current = readBoardValue(board);
  const maximum = Number(board.getAttribute("aria-valuemax") ?? "100");
  let next = current;

  if (event.key === "ArrowRight" || event.key === "ArrowUp") next += 1;
  else if (event.key === "ArrowLeft" || event.key === "ArrowDown") next -= 1;
  else if (event.key === "PageUp") next += 10;
  else if (event.key === "PageDown") next -= 10;
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = maximum;
  else return null;

  return Math.max(0, Math.min(maximum, next));
}

function bindBoard(board: HTMLElement): void {
  if (board.dataset.physicalAbacusBound === "true") {
    arrangeBoard(board);
    return;
  }
  board.dataset.physicalAbacusBound = "true";

  board.addEventListener(
    "keydown",
    (event) => {
      if (!isVisibleBoard(board)) return;
      const next = keyboardNextValue(board, event);
      if (next === null) return;
      lastInteractionValue = readBoardValue(board);
      playInteractionValue(board, next);
      lastInteractionValue = null;
    },
    { capture: true },
  );

  const observer = new MutationObserver(() => arrangeBoard(board));
  observer.observe(board, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-valuenow"],
  });
  arrangeBoard(board);
}

function bindInteractionSounds(root: HTMLElement): void {
  if (root.dataset.abacusSoundBound === "true") return;
  root.dataset.abacusSoundBound = "true";

  root.addEventListener(
    "pointerdown",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const bead = target.closest<HTMLElement>("[data-abacus-value]");
      const board = bead?.closest<HTMLElement>(BOARD_SELECTOR);
      if (!bead || !board || !isVisibleBoard(board)) return;
      const value = Number(bead.dataset.abacusValue);
      if (!Number.isFinite(value)) return;

      audioService.resume();
      dragging = true;
      dragBoard = board;
      lastInteractionValue = readBoardValue(board);
      playInteractionValue(board, value);
    },
    { capture: true },
  );

  root.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const reset = target.closest<HTMLElement>('[data-role="problem-reset"], [data-role="free-reset"]');
      if (!reset) return;
      const screen = reset.closest<HTMLElement>(".hundred-abacus-screen");
      const board = screen?.querySelector<HTMLElement>(BOARD_SELECTOR);
      if (!board) return;
      const current = readBoardValue(board);
      if (current !== 0) playAbacusSound(current, 0);
    },
    { capture: true },
  );

  window.addEventListener(
    "pointermove",
    (event) => {
      if (!dragging || !dragBoard) return;
      const element = document.elementFromPoint(event.clientX, event.clientY);
      if (!(element instanceof HTMLElement)) return;
      const bead = element.closest<HTMLElement>("[data-abacus-value]");
      const board = bead?.closest<HTMLElement>(BOARD_SELECTOR);
      if (!bead || board !== dragBoard) return;
      const value = Number(bead.dataset.abacusValue);
      if (Number.isFinite(value)) playInteractionValue(dragBoard, value);
    },
    { passive: true },
  );

  const stopDragging = (): void => {
    dragging = false;
    dragBoard = null;
    lastInteractionValue = null;
  };
  window.addEventListener("pointerup", stopDragging, { passive: true });
  window.addEventListener("pointercancel", stopDragging, { passive: true });
}

function applyPhysicalAbacus(): void {
  const root = document.getElementById(ROOT_ID);
  if (!root) return;
  root.querySelectorAll<HTMLElement>(BOARD_SELECTOR).forEach(bindBoard);
  bindInteractionSounds(root);

  const observer = new MutationObserver(() => {
    root.querySelectorAll<HTMLElement>(BOARD_SELECTOR).forEach(bindBoard);
  });
  observer.observe(root, { childList: true, subtree: true });
}

function initPhysicalAbacus(): void {
  if (document.getElementById(ROOT_ID)) {
    applyPhysicalAbacus();
    return;
  }
  const main = document.getElementById("main-content");
  if (!main) return;
  const observer = new MutationObserver(() => {
    if (!document.getElementById(ROOT_ID)) return;
    observer.disconnect();
    applyPhysicalAbacus();
  });
  observer.observe(main, { childList: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPhysicalAbacus, { once: true });
} else {
  initPhysicalAbacus();
}
