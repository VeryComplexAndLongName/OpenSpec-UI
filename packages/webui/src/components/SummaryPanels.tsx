// The two panels side by side under the summary's changes, as ADR 0033's
// mockup draws them (the-summary-looks-like-the-mockup): the specs with the
// most requirements, and the most recently archived changes. Each opens to its
// full list, so nothing the summary listed before is gone.

import { useState } from "react";
import type { ChangeSummary } from "../types.js";
import { formatDay, type RecentlyArchived, type SummarySpec } from "../summary-figures.js";
import { ArchiveList } from "./ArchiveList.js";

export function SpecsPanel({ top, all }: { top: readonly SummarySpec[]; all: readonly SummarySpec[] }) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? [...all].sort((left, right) => left.id.localeCompare(right.id)) : top;
  return (
    <section className="openspec-panel" data-testid="summary-specs">
      <div className="openspec-panel-head">
        <h2>Specs</h2>
        <span className="openspec-panel-head-note">{showAll ? "by name" : "by requirements"}</span>
      </div>
      {all.length === 0 ? (
        <p className="openspec-panel-body openspec-panel-empty">No specs yet.</p>
      ) : (
        <table className="openspec-table">
          <thead>
            <tr><th>Capability</th><th className="openspec-cell-number">Requirements</th></tr>
          </thead>
          <tbody>
            {shown.map((spec) => (
              <tr key={spec.id}>
                <td>{spec.id}</td>
                <td className="openspec-cell-number">{spec.requirementCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {all.length > top.length ? (
        <p className="openspec-panel-fine">
          <button type="button" className="openspec-link-button" data-testid="summary-specs-all" onClick={() => setShowAll(!showAll)}>
            {showAll ? `The ${top.length} with the most requirements` : `All ${all.length} specs`}
          </button>
        </p>
      ) : null}
    </section>
  );
}

export function RecentlyArchivedPanel({ recent, all }: { recent: readonly RecentlyArchived[]; all: readonly ChangeSummary[] }) {
  const [showAll, setShowAll] = useState(false);
  return (
    <section className="openspec-panel" data-testid="summary-archived">
      <div className="openspec-panel-head">
        <h2>Recently archived</h2>
        <span className="openspec-panel-head-note">{`${all.length} in all`}</span>
      </div>
      {all.length === 0 ? (
        <p className="openspec-panel-body openspec-panel-empty">Nothing archived yet.</p>
      ) : showAll ? (
        <ArchiveList changes={[...all]} />
      ) : (
        <table className="openspec-table">
          <thead>
            <tr><th>Change</th><th className="openspec-cell-number">Tasks</th><th className="openspec-cell-number">Archived</th></tr>
          </thead>
          <tbody>
            {recent.map((change) => (
              <tr key={change.name} data-testid={`summary-archived-${change.name}`}>
                <td>{change.title}</td>
                <td className="openspec-cell-number">{`${change.completedTasks} / ${change.totalTasks}`}</td>
                <td className="openspec-cell-number openspec-cell-muted"><time dateTime={change.day}>{formatDay(change.day)}</time></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {all.length > recent.length ? (
        <p className="openspec-panel-fine">
          <button type="button" className="openspec-link-button" data-testid="summary-archived-all" onClick={() => setShowAll(!showAll)}>
            {showAll ? `The ${recent.length} most recent` : "All archived changes"}
          </button>
        </p>
      ) : null}
    </section>
  );
}
