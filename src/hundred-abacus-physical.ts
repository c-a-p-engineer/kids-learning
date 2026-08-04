import { audioService } from "./app/audio";
import "./styles/hundred-abacus-physical.scss";

const ROOT_ID = "hundred-abacus-experience";
const BOARD_SELECTOR = '[data-role="problem-abacus"], [data-role="free-abacus"]';

function isVisibleBoard(board: HTMLElement): boolean {
  const screen = board.closest<HTMLElement>(".hundred-abacus-screen");
  return Boolean(screen?.classList.contains("is-active"));
}

function playAbacusSound(value: number): void {
  audioService.resume();
  if (value > 0 && value % 10 === 0) {
    audioService.playTone({ frequency: 520, type: "triangle", gain: 0.11, durationMs: 120 });
    audioService.playTone({ frequency: 780, type: "triangle", gain: 0.09, durationMs: 140, startDelayMs: 80 });
    return;
  }
  if (value > 0 && value % 5 === 0) {
    audioService.playTone({ frequency: 660, type: "triangle", gain: 0.1, durationMs: 110 });
    return;
  }
  audioService.playTone({ frequency: 390, type: "square", gain: 0.07, durationMs: 55 });
}

function colorClass(rowIndex: number, columnIndex: number): "is-red" | "is-yellow" {
  const firstHalfRed = rowIndex % 2 === 0;
  const firstHalf = columnIndex < 5;
  return firstHalf === firstHalfRed ? "is-red" : "is-yellow";
}

function arrangeBoard(board: HTMLElement): void {
  const value = Number(board.getAttribute("aria-valuenow") ?? "0");
  board.classList.add("hundred-abacus-board--physical");

  board.querySelectorAll<HTMLElement>(".hundred-abacus-row").forEach((row, rowIndex) => {
    const rowStart = rowIndex * 10;
    const counted = Math.max(0, Math.min(10, value - rowStart));
    const firstCountedColumn = 10 - counted;
    row.classList.add("hundred-abacus-row--physical");
    row.setAttribute("aria-label", `${rowIndex + 1}だんめ、右に${counted}こ、数に入る`);

    row.querySelectorAll<HTMLElement>(".hundred-abacus-gap").forEach((gap) => gap.remove());
    const beads = Array.from(row.querySelectorAll<HTMLElement>(".hundred-abacus-bead"));
    beads.forEach((bead, columnIndex) => {
      bead.dataset.abacusColumn = String(columnIndex);
      const mappedValue = rowStart + (10 - columnIndex);
      bead.dataset.abacusValue = String(mappedValue);
      bead.setAttribute("aria-label", `${mappedValue}にする。右の玉が数に入る`);
      bead.classList.remove("is-active", "is-counted", "is-uncounted", "is-red", "is-yellow");
      bead.classList.add(colorClass(rowIndex, columnIndex));

      const countedBead = columnIndex >= firstCountedColumn;
      bead.classList.add(countedBead ? "is-counted" : "is-uncounted");
      const sideIndex = countedBead ? columnIndex - firstCountedColumn : columnIndex;
      const sideCount = countedBead ? counted : 10 - counted;
      bead.style.setProperty("--abacus-side-index", String(sideIndex));
      bead.style.setProperty("--abacus-side-count", String(sideCount));
      bead.style.setProperty("--abacus-column", String(columnIndex));
    });
  });
}

function bindBoard(board: HTMLElement): void {
  if (board.dataset.physicalAbacusBound === "true") {
    arrangeBoard(board);
    return;
  }
  board.dataset.physicalAbacusBound = "true";
  let previousValue = Number(board.getAttribute("aria-valuenow") ?? "0");

  const observer = new MutationObserver((mutations) => {
    const valueChanged = mutations.some((mutation) => mutation.type === "attributes" && mutation.attributeName === "aria-valuenow");
    arrangeBoard(board);
    if (!valueChanged) return;
    const nextValue = Number(board.getAttribute("aria-valuenow") ?? "0");
    if (nextValue !== previousValue && isVisibleBoard(board)) playAbacusSound(nextValue);
    previousValue = nextValue;
  });
  observer.observe(board, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-valuenow"] });
  arrangeBoard(board);
}

function applyPhysicalAbacus(): void {
  const root = document.getElementById(ROOT_ID);
  if (!root) return;
  root.querySelectorAll<HTMLElement>(BOARD_SELECTOR).forEach(bindBoard);

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
