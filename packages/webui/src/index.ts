// Точка входа @openspec-ui/webui — транспорт-агностичные React-компоненты,
// переиспользуемые и в standalone (браузер), и в VS Code extension (Webview).
// См. openspec/changes/shared-ui/design.md за архитектурными решениями.

export type { Transport, Unsubscribe } from "./transport/types.js";
export { FetchTransport, type FetchTransportOptions } from "./transport/fetch-transport.js";
export {
  MessageBridgeTransport,
  type MessageBridgeTransportOptions,
  type VsCodeApiLike,
} from "./transport/message-bridge-transport.js";

export type { ChangeSummary, TaskItem } from "./types.js";
export { renderInlineMarkdown } from "./markdown.js";

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

export { AgentPicker, type AgentPickerProps } from "./components/AgentPicker.js";
export { AiPanel, type AiPanelProps } from "./components/AiPanel.js";
