import "../number-sequence";
import type { LearningContent } from "../app/types";

export const NUMBER_SEQUENCE_CONTENT: LearningContent = {
  id: "number-sequence",
  title: "かずの ならび",
  description: "ぬけている数を見つける30秒ゲーム",
  tags: ["算数", "数列", "順序", "30秒"],
};

function refreshPortalCount(): void {
  window.requestAnimationFrame(() => {
    const count = document.querySelectorAll("#content-list [data-content-id]").length;
    const counter = document.querySelector<HTMLElement>(".portal-content-count");
    if (!counter) return;
    counter.setAttribute("aria-label", `${count}つの学習コンテンツ`);
    counter.innerHTML = `<span aria-hidden="true">🎮</span><span>${count}つ</span>`;
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", refreshPortalCount, { once: true });
} else {
  refreshPortalCount();
}
