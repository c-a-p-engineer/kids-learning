import type { LearningContent } from "../app/types";

export const BALLOON_ATTACK_CONTENT: LearningContent = {
  id: "balloon-attack",
  title: "30びょう バルーンアタック",
  description: "カメラのまえで うごいて、ふうせんを たくさん わろう",
  tags: ["うんどう", "カメラ", "1さいから", "30びょう"],
};

document.addEventListener(
  "click",
  (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const card = target.closest<HTMLElement>("[data-content-id='balloon-attack']");
    if (!card) return;
    event.preventDefault();
    event.stopPropagation();
    window.location.href = "./balloon-attack/";
  },
  { capture: true },
);
