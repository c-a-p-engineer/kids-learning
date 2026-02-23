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

export interface UrlRoute {
  contentId: string | null;
  view: ViewId;
}

export class ViewRouter {
  private readonly nodes: RouterNodes;
  private readonly basePath: string;
  private readonly contentIds: Set<string>;
  private static readonly VIEWS: ViewId[] = ["portal", "home", "play", "parent"];

  constructor(nodes: RouterNodes, contentIds: string[]) {
    this.nodes = nodes;
    this.contentIds = new Set(contentIds);
    this.basePath = this.detectBasePath(window.location.pathname);
  }

  private detectBasePath(pathname: string): string {
    const trimmed = pathname.replace(/\/+$/, "");
    const segments = trimmed.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    const isView = ViewRouter.VIEWS.includes(last as ViewId);
    const withoutView = isView ? segments.slice(0, -1) : segments;
    const maybeContent = withoutView[withoutView.length - 1];
    const isContent = this.contentIds.has(maybeContent);
    const baseSegments = isContent ? withoutView.slice(0, -1) : withoutView;
    if (baseSegments.length === 0) return "";
    return `/${baseSegments.join("/")}`;
  }

  private toPath(contentId: string | null, view: ViewId): string {
    if (view === "portal") {
      return this.basePath || "/";
    }
    if (!contentId) {
      return this.basePath || "/";
    }
    if (view === "home") {
      return `${this.basePath}/${contentId}`;
    }
    return `${this.basePath}/${contentId}/${view}`;
  }

  resolveUrlRoute(): UrlRoute {
    const trimmed = window.location.pathname.replace(/\/+$/, "");
    const allSegments = trimmed.split("/").filter(Boolean);
    const baseSegments = this.basePath.split("/").filter(Boolean);

    const hasBasePrefix =
      baseSegments.length === 0 || baseSegments.every((segment, index) => allSegments[index] === segment);
    if (!hasBasePrefix) {
      return { contentId: null, view: "portal" };
    }

    const relative = allSegments.slice(baseSegments.length);
    if (relative.length === 0) {
      return { contentId: null, view: "portal" };
    }

    const contentId = relative[0];
    if (!this.contentIds.has(contentId)) {
      return { contentId: null, view: "portal" };
    }

    if (relative.length === 1) {
      return { contentId, view: "home" };
    }

    const maybeView = relative[1];
    if (maybeView === "home" || maybeView === "play" || maybeView === "parent") {
      return { contentId, view: maybeView };
    }

    return { contentId, view: "home" };
  }

  renderView(view: ViewId, options?: { syncUrl?: boolean; contentId?: string | null }): void {
    const syncUrl = options?.syncUrl ?? true;
    const contentId = options?.contentId ?? null;
    this.nodes.portalView.classList.add("hidden");
    this.nodes.homeView.classList.add("hidden");
    this.nodes.playView.classList.add("hidden");
    this.nodes.parentView.classList.add("hidden");

    this.nodes.homeTab.classList.remove("active-tab");
    this.nodes.parentTab.classList.remove("active-tab");

    if (view === "portal") {
      this.nodes.portalView.classList.remove("hidden");
      this.nodes.gameTabs.classList.add("hidden");
      if (syncUrl) {
        const next = this.toPath(null, "portal");
        if (window.location.pathname !== next) window.history.replaceState(null, "", next);
      }
      return;
    }

    this.nodes.gameTabs.classList.remove("hidden");

    if (view === "home") {
      this.nodes.homeView.classList.remove("hidden");
      this.nodes.homeTab.classList.add("active-tab");
      if (syncUrl) {
        const next = this.toPath(contentId, "home");
        if (window.location.pathname !== next) window.history.replaceState(null, "", next);
      }
      return;
    }

    if (view === "play") {
      this.nodes.playView.classList.remove("hidden");
      if (syncUrl) {
        const next = this.toPath(contentId, "play");
        if (window.location.pathname !== next) window.history.replaceState(null, "", next);
      }
      return;
    }

    this.nodes.parentView.classList.remove("hidden");
    this.nodes.parentTab.classList.add("active-tab");
    if (syncUrl) {
      const next = this.toPath(contentId, "parent");
      if (window.location.pathname !== next) window.history.replaceState(null, "", next);
    }
  }
}
