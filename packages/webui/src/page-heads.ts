// What the page head says for each tab of the standalone shell
// (the-shell-wears-the-site-frame, ADR 0033). The head above the tab row
// names the open tab in the page's one level-one heading, under a tagline,
// with the sentence that used to sit under each tab panel's own heading.
// Data, so a test can hold it against `ALL_TABS` and no tab opens headless.

import type { IconMeaning } from "./icons.js";

export interface PageHeadContent {
  /** A word or two above the title, in the link colour, beside an icon. */
  tagline: string;
  icon: IconMeaning;
  /** The tab's full name, as its heading. */
  title: string;
  /** What the tab is for. */
  sentence: string;
}

export const PAGE_HEADS: Readonly<Record<string, PageHeadContent>> = {
  "run-a-command": {
    tagline: "Agents",
    icon: "run",
    title: "Run a command",
    sentence: "Run an OpenSpec command or an agent against a change, and follow what it does as it streams.",
  },
  processes: {
    tagline: "Recovery",
    icon: "refresh",
    title: "Processes and recovery",
    sentence: "Review persisted runs, checkpoint coverage, rollback conflicts, and retained history.",
  },
  "diff-preview": {
    tagline: "Uncommitted work",
    icon: "change",
    title: "Diff preview",
    sentence: "What a change has changed and not yet committed, as git reports it.",
  },
  overview: {
    tagline: "Workspace",
    icon: "task",
    title: "OpenSpec view summary",
    sentence: "A parsed, visual summary of the repository's state, and a readable companion to the terminal's openspec view.",
  },
  "change-editor": {
    tagline: "Changes",
    icon: "spec",
    title: "Change Editor",
    sentence: "Create and edit a change's markdown artifacts before implementation.",
  },
  templates: {
    tagline: "Catalog",
    icon: "archive",
    title: "Templates",
    sentence:
      "Built-in and project-level (openspec/templates/) starting points for new changes. Customize forks a built-in template into your project, keeping a backlink to the version it came from.",
  },
  timeline: {
    tagline: "History",
    icon: "timeline",
    title: "Timeline",
    sentence: "A change's proposal, design, specs and tasks, placed by when git shows each was done.",
  },
  pipeline: {
    tagline: "Parallel work",
    icon: "run",
    title: "Pipeline",
    sentence:
      "Every active change in the order it declares, what is running right now, and what can be started alongside what. The same report openspec-ui-cli ready prints.",
  },
  "harness-settings": {
    tagline: "Agentic Harness",
    icon: "agent",
    title: "Harness Settings",
    sentence: "The global defaults every change starts from: which agent runs each stage, and how autonomously a chain runs.",
  },
};
