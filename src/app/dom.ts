function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing required element: ${id}`);
  }
  return element as T;
}

export interface AppDom {
  gameTabs: HTMLElement;
  contentList: HTMLElement;
  homeTab: HTMLButtonElement;
  parentTab: HTMLButtonElement;
  portalView: HTMLElement;
  homeView: HTMLElement;
  playView: HTMLElement;
  parentView: HTMLElement;
  missionList: HTMLElement;
  backPortalButton: HTMLButtonElement;
  backHomeButton: HTMLButtonElement;
  playTitle: HTMLElement;
  playLap: HTMLElement;
  targetChar: HTMLElement;
  strokeBadge: HTMLElement;
  doneButton: HTMLButtonElement;
  clearButton: HTMLButtonElement;
  guideCanvas: HTMLCanvasElement;
  drawCanvas: HTMLCanvasElement;
  parentInput: HTMLInputElement;
  parentCountInput: HTMLInputElement;
  addMissionButton: HTMLButtonElement;
  addError: HTMLElement;
  calendarLabel: HTMLElement;
  calendarGrid: HTMLElement;
  calendarLogDate: HTMLElement;
  calendarLogList: HTMLElement;
  calendarPrevButton: HTMLButtonElement;
  calendarNextButton: HTMLButtonElement;
  historyGrid: HTMLElement;
  replayOverlay: HTMLElement;
  replayTitle: HTMLElement;
  replayCanvas: HTMLCanvasElement;
  closeReplayButton: HTMLButtonElement;
  celebrateStamp: HTMLElement;
}

export function getDom(): AppDom {
  return {
    gameTabs: byId<HTMLElement>("game-tabs"),
    contentList: byId<HTMLElement>("content-list"),
    homeTab: byId<HTMLButtonElement>("tab-home"),
    parentTab: byId<HTMLButtonElement>("tab-parent"),
    portalView: byId<HTMLElement>("view-portal"),
    homeView: byId<HTMLElement>("view-home"),
    playView: byId<HTMLElement>("view-play"),
    parentView: byId<HTMLElement>("view-parent"),
    missionList: byId<HTMLElement>("mission-list"),
    backPortalButton: byId<HTMLButtonElement>("btn-back-portal"),
    backHomeButton: byId<HTMLButtonElement>("btn-back-home"),
    playTitle: byId<HTMLElement>("play-title"),
    playLap: byId<HTMLElement>("play-lap"),
    targetChar: byId<HTMLElement>("target-char"),
    strokeBadge: byId<HTMLElement>("stroke-badge"),
    doneButton: byId<HTMLButtonElement>("btn-done"),
    clearButton: byId<HTMLButtonElement>("btn-clear"),
    guideCanvas: byId<HTMLCanvasElement>("guide-canvas"),
    drawCanvas: byId<HTMLCanvasElement>("draw-canvas"),
    parentInput: byId<HTMLInputElement>("p-word"),
    parentCountInput: byId<HTMLInputElement>("p-count"),
    addMissionButton: byId<HTMLButtonElement>("btn-add-mission"),
    addError: byId<HTMLElement>("add-error"),
    calendarLabel: byId<HTMLElement>("calendar-label"),
    calendarGrid: byId<HTMLElement>("calendar-grid"),
    calendarLogDate: byId<HTMLElement>("calendar-selected-date"),
    calendarLogList: byId<HTMLElement>("calendar-log-list"),
    calendarPrevButton: byId<HTMLButtonElement>("btn-calendar-prev"),
    calendarNextButton: byId<HTMLButtonElement>("btn-calendar-next"),
    historyGrid: byId<HTMLElement>("history-grid"),
    replayOverlay: byId<HTMLElement>("replay-overlay"),
    replayTitle: byId<HTMLElement>("replay-char"),
    replayCanvas: byId<HTMLCanvasElement>("modal-replay-canvas"),
    closeReplayButton: byId<HTMLButtonElement>("btn-close-replay"),
    celebrateStamp: byId<HTMLElement>("celebrate-stamp"),
  };
}
