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
  themeWarmButton: HTMLButtonElement;
  themeCoolButton: HTMLButtonElement;
  themeFancyButton: HTMLButtonElement;
  themeCyberButton: HTMLButtonElement;
  homeTab: HTMLButtonElement;
  parentTab: HTMLButtonElement;
  portalView: HTMLElement;
  homeView: HTMLElement;
  kakitoriHome: HTMLElement;
  dotburstHome: HTMLElement;
  dotburstRoot: HTMLElement;
  flashcardHome: HTMLElement;
  flashcardRoot: HTMLElement;
  largerNumberHome: HTMLElement;
  largerNumberRoot: HTMLElement;
  playView: HTMLElement;
  parentView: HTMLElement;
  missionList: HTMLElement;
  backPortalButton: HTMLButtonElement;
  dotburstBackPortalButton: HTMLButtonElement;
  flashcardBackPortalButton: HTMLButtonElement;
  largerNumberBackPortalButton: HTMLButtonElement;
  backHomeButton: HTMLButtonElement;
  playTitle: HTMLElement;
  playLap: HTMLElement;
  playProgressFill: HTMLElement;
  playProgressPips: HTMLElement;
  targetChar: HTMLElement;
  strokeBadge: HTMLElement;
  strokeModel: HTMLElement;
  replayModelButton: HTMLButtonElement;
  doneButton: HTMLButtonElement;
  readCharButton: HTMLButtonElement;
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
  storageSummary: HTMLElement;
  pruneOldHistoryButton: HTMLButtonElement;
  downloadAllImagesButton: HTMLButtonElement;
  downloadAllVideosButton: HTMLButtonElement;
  resetDataButton: HTMLButtonElement;
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
    themeWarmButton: byId<HTMLButtonElement>("btn-theme-warm"),
    themeCoolButton: byId<HTMLButtonElement>("btn-theme-cool"),
    themeFancyButton: byId<HTMLButtonElement>("btn-theme-fancy"),
    themeCyberButton: byId<HTMLButtonElement>("btn-theme-cyber"),
    homeTab: byId<HTMLButtonElement>("tab-home"),
    parentTab: byId<HTMLButtonElement>("tab-parent"),
    portalView: byId<HTMLElement>("view-portal"),
    homeView: byId<HTMLElement>("view-home"),
    kakitoriHome: byId<HTMLElement>("kakitori-home"),
    dotburstHome: byId<HTMLElement>("dotburst-home"),
    dotburstRoot: byId<HTMLElement>("dotburst-root"),
    flashcardHome: byId<HTMLElement>("flashcard-home"),
    flashcardRoot: byId<HTMLElement>("flashcard-root"),
    largerNumberHome: byId<HTMLElement>("larger-number-home"),
    largerNumberRoot: byId<HTMLElement>("larger-number-root"),
    playView: byId<HTMLElement>("view-play"),
    parentView: byId<HTMLElement>("view-parent"),
    missionList: byId<HTMLElement>("mission-list"),
    backPortalButton: byId<HTMLButtonElement>("btn-back-portal"),
    dotburstBackPortalButton: byId<HTMLButtonElement>("btn-dotburst-back-portal"),
    flashcardBackPortalButton: byId<HTMLButtonElement>("btn-flashcard-back-portal"),
    largerNumberBackPortalButton: byId<HTMLButtonElement>("btn-larger-number-back-portal"),
    backHomeButton: byId<HTMLButtonElement>("btn-back-home"),
    playTitle: byId<HTMLElement>("play-title"),
    playLap: byId<HTMLElement>("play-lap"),
    playProgressFill: byId<HTMLElement>("play-progress-fill"),
    playProgressPips: byId<HTMLElement>("play-progress-pips"),
    targetChar: byId<HTMLElement>("target-char"),
    strokeBadge: byId<HTMLElement>("stroke-badge"),
    strokeModel: byId<HTMLElement>("stroke-model"),
    replayModelButton: byId<HTMLButtonElement>("btn-replay-model"),
    doneButton: byId<HTMLButtonElement>("btn-done"),
    readCharButton: byId<HTMLButtonElement>("btn-read-char"),
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
    storageSummary: byId<HTMLElement>("storage-summary"),
    pruneOldHistoryButton: byId<HTMLButtonElement>("btn-prune-old-history"),
    downloadAllImagesButton: byId<HTMLButtonElement>("btn-download-all-images"),
    downloadAllVideosButton: byId<HTMLButtonElement>("btn-download-all-videos"),
    resetDataButton: byId<HTMLButtonElement>("btn-reset-data"),
    historyGrid: byId<HTMLElement>("history-grid"),
    replayOverlay: byId<HTMLElement>("replay-overlay"),
    replayTitle: byId<HTMLElement>("replay-char"),
    replayCanvas: byId<HTMLCanvasElement>("modal-replay-canvas"),
    closeReplayButton: byId<HTMLButtonElement>("btn-close-replay"),
    celebrateStamp: byId<HTMLElement>("celebrate-stamp"),
  };
}
