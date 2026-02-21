import type { ViewId } from "./types";

interface RouterNodes {
  gameTabs: HTMLElement;
  homeTab: HTMLButtonElement;
  parentTab: HTMLButtonElement;
  portalView: HTMLElement;
  homeView: HTMLElement;
  playView: HTMLElement;
  parentView: HTMLElement;
}

export class ViewRouter {
  private readonly nodes: RouterNodes;

  constructor(nodes: RouterNodes) {
    this.nodes = nodes;
  }

  renderView(view: ViewId): void {
    this.nodes.portalView.classList.add("hidden");
    this.nodes.homeView.classList.add("hidden");
    this.nodes.playView.classList.add("hidden");
    this.nodes.parentView.classList.add("hidden");

    this.nodes.homeTab.classList.remove("active-tab");
    this.nodes.parentTab.classList.remove("active-tab");

    if (view === "portal") {
      this.nodes.portalView.classList.remove("hidden");
      this.nodes.gameTabs.classList.add("hidden");
      return;
    }

    this.nodes.gameTabs.classList.remove("hidden");

    if (view === "home") {
      this.nodes.homeView.classList.remove("hidden");
      this.nodes.homeTab.classList.add("active-tab");
      return;
    }

    if (view === "play") {
      this.nodes.playView.classList.remove("hidden");
      return;
    }

    this.nodes.parentView.classList.remove("hidden");
    this.nodes.parentTab.classList.add("active-tab");
  }
}
