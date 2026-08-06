const MARKER_CAMERA_WIDTH = 96;
const MARKER_CAMERA_HEIGHT = 72;
const GRID_COLUMNS = 4;
const GRID_ROWS = 3;
const MAX_MARKERS = 5;
const PIXEL_DIFFERENCE_THRESHOLD = 92;
const CELL_MOTION_RATIO = 0.055;

type MotionCell = {
  column: number;
  row: number;
  ratio: number;
};

const stage = document.querySelector<HTMLElement>("#stage");
const video = document.querySelector<HTMLVideoElement>("#camera");
const panels = Array.from(document.querySelectorAll<HTMLElement>("#start-panel, #countdown-panel, #result-panel, #error-panel"));

if (stage && video) {
  const analysisCanvas = document.createElement("canvas");
  analysisCanvas.width = MARKER_CAMERA_WIDTH;
  analysisCanvas.height = MARKER_CAMERA_HEIGHT;
  const analysisContext = analysisCanvas.getContext("2d", { willReadFrequently: true });

  const markerLayer = document.createElement("div");
  markerLayer.className = "hit-marker-layer";
  markerLayer.setAttribute("aria-hidden", "true");
  stage.append(markerLayer);

  const markers = Array.from({ length: MAX_MARKERS }, () => {
    const marker = document.createElement("div");
    marker.className = "hit-marker";
    marker.innerHTML = '<span class="hit-marker-dot"></span>';
    markerLayer.append(marker);
    return marker;
  });

  const style = document.createElement("style");
  style.textContent = `
    .hit-marker-layer {
      position: absolute;
      inset: 0;
      z-index: 7;
      pointer-events: none;
      overflow: hidden;
    }
    .hit-marker {
      --marker-strength: 0;
      position: absolute;
      width: clamp(72px, 16vw, 118px);
      aspect-ratio: 1;
      border: clamp(4px, .8vw, 7px) solid rgba(255, 255, 255, .94);
      border-radius: 50%;
      transform: translate(-50%, -50%) scale(calc(.88 + var(--marker-strength) * .14));
      opacity: calc(.42 + var(--marker-strength) * .5);
      box-shadow:
        0 0 0 5px rgba(0, 181, 255, .72),
        0 0 24px 8px rgba(0, 181, 255, .48),
        inset 0 0 15px rgba(255, 255, 255, .8);
      transition: left 80ms linear, top 80ms linear, opacity 100ms ease, transform 100ms ease;
    }
    .hit-marker::before,
    .hit-marker::after {
      content: "";
      position: absolute;
      left: 50%;
      top: 50%;
      background: rgba(255, 255, 255, .96);
      transform: translate(-50%, -50%);
      border-radius: 999px;
    }
    .hit-marker::before { width: 42%; height: 5px; }
    .hit-marker::after { width: 5px; height: 42%; }
    .hit-marker-dot {
      position: absolute;
      left: 50%;
      top: 50%;
      width: 15%;
      aspect-ratio: 1;
      border-radius: 50%;
      background: #ffe34e;
      border: 3px solid #fff;
      transform: translate(-50%, -50%);
      box-shadow: 0 0 12px rgba(255, 213, 0, .9);
    }
    .hit-marker.is-strong {
      box-shadow:
        0 0 0 6px rgba(255, 73, 104, .82),
        0 0 28px 10px rgba(255, 73, 104, .58),
        inset 0 0 16px rgba(255, 255, 255, .9);
    }
    @media (prefers-reduced-motion: reduce) {
      .hit-marker { transition: none; }
    }
  `;
  document.head.append(style);

  let previousFrame: Uint8ClampedArray | null = null;

  function gameIsActive(): boolean {
    return panels.every((panel) => panel.classList.contains("hidden")) && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
  }

  function hideMarkers(): void {
    markers.forEach((marker) => {
      marker.hidden = true;
    });
  }

  function findMotionCells(current: Uint8ClampedArray, previous: Uint8ClampedArray): MotionCell[] {
    const cellWidth = MARKER_CAMERA_WIDTH / GRID_COLUMNS;
    const cellHeight = MARKER_CAMERA_HEIGHT / GRID_ROWS;
    const changed = new Array<number>(GRID_COLUMNS * GRID_ROWS).fill(0);
    const sampled = new Array<number>(GRID_COLUMNS * GRID_ROWS).fill(0);

    for (let y = 0; y < MARKER_CAMERA_HEIGHT; y += 2) {
      for (let x = 0; x < MARKER_CAMERA_WIDTH; x += 2) {
        const pixelIndex = (y * MARKER_CAMERA_WIDTH + x) * 4;
        const difference =
          Math.abs(current[pixelIndex] - previous[pixelIndex]) +
          Math.abs(current[pixelIndex + 1] - previous[pixelIndex + 1]) +
          Math.abs(current[pixelIndex + 2] - previous[pixelIndex + 2]);
        const column = Math.min(GRID_COLUMNS - 1, Math.floor(x / cellWidth));
        const row = Math.min(GRID_ROWS - 1, Math.floor(y / cellHeight));
        const cellIndex = row * GRID_COLUMNS + column;
        sampled[cellIndex] += 1;
        if (difference >= PIXEL_DIFFERENCE_THRESHOLD) changed[cellIndex] += 1;
      }
    }

    return changed
      .map((count, index) => ({
        column: index % GRID_COLUMNS,
        row: Math.floor(index / GRID_COLUMNS),
        ratio: sampled[index] > 0 ? count / sampled[index] : 0,
      }))
      .filter((cell) => cell.ratio >= CELL_MOTION_RATIO)
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, MAX_MARKERS);
  }

  function renderMarkers(cells: MotionCell[]): void {
    cells.forEach((cell, index) => {
      const marker = markers[index];
      marker.hidden = false;
      marker.style.left = `${((cell.column + 0.5) / GRID_COLUMNS) * 100}%`;
      marker.style.top = `${((cell.row + 0.5) / GRID_ROWS) * 100}%`;
      marker.style.setProperty("--marker-strength", String(Math.min(1, cell.ratio / 0.32)));
      marker.classList.toggle("is-strong", cell.ratio >= 0.18);
    });
    markers.slice(cells.length).forEach((marker) => {
      marker.hidden = true;
    });
  }

  function update(): void {
    if (!analysisContext || !gameIsActive()) {
      previousFrame = null;
      hideMarkers();
      requestAnimationFrame(update);
      return;
    }

    analysisContext.save();
    analysisContext.scale(-1, 1);
    analysisContext.drawImage(video, -MARKER_CAMERA_WIDTH, 0, MARKER_CAMERA_WIDTH, MARKER_CAMERA_HEIGHT);
    analysisContext.restore();
    const current = analysisContext.getImageData(0, 0, MARKER_CAMERA_WIDTH, MARKER_CAMERA_HEIGHT).data;

    if (previousFrame) {
      renderMarkers(findMotionCells(current, previousFrame));
    }
    previousFrame = new Uint8ClampedArray(current);
    requestAnimationFrame(update);
  }

  hideMarkers();
  requestAnimationFrame(update);
}
