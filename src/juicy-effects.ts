/** Site-wide decorative feedback. Scores, records and game rules remain game-owned. */
import "./styles/juicy-effects.scss";

type Level = "max" | "soft" | "off";
type Reward = "correct" | "complete";
const LEVEL_KEY = "kids_fx_level_v1";
const SOUND_KEY = "kids_fx_sound_v1";
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const recent = new WeakMap<Element, number>();
let level: Level = "max";
let soundOn = false;
let layer: HTMLElement | null = null;
let combo = 0;
let lastRewardAt = 0;

function saved(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function persist(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* Storage is optional. */ }
}
function effectiveLevel(): Level {
  return reducedMotion.matches ? "off" : level;
}
function paintLevel(): void {
  document.body.dataset.fxLevel = effectiveLevel();
  document.querySelectorAll<HTMLButtonElement>("[data-fx-option]").forEach((button) => {
    const selected = button.dataset.fxOption === level;
    button.setAttribute("aria-pressed", String(selected));
    button.classList.toggle("is-active", selected);
  });
  if (effectiveLevel() === "off") layer?.replaceChildren();
}
function settings(): void {
  const details = document.querySelector<HTMLElement>(".portal-settings");
  if (!details || details.querySelector(".fx-settings")) return;
  const panel = document.createElement("div");
  panel.className = "fx-settings";
  panel.innerHTML = '<p class="fx-settings-title">✨ キラキラえんしゅつ</p>' +
    '<div class="fx-settings-choices" role="group" aria-label="エフェクトのりょう">' +
    '<button type="button" data-fx-option="max">🚀 もりもり</button>' +
    '<button type="button" data-fx-option="soft">🌱 ひかえめ</button>' +
    '<button type="button" data-fx-option="off">🌙 おやすみ</button></div>' +
    '<button type="button" class="fx-sound-setting">🔈 ごほうびのおと：オフ</button>' +
    '<p class="fx-settings-help">まぶしいときは「おやすみ」。たんまつの うごきをへらす せっていも ゆうせんするよ。</p>';
  details.append(panel);
  const sound = panel.querySelector<HTMLButtonElement>(".fx-sound-setting");
  function updateSound(): void {
    if (!sound) return;
    sound.textContent = soundOn ? "🔊 ごほうびのおと：オン" : "🔈 ごほうびのおと：オフ";
    sound.setAttribute("aria-pressed", String(soundOn));
  }
  panel.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>("button");
    if (!button) return;
    const chosen = button.dataset.fxOption;
    if (chosen === "max" || chosen === "soft" || chosen === "off") {
      level = chosen;
      persist(LEVEL_KEY, chosen);
      paintLevel();
    } else if (button.classList.contains("fx-sound-setting")) {
      soundOn = !soundOn;
      persist(SOUND_KEY, soundOn ? "on" : "off");
      updateSound();
    }
  });
  updateSound();
  paintLevel();
}
function overlay(): HTMLElement {
  if (layer?.isConnected) return layer;
  layer = document.createElement("div");
  layer.className = "fx-overlay";
  layer.setAttribute("aria-hidden", "true");
  document.body.append(layer);
  return layer;
}
function temporary(node: HTMLElement, duration: number): void {
  window.setTimeout(() => node.remove(), duration);
}
function beep(kind: Reward): void {
  if (!soundOn || effectiveLevel() === "off") return;
  try {
    const AudioCtor = window.AudioContext;
    if (!AudioCtor) return;
    const context = new AudioCtor();
    const start = context.currentTime;
    const tones = kind === "complete" ? [523, 659, 784] : [659, 880];
    tones.forEach((frequency, index) => {
      const time = start + index * 0.095;
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = "sine";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(0.045, time + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
      osc.connect(gain).connect(context.destination);
      osc.start(time);
      osc.stop(time + 0.2);
    });
    window.setTimeout(() => { void context.close().catch(() => undefined); }, 850);
  } catch { /* Never block learning if sound is unavailable. */ }
}
function reward(kind: Reward, source: Element): void {
  if (effectiveLevel() === "off" || document.hidden || !source.isConnected) return;
  const now = performance.now();
  if (now - (recent.get(source) ?? -Infinity) < 420) return;
  recent.set(source, now);
  if (now - lastRewardAt > 5000 || kind === "complete") combo = 0;
  lastRewardAt = now;
  combo += 1;
  const rect = source.getBoundingClientRect();
  const x = Math.max(35, Math.min(innerWidth - 35, rect.width ? rect.left + rect.width / 2 : innerWidth / 2));
  const y = Math.max(60, Math.min(innerHeight - 50, rect.height ? rect.top + rect.height / 2 : innerHeight * 0.38));
  const dest = overlay();
  const count = effectiveLevel() === "soft" ? 5 : kind === "complete" ? 24 : 12;
  const colors = ["#ff5b9a", "#ffca28", "#39dddf", "#8b69ff", "#7bde66"];
  for (let index = 0; index < count; index += 1) {
    const angle = 2 * Math.PI * index / count;
    const distance = 50 + (index % 4) * 18;
    const item = document.createElement("span");
    item.className = index % 3 === 0 ? "fx-spark fx-spark--star" : "fx-spark";
    item.style.left = x + "px";
    item.style.top = y + "px";
    item.style.backgroundColor = colors[index % colors.length];
    item.style.setProperty("--fx-x", Math.cos(angle) * distance + "px");
    item.style.setProperty("--fx-y", Math.sin(angle) * distance + "px");
    dest.append(item);
    temporary(item, 950);
  }
  const label = document.createElement("span");
  label.className = "fx-pop-label fx-pop-label--" + kind;
  label.style.left = x + "px";
  label.style.top = Math.max(90, y - 48) + "px";
  label.textContent = kind === "complete" ? "🎉 やったね！" : combo >= 3 ? "⭐ " + combo + " コンボ！" : "✨ せいかい！";
  dest.append(label);
  temporary(label, 1200);
  beep(kind);
}
const COMPLETE_SELECTOR = [
  '[data-role="result-screen"].is-active', '[data-role="result-screen"].active',
  '[data-role="result-modal"]:not(.hidden)', '[data-role="view-result"]:not(.hidden)',
  '#celebrate-stamp:not(.hidden)'
].join(",");
function classify(node: Element): Reward | null {
  if (!(node instanceof HTMLElement) || !node.isConnected) return null;
  if (node.closest("#view-parent,#replay-overlay,.fx-settings")) return null;
  if (node.matches(COMPLETE_SELECTOR)) {
    if (node.querySelector('[data-role="result-title"]')?.textContent?.includes("ぶつかった")) return null;
    return "complete";
  }
  if (node.matches(".larger-feedback--correct:not(.hidden),.flashcard-feedback-icon--ok,.listening-mission-feedback.is-success,.fit-shape-block.is-success,[data-role='feedback'].is-correct")) {
    if (node.getClientRects().length > 0) return "correct";
  }
  return null;
}
function observeRewards(): void {
  const observer = new MutationObserver((changes) => {
    if (effectiveLevel() === "off") return;
    for (const change of changes) {
      if (change.type === "attributes") {
        const node = change.target;
        if (node instanceof Element) {
          const kind = classify(node);
          if (kind) reward(kind, node);
        }
      } else {
        for (const added of Array.from(change.addedNodes)) {
          if (!(added instanceof Element) || added.classList.contains("fx-overlay")) continue;
          const kind = classify(added);
          if (kind) reward(kind, added);
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  window.addEventListener("pagehide", () => observer.disconnect(), { once: true });
}
function taps(): void {
  document.addEventListener("click", (event) => {
    if (effectiveLevel() !== "max") return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const control = target.closest<HTMLElement>("button,.content-card,[role='button']");
    if (!control || control.closest("#view-parent,.portal-settings,.fx-settings")) return;
    if (control.matches(":disabled,[aria-disabled='true']") || /delete|reset|clear-history/.test(control.id + (control.dataset.role || ""))) return;
    const rect = control.getBoundingClientRect();
    const ring = document.createElement("span");
    ring.className = "fx-tap-ripple";
    ring.style.left = (event.clientX || rect.left + rect.width / 2) + "px";
    ring.style.top = (event.clientY || rect.top + rect.height / 2) + "px";
    overlay().append(ring);
    temporary(ring, 500);
  }, { passive: true });
}
function init(): void {
  const initial = saved(LEVEL_KEY);
  level = initial === "soft" || initial === "off" ? initial : "max";
  soundOn = saved(SOUND_KEY) === "on";
  paintLevel();
  settings();
  observeRewards();
  taps();
  reducedMotion.addEventListener?.("change", paintLevel);
  document.addEventListener("kids-learning:reward", (event) => {
    const detail = (event as CustomEvent<{kind?: Reward; source?: Element}>).detail;
    const source = detail?.source ?? document.querySelector("main") ?? document.body;
    reward(detail?.kind === "complete" ? "complete" : "correct", source);
  });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
