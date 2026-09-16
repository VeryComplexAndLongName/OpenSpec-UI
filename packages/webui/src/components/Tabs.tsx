// Page-level tab shell for the standalone browser shell (see
// openspec/changes/standalone-shell-host-aware-tabs/design.md, "Tab shell:
// small hand-rolled component, no new dependency"). By default `TabPanel`
// keeps its children mounted while inactive (native `hidden` attribute,
// not conditional rendering) so switching tabs never discards in-progress
// state such as an unsaved Change Editor draft or a live Run a Command
// event stream. Callers control which tabs even exist by only rendering
// the `TabPanel`s for the currently allowed tab set.
//
// The opt-in `lazy` prop (see
// openspec/changes/lazy-mount-standalone-tabs/design.md) defers a panel's
// first mount until it has been the active tab at least once — after
// that, it behaves exactly like the default (stays mounted, just hidden)
// for the rest of the session, so the state-preservation guarantee above
// still holds once a lazy tab has been opened.

import { useEffect, useState, type ReactNode } from "react";

export interface TabDefinition {
  id: string;
  /** The tab's full name, which stays its accessible name. */
  label: string;
  /** What the tab row shows, so all nine fit one row
   * (the-shell-wears-the-site-frame). A leading or whole word of `label`, so
   * the visible label stays part of the name (WCAG 2.5.3). */
  short?: string;
}

export interface TabsProps {
  tabs: readonly TabDefinition[];
  activeTab: string;
  onSelect: (id: string) => void;
  /** Tabs with a reading outstanding. Each draws a small spinner after its
   * label, whichever tab is open, so a tab left while it reads still shows
   * it is busy (a-screen-says-what-it-is-doing). The spinner is hidden from
   * assistive technology and does not change the tab's name. */
  busy?: ReadonlySet<string>;
}

export function Tabs({ tabs, activeTab, onSelect, busy }: TabsProps) {
  return (
    <div className="openspec-page-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === activeTab}
          data-testid={`page-tab-${tab.id}`}
          aria-label={tab.short !== undefined ? tab.label : undefined}
          className={tab.id === activeTab ? "is-active" : ""}
          onClick={() => onSelect(tab.id)}
        >
          {tab.short ?? tab.label}
          {busy?.has(tab.id)
            ? <span className="openspec-tab-spinner" aria-hidden="true" data-testid={`page-tab-spinner-${tab.id}`} />
            : null}
        </button>
      ))}
    </div>
  );
}

export interface TabPanelProps {
  id: string;
  activeTab: string;
  /** When true, defers rendering `children` until this panel has been
   * the active tab at least once — then behaves exactly like the
   * default (stays mounted, just hidden) for the rest of the session.
   * Only changes *when* the first mount happens; never causes an
   * unmount afterward. Defaults to `false` (today's always-mounted
   * behavior), so existing callers are unaffected. */
  lazy?: boolean;
  children: ReactNode;
}

export function TabPanel({ id, activeTab, lazy = false, children }: TabPanelProps) {
  const isActive = id === activeTab;
  const [hasBeenActive, setHasBeenActive] = useState(isActive);

  useEffect(() => {
    if (isActive) setHasBeenActive(true);
  }, [isActive]);

  return (
    <div
      className="openspec-page-tab-panel"
      role="tabpanel"
      data-testid={`page-tab-panel-${id}`}
      hidden={!isActive}
    >
      {!lazy || hasBeenActive ? children : null}
    </div>
  );
}
