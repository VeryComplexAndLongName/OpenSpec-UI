// Page-level tab shell for the standalone browser shell (see
// openspec/changes/standalone-shell-host-aware-tabs/design.md, "Tab shell:
// small hand-rolled component, no new dependency"). `TabPanel` keeps its
// children mounted while inactive (native `hidden` attribute, not
// conditional rendering) so switching tabs never discards in-progress
// state such as an unsaved Change Editor draft or a live Run a Command
// event stream. Callers control which tabs even exist by only rendering
// the `TabPanel`s for the currently allowed tab set.

import type { ReactNode } from "react";

export interface TabDefinition {
  id: string;
  label: string;
}

export interface TabsProps {
  tabs: readonly TabDefinition[];
  activeTab: string;
  onSelect: (id: string) => void;
}

export function Tabs({ tabs, activeTab, onSelect }: TabsProps) {
  return (
    <div className="openspec-page-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === activeTab}
          data-testid={`page-tab-${tab.id}`}
          className={tab.id === activeTab ? "is-active" : ""}
          onClick={() => onSelect(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export interface TabPanelProps {
  id: string;
  activeTab: string;
  children: ReactNode;
}

export function TabPanel({ id, activeTab, children }: TabPanelProps) {
  return (
    <div
      className="openspec-page-tab-panel"
      role="tabpanel"
      data-testid={`page-tab-panel-${id}`}
      hidden={id !== activeTab}
    >
      {children}
    </div>
  );
}
