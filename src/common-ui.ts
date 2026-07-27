import "./styles/common-ui.scss";
import "./number-sequence";
import "./clock-reading";
import "./pencil-practice";
import "./pencil-practice-video";

type ButtonVariant = "portal" | "back" | "menu" | "close" | "action";

interface ButtonDecoration {
  selector: string;
  icon: string;
  label: string;
  ariaLabel?: string;
  variant?: ButtonVariant;
}

interface TitleDecoration {
  container: string;
  icon: string;
  label: string;
}

const BUTTONS: ButtonDecoration[] = [
  { selector: "#tab-home", icon: "✏️", label: "れんしゅう", ariaLabel: "れんしゅう画面", variant: "action" },
  { selector: "#tab-parent", icon: "👪", label: "おうち", ariaLabel: "おうちの人の画面", variant: "action" },

  { selector: "#btn-back-portal", icon: "🏠", label: "いちらん", ariaLabel: "まなびの一覧にもどる", variant: "portal" },
  { selector: "#btn-dotburst-back-portal", icon: "🏠", label: "いちらん", ariaLabel: "まなびの一覧にもどる", variant: "portal" },
  { selector: "#btn-flashcard-back-portal", icon: "🏠", label: "いちらん", ariaLabel: "まなびの一覧にもどる", variant: "portal" },
  { selector: "#btn-larger-number-back-portal", icon: "🏠", label: "いちらん", ariaLabel: "まなびの一覧にもどる", variant: "portal" },
  { selector: "#btn-fit-shape-back-portal", icon: "🏠", label: "いちらん", ariaLabel: "まなびの一覧にもどる", variant: "portal" },
  { selector: "#btn-back-home", icon: "↩️", label: "もどる", ariaLabel: "もんだいの一覧にもどる", variant: "back" },

  { selector: "#btn-clear", icon: "🧹", label: "やりなおす", variant: "action" },
  { selector: "#btn-replay-model", icon: "🔁", label: "もういちど", variant: "action" },
  { selector: "#btn-done", icon: "💮", label: "できた！", variant: "action" },
  { selector: "#btn-read-char", icon: "🔊", label: "よむ", ariaLabel: "文字をよみあげる", variant: "action" },
  { selector: "#btn-close-replay", icon: "✖️", label: "とじる", variant: "close" },

  { selector: "#btn-add-mission", icon: "➕", label: "ついか", variant: "action" },
  { selector: "#btn-prune-old-history", icon: "🗑️", label: "ふるい10けん", ariaLabel: "古い記録を10件削除", variant: "action" },
  { selector: "#btn-download-all-images", icon: "🖼️", label: "がぞう", ariaLabel: "画像をまとめてダウンロード", variant: "action" },
  { selector: "#btn-download-all-videos", icon: "🎬", label: "どうが", ariaLabel: "動画をまとめてダウンロード", variant: "action" },
  { selector: "#btn-reset-data", icon: "⚠️", label: "リセット", ariaLabel: "すべての学習データをリセット", variant: "action" },

  { selector: "#dotburst-root [data-role='open-history']", icon: "📜", label: "きろく", ariaLabel: "これまでの記録をみる", variant: "action" },
  { selector: "#dotburst-root [data-role='go-home']", icon: "🎮", label: "メニュー", ariaLabel: "ドットバーストのメニューにもどる", variant: "menu" },
  { selector: "#dotburst-root [data-role='close-history']", icon: "↩️", label: "もどる", ariaLabel: "ドットバーストのメニューにもどる", variant: "back" },

  { selector: "#flashcard-root [data-role='btn-history']", icon: "📜", label: "きろく", ariaLabel: "これまでの記録をみる", variant: "action" },
  { selector: "#flashcard-root [data-role='btn-back-title']", icon: "🎮", label: "メニュー", ariaLabel: "えもじフラッシュのメニューにもどる", variant: "menu" },
  { selector: "#flashcard-root [data-role='btn-close-history']", icon: "✖️", label: "とじる", ariaLabel: "記録をとじる", variant: "close" },
  { selector: "#flashcard-root [data-role='btn-clear-history']", icon: "🗑️", label: "きろくをけす", ariaLabel: "すべての記録を削除", variant: "action" },

  { selector: "#larger-number-root [data-role='btn-open-scores']", icon: "📊", label: "きろく", ariaLabel: "これまでの記録をみる", variant: "action" },
  { selector: "#larger-number-root [data-role='btn-back-title-from-scores']", icon: "↩️", label: "もどる", ariaLabel: "どっちが大きいのメニューにもどる", variant: "back" },
  { selector: "#larger-number-root [data-role='btn-back-title-from-result']", icon: "🎮", label: "メニュー", ariaLabel: "どっちが大きいのメニューにもどる", variant: "menu" },
  { selector: "#larger-number-root [data-role='btn-clear-scores']", icon: "🗑️", label: "けす", ariaLabel: "すべての記録を削除", variant: "action" },

  { selector: "#fit-shape-root [data-role='btn-back-menu']", icon: "🎮", label: "メニュー", ariaLabel: "ぴったりシェイプのメニューにもどる", variant: "menu" },
  { selector: "#fit-shape-root [data-role='btn-retry']", icon: "🔁", label: "もういちど", ariaLabel: "もういちどあそぶ", variant: "action" },
];

const TITLES: TitleDecoration[] = [
  { container: "#kakitori-home", icon: "✏️", label: "かきとり" },
  { container: "#dotburst-home", icon: "🎯", label: "ドットバースト" },
  { container: "#flashcard-home", icon: "🧠", label: "えもじフラッシュ" },
  { container: "#larger-number-home", icon: "🍎", label: "どっちがおおきい？" },
  { container: "#fit-shape-home", icon: "🧩", label: "ぴったりシェイプ" },
];

const FILTER_ICONS: Record<string, string> = {
  all: "🌈",
  language: "✏️",
  math: "🔢",
  memory: "🧠",
  shape: "🧩",
};

const THEME_ICONS: Record<string, string> = {
  "btn-theme-warm": "☀️",
  "btn-theme-cool": "💧",
  "btn-theme-fancy": "🌸",
  "btn-theme-cyber": "🤖",
};

const INDEPENDENT_VIEW_IDS = ["number-sequence-experience", "clock-reading-experience", "pencil-practice-experience"];

function iconMarkup(icon: string, label: string): string {
  return `<span class="child-button-icon" aria-hidden="true">${icon}</span><span class="child-button-label">${label}</span>`;
}

function decorateButton(config: ButtonDecoration): void {
  const button = document.querySelector<HTMLButtonElement>(config.selector);
  if (!button || button.dataset.commonUi === "true") return;

  button.dataset.commonUi = "true";
  button.classList.add("child-action-with-icon", `child-action-with-icon--${config.variant ?? "action"}`);
  button.innerHTML = iconMarkup(config.icon, config.label);
  button.setAttribute("aria-label", config.ariaLabel ?? config.label);
}

function decorateTitles(): void {
  TITLES.forEach(({ container, icon, label }) => {
    const title = document.querySelector<HTMLElement>(`${container} .page-title`);
    if (!title || title.dataset.commonUi === "true") return;

    title.dataset.commonUi = "true";
    title.classList.add("child-page-title");
    title.innerHTML = `<span class="child-page-title-icon" aria-hidden="true">${icon}</span><span>${label}</span>`;
    title.setAttribute("aria-label", label);
  });
}

function syncFilterAriaState(): void {
  document.querySelectorAll<HTMLButtonElement>("#portal-filter-group [data-filter]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.classList.contains("is-active")));
  });
}

function decorateFilters(): void {
  document.querySelectorAll<HTMLButtonElement>("#portal-filter-group [data-filter]").forEach((button) => {
    if (button.dataset.commonUi === "true") return;
    const filter = button.dataset.filter ?? "";
    const icon = FILTER_ICONS[filter];
    if (!icon) return;

    button.dataset.commonUi = "true";
    button.classList.add("child-action-with-icon", "child-filter-button");
    const label = button.textContent?.trim() ?? "";
    button.innerHTML = iconMarkup(icon, label);
  });

  syncFilterAriaState();

  const group = document.getElementById("portal-filter-group");
  if (group && group.dataset.commonUiAria !== "true") {
    group.dataset.commonUiAria = "true";
    group.addEventListener("click", () => {
      window.requestAnimationFrame(syncFilterAriaState);
    });
  }
}

function decorateThemes(): void {
  Object.entries(THEME_ICONS).forEach(([id, icon]) => {
    const button = document.getElementById(id);
    if (!(button instanceof HTMLButtonElement) || button.dataset.commonUi === "true") return;

    button.dataset.commonUi = "true";
    button.classList.add("child-action-with-icon", "child-theme-button");
    const label = button.textContent.trim();
    button.innerHTML = iconMarkup(icon, label);
  });
}

function movePracticeBackButtonToTop(): void {
  const playHeader = document.querySelector<HTMLElement>(".play-header");
  const backButton = document.getElementById("btn-back-home");
  if (!playHeader || !(backButton instanceof HTMLButtonElement)) return;
  if (backButton.parentElement !== playHeader) {
    playHeader.prepend(backButton);
  }
  playHeader.classList.add("child-play-header");
}

function decoratePortal(): void {
  const heading = document.getElementById("portal-heading");
  if (heading && heading.dataset.commonUi !== "true") {
    heading.dataset.commonUi = "true";
    heading.innerHTML = '<span class="portal-title-icon" aria-hidden="true">🎒</span><span>まなびのライブラリ</span>';
  }

  const contentCount = document.querySelector<HTMLElement>(".portal-content-count");
  if (contentCount && contentCount.dataset.commonUi !== "true") {
    contentCount.dataset.commonUi = "true";
    contentCount.innerHTML = '<span aria-hidden="true">🎮</span><span>8つ</span>';
    contentCount.setAttribute("aria-label", "8つの学習コンテンツ");
  }

  const search = document.getElementById("portal-search-input");
  if (search instanceof HTMLInputElement) {
    search.placeholder = "🔎 なまえで さがす";
  }
}

function bindIndependentViewTabs(): void {
  const main = document.getElementById("main-content");
  const tabs = document.getElementById("game-tabs");
  if (!main || !tabs || main.dataset.independentTabsBound === "true") return;
  main.dataset.independentTabsBound = "true";

  const sync = (): void => {
    const independentViewActive = INDEPENDENT_VIEW_IDS.some((id) => {
      const view = document.getElementById(id);
      return view instanceof HTMLElement && !view.classList.contains("hidden");
    });
    if (independentViewActive) tabs.classList.add("hidden");
  };

  const observer = new MutationObserver(sync);
  observer.observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  sync();
}

function decorateLevelButtons(): void {
  const levels: Array<[string, string]> = [
    ["#larger-number-root [data-role='btn-start-easy']", "🐣"],
    ["#larger-number-root [data-role='btn-start-normal']", "🦁"],
    ["#larger-number-root [data-role='btn-start-hard']", "🚀"],
    ["#fit-shape-root [data-role='btn-start-easy']", "🐣"],
    ["#fit-shape-root [data-role='btn-start-medium']", "🦁"],
    ["#fit-shape-root [data-role='btn-start-hard']", "🚀"],
  ];

  levels.forEach(([selector, icon]) => {
    const button = document.querySelector<HTMLButtonElement>(selector);
    if (!button || button.dataset.commonUi === "true") return;
    button.dataset.commonUi = "true";
    button.classList.add("child-action-with-icon", "child-level-button");
    const label = button.textContent?.trim() ?? "";
    button.innerHTML = iconMarkup(icon, label);
  });
}

function applyCommonUi(): void {
  movePracticeBackButtonToTop();
  BUTTONS.forEach(decorateButton);
  decorateTitles();
  decorateFilters();
  decorateThemes();
  decoratePortal();
  bindIndependentViewTabs();
  decorateLevelButtons();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", applyCommonUi, { once: true });
} else {
  applyCommonUi();
}
