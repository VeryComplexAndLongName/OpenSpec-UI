// Which tab of the standalone shell is reading, and what it would say
// (a-screen-says-what-it-is-doing). One pure function, so the rule can be
// checked by a table test rather than only by opening the shell: a tab that
// read without saying so stood blank for a minute, and a person could not
// tell a slow screen from a broken one.
//
// The sentence goes to `PanelStatus`, a non-null sentence also disables the
// tab's controls through `BusyFieldset`, and the tab row draws a spinner on
// every tab that has one.

export type ShellTabId =
  | "run-a-command"
  | "processes"
  | "diff-preview"
  | "overview"
  | "change-editor"
  | "templates"
  | "timeline"
  | "pipeline"
  | "harness-settings";

export interface ShellReadingState {
  /** The workspace overview is being read. */
  overviewLoading: boolean;
  /** An overview has returned at least once. */
  overviewRead: boolean;
  diffLoading: boolean;
  diffChangeName: string;
  editorLoading: boolean;
  editorChangeName: string;
  templatesLoading: boolean;
  timelineLoading: boolean;
  /** `active:<name>` or `archived:<name>`, as the Timeline's picker holds it. */
  timelineSelection: string;
  comparisonLoading: boolean;
  comparisonCount: number;
  sprintReportLoading: boolean;
  /** What the three views that keep their loading state inside report. */
  processesReading: string | null;
  harnessReading: string | null;
  pipelineReading: string | null;
}

export const OVERVIEW_READING = "Reading the workspace's changes and specs…";

export function tabReadings(state: ShellReadingState): Record<ShellTabId, string | null> {
  // Diff Preview, the Change Editor and the Timeline offer the changes the
  // overview lists; until it has returned once their pickers are empty for
  // exactly that reason.
  const waitingForChanges = state.overviewLoading && !state.overviewRead ? OVERVIEW_READING : null;
  const timelineChange = state.timelineSelection.split(":").slice(1).join(":");

  return {
    // A run in flight is not a reading, and its Cancel has to stay usable.
    "run-a-command": null,
    processes: state.processesReading,
    "diff-preview": state.diffLoading && state.diffChangeName.length > 0
      ? `Reading the diff of ${state.diffChangeName} from git…`
      : waitingForChanges,
    overview: state.overviewLoading ? OVERVIEW_READING : null,
    "change-editor": state.editorLoading && state.editorChangeName.length > 0
      ? `Reading ${state.editorChangeName}…`
      : waitingForChanges,
    templates: state.templatesLoading ? "Reading the template catalog…" : null,
    timeline: state.timelineLoading && timelineChange.length > 0
      ? `Reading ${timelineChange}'s history from git…`
      : state.comparisonLoading
        ? `Reading the history of ${state.comparisonCount} ${state.comparisonCount === 1 ? "change" : "changes"} from git…`
        : state.sprintReportLoading
          ? "Building the sprint report from git…"
          : waitingForChanges,
    pipeline: state.pipelineReading,
    "harness-settings": state.harnessReading,
  };
}

/** The tabs with a reading outstanding, for the tab row's spinners. */
export function busyTabs(readings: Record<ShellTabId, string | null>): ReadonlySet<string> {
  return new Set(Object.entries(readings).filter(([, reading]) => reading !== null).map(([tab]) => tab));
}
