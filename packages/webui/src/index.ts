// Entry point for @openspec-ui/webui — transport-agnostic React
// components, reused by both standalone (browser) and the VS Code
// extension (Webview). See openspec/changes/shared-ui/design.md for the
// architectural decisions.

export type { Transport, Unsubscribe } from "./transport/types.js";
export { FetchTransport, type FetchTransportOptions } from "./transport/fetch-transport.js";
export {
  MessageBridgeTransport,
  type MessageBridgeTransportOptions,
  type VsCodeApiLike,
} from "./transport/message-bridge-transport.js";

export type { ChangeSummary, TaskItem } from "./types.js";
export { renderInlineMarkdown, renderMarkdown } from "./markdown.js";

export { ChangesList, type ChangesListProps } from "./components/ChangesList.js";
export { ChangeDiff, type ChangeDiffProps } from "./components/ChangeDiff.js";
export { ArchiveList, type ArchiveListProps } from "./components/ArchiveList.js";
export {
  ChangeRelations,
  findRelatedChangeNames,
  type ChangeRelationsProps,
} from "./components/ChangeRelations.js";

export { SpecsTree, type SpecSummary, type SpecsTreeProps } from "./components/SpecsTree.js";
export {
  RequirementView,
  extractCapabilityMentions,
  type RequirementViewProps,
} from "./components/RequirementView.js";
export {
  SpecsSearch,
  searchSpecs,
  type SpecsSearchProps,
  type SpecsSearchResult,
} from "./components/SpecsSearch.js";

export { TasksChecklist, type TasksChecklistProps } from "./components/TasksChecklist.js";
export { Tabs, TabPanel, type TabDefinition, type TabsProps, type TabPanelProps } from "./components/Tabs.js";

export { AiPanel, type AiPanelProps } from "./components/AiPanel.js";
