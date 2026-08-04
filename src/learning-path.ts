const LEARNING_PATH = [
  { id: "fit-shape", icon: "🧩", category: "shape" },
  { id: "flashcard", icon: "🧠", category: "memory" },
  { id: "dotburst", icon: "🟡", category: "math" },
  { id: "hundred-abacus", icon: "🧮", category: "math" },
  { id: "number-sequence", icon: "🔢", category: "math" },
  { id: "larger-number", icon: "⚖️", category: "math" },
  { id: "clock-reading", icon: "🕐", category: "math" },
  { id: "pencil-practice", icon: "🖍️", category: "language" },
  { id: "kakitori", icon: "✏️", category: "language" },
] as const;

let applying = false;

function applyLearningPath(): void {
  const list = document.getElementById("content-list");
  if (!list || applying) return;
  applying = true;
  try {
    LEARNING_PATH.forEach((item, index) => {
      const card = list.querySelector<HTMLElement>(`[data-content-id="${item.id}"]`);
      if (!card) return;
      const step = index + 1;
      card.style.order = String(step);
      card.dataset.learningStep = String(step);
      card.dataset.category = item.category;

      const icon = card.querySelector<HTMLElement>(".content-icon");
      if (icon) icon.textContent = item.icon;

      const top = card.querySelector<HTMLElement>(".content-card-top");
      if (!top) return;
      let badge = top.querySelector<HTMLElement>(".content-step-badge");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "content-step-badge";
        top.appendChild(badge);
      }
      badge.textContent = `STEP ${step}`;
    });

    const counter = document.querySelector<HTMLElement>(".portal-content-count");
    if (counter) {
      counter.setAttribute("aria-label", `${LEARNING_PATH.length}つの学習コンテンツ`);
      counter.innerHTML = `<span aria-hidden="true">🎮</span><span>${LEARNING_PATH.length}つ</span>`;
    }
  } finally {
    applying = false;
  }
}

function initLearningPath(): void {
  const schedule = (): void => {
    window.requestAnimationFrame(applyLearningPath);
    window.setTimeout(applyLearningPath, 0);
    window.setTimeout(applyLearningPath, 120);
  };
  schedule();

  const list = document.getElementById("content-list");
  if (!list) return;
  const observer = new MutationObserver(() => {
    if (!applying) window.requestAnimationFrame(applyLearningPath);
  });
  observer.observe(list, { childList: true, subtree: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initLearningPath, { once: true });
} else {
  initLearningPath();
}

export { applyLearningPath };
