import "../hundred-abacus";
import type { LearningContent } from "../app/types";

export const HUNDRED_ABACUS_CONTENT: LearningContent = {
  id: "hundred-abacus",
  title: "100そろばん",
  description: "たまを動かして100までの数と10のまとまりを学ぶ",
  tags: ["算数", "数量", "そろばん", "10のまとまり"],
};

const LEARNING_PATH = [
  { id: "fit-shape", icon: "🧩", category: "shape", phase: "みる" },
  { id: "flashcard", icon: "🧠", category: "memory", phase: "おぼえる" },
  { id: "dotburst", icon: "🟡", category: "math", phase: "かず" },
  { id: "hundred-abacus", icon: "🧮", category: "math", phase: "そろばん" },
  { id: "number-sequence", icon: "🔢", category: "math", phase: "ならび" },
  { id: "larger-number", icon: "⚖️", category: "math", phase: "くらべる" },
  { id: "clock-reading", icon: "🕐", category: "math", phase: "とけい" },
  { id: "pencil-practice", icon: "🖍️", category: "language", phase: "せん" },
  { id: "kakitori", icon: "✏️", category: "language", phase: "かく" },
] as const;

function refreshLearningPath(): void {
  const list = document.getElementById("content-list");
  if (!list) return;

  let note = document.getElementById("learning-path-note");
  if (!note) {
    note = document.createElement("div");
    note.id = "learning-path-note";
    note.className = "learning-path-note";
    list.before(note);
  }
  note.innerHTML = `<strong>⬇️ うえから じゅんばんに やってみよう</strong><span>${LEARNING_PATH.map((item) => item.phase).join(" → ")}</span>`;

  LEARNING_PATH.forEach((item, index) => {
    const card = list.querySelector<HTMLElement>(`[data-content-id="${item.id}"]`);
    if (!card) return;
    list.appendChild(card);
    card.dataset.learningStep = String(index + 1);
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
    badge.textContent = `STEP ${index + 1}`;
  });

  const counter = document.querySelector<HTMLElement>(".portal-content-count");
  if (counter) {
    counter.setAttribute("aria-label", "9つの学習コンテンツ");
    counter.innerHTML = '<span aria-hidden="true">🎮</span><span>9つ</span>';
  }
}

window.requestAnimationFrame(refreshLearningPath);
