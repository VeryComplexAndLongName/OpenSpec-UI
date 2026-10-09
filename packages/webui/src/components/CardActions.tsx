// A change's actions, as icons under its name on its card (ADR 0044,
// a-change-is-acted-on-from-its-card). Every action comes from core's one
// list, grouped and coloured by its verb's group (ADR 0045); one that cannot
// run now is drawn dimmed and says why, and a Danger action is confirmed
// before it runs. Where the change is worked decides where the host runs an
// action, never whether the card offers it.
//
// This file draws; the facts and the reasons are core's.

import {
  changeActionStates,
  type ActionGroup,
  type ChangeAction,
  type ChangeActionFacts,
  type ChangeActionId,
  type ChangeActionState,
} from "@openspec-ui/core/browser";
import { Codicon } from "./Codicon.js";

/** What a host does with a card's actions. */
export interface ChangeActionsHost {
  /** The actions this host performs. */
  offered: ReadonlySet<ChangeActionId>;
  /** Runs one on a change. `confirmed`: the person confirmed it on the card,
   * so the host does not ask again. */
  perform: (id: ChangeActionId, changeName: string, options: { confirmed: boolean }) => void;
}

/** The card's own controls do these: Start is Run Change. */
const DRAWN_AS_CONTROLS: ReadonlySet<ChangeActionId> = new Set(["runChange"]);

/** The rows the icons stand in: what runs and what reads, then what sets up
 * and what cannot be taken back. A card is too narrow for one row of all. */
const ROWS: ReadonlyArray<readonly ActionGroup[]> = [
  ["run", "respond", "inspect"],
  ["arrange", "set-up", "danger"],
];

/** The actions a card draws as icons, each with whether it can run now. */
export function cardActionStates(facts: ChangeActionFacts, host: ChangeActionsHost | undefined): ChangeActionState[] {
  if (host === undefined) return [];
  return changeActionStates(facts).filter((state) => host.offered.has(state.action.id) && !DRAWN_AS_CONTROLS.has(state.action.id));
}

/** Those actions in the rows a card draws, leaving out an empty row. */
export function cardActionRows(states: readonly ChangeActionState[]): ChangeActionState[][] {
  return ROWS
    .map((groups) => states.filter((state) => groups.includes(state.action.group)))
    .filter((row) => row.length > 0);
}

function bareTitle(action: ChangeAction): string {
  return action.title.endsWith("...") ? action.title.slice(0, -3) : action.title;
}

export function CardActions({ changeName, states, onChoose, testId }: {
  changeName: string;
  states: readonly ChangeActionState[];
  onChoose: (action: ChangeAction) => void;
  testId: string;
}): JSX.Element | null {
  const rows = cardActionRows(states);
  if (rows.length === 0) return null;
  return (
    <div className="openspec-pipeline-node-actions" role="toolbar" aria-label={`Actions on ${changeName}`} data-testid={`${testId}-actions`}>
      {rows.map((row, index) => (
        <div key={index} className="openspec-pipeline-node-actions-row">
          {groupsOf(row).map(([group, members]) => (
            <span key={group} className="openspec-pipeline-node-actions-group" data-group={group}>
              {members.map((state) => (
                <button
                  key={state.action.id}
                  type="button"
                  className="openspec-pipeline-action"
                  data-group={group}
                  data-testid={`pipeline-action-${state.action.id}-${changeName}`}
                  aria-label={`${bareTitle(state.action)} ${changeName}`}
                  // Not `disabled`: a disabled button shows no tooltip in
                  // every browser, and the tooltip is where it says why.
                  aria-disabled={state.enabled ? undefined : "true"}
                  title={state.enabled ? state.action.title : `${bareTitle(state.action)}: ${state.reason ?? "not now"}`}
                  onClick={() => { if (state.enabled) onChoose(state.action); }}
                >
                  <Codicon name={state.action.icon} />
                </button>
              ))}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function groupsOf(row: readonly ChangeActionState[]): Array<[ActionGroup, ChangeActionState[]]> {
  const groups: Array<[ActionGroup, ChangeActionState[]]> = [];
  for (const state of row) {
    const last = groups[groups.length - 1];
    if (last !== undefined && last[0] === state.action.group) last[1].push(state);
    else groups.push([state.action.group, [state]]);
  }
  return groups;
}

/** Asks before a Danger action runs, naming what it does that cannot be
 * taken back. */
export function ConfirmActionForm({ action, changeName, onConfirm, onCancel }: {
  action: ChangeAction;
  changeName: string;
  onConfirm: () => void;
  onCancel: () => void;
}): JSX.Element {
  const verb = bareTitle(action);
  return (
    <form
      role="dialog"
      aria-modal="true"
      aria-label={`${verb} ${changeName}`}
      className="openspec-pipeline-stop-form"
      data-testid="pipeline-confirm-action"
      onSubmit={(event) => {
        event.preventDefault();
        onConfirm();
      }}
    >
      <p><strong>{`${verb} ${changeName}?`}</strong></p>
      {action.consequence !== undefined ? <p>{action.consequence}</p> : null}
      <div className="openspec-pipeline-stop-form-actions">
        <button type="submit" className="openspec-pipeline-button openspec-pipeline-button--stop" data-testid="pipeline-confirm-action-yes">{verb}</button>
        <button type="button" className="openspec-pipeline-button" data-testid="pipeline-confirm-action-no" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
