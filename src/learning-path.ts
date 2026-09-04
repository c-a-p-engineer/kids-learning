const LEARNING_PATH = [
  { id: "listening-mission", icon: "👂", category: "memory" },
  { id: "traffic-crossing", icon: "🚦", category: "memory" },
  { id: "fit-shape", icon: "🧩", category: "shape" },
  { id: "flashcard", icon: "🧠", category: "memory" },
  { id: "dotburst", icon: "🟡", category: "math" },
  { id: "number-sequence", icon: "🔢", category: "math" },
  { id: "larger-number", icon: "⚖️", category: "math" },
  { id: "clock-reading", icon: "🕐", category: "math" },
  { id: "pencil-practice", icon: "🖍️", category: "language" },
  { id: "kakitori", icon: "✏️", category: "language" },
] as const;

const HEADER_STEPS: Array<[string, number]> = [
  [".listening-mission-step", 1],
  [".traffic-crossing-step", 2],
  [".number-sequence-step", 6],
  [".clock-reading-step", 8],
  [".pencil-practice-step", 9],
];

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

    const balloonCard = list.querySelector<HTMLElement>('[data-content-id="balloon-attack"]');
    if (balloonCard) {
      balloonCard.style.order = "100";
      balloonCard.dataset.category = "activity";
      const icon = balloonCard.querySelector<HTMLElement>(".content-icon");
      if (icon) icon.textContent = "🎈";
    }

    const note = document.getElementById("learning-path-note");
    if (note) {
      note.innerHTML = "<strong>⬇️ STEP 1から じゅんばんに やってみよう</strong><span>きく → まつ・とまる → みる → おぼえる → かず → ならび → くらべる → とけい → せん → かく</span>";
    }

    HEADER_STEPS.forEach(([selector, step]) => {
      const label = document.querySelector<HTMLElement>(selector);
      if (label) label.textContent = `STEP ${step}`;
    });

    const counter = document.querySelector<HTMLElement>(".portal-content-count");
    if (counter) {
      const count = list.querySelectorAll("[data-content-id]").length;
      counter.setAttribute("aria-label", `${count}この学習コンテンツ`);
      counter.innerHTML = `<span aria-hidden="true">🎮</span><span>${count}こ</span>`;
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

  const main = document.getElementById("main-content");
  if (!main) return;
  const observer = new MutationObserver(() => {
    if (!applying) window.requestAnimationFrame(applyLearningPath);
  });
  observer.observe(main, { childList: true, subtree: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initLearningPath, { once: true });
} else {
  initLearningPath();
}

export { applyLearningPath };
