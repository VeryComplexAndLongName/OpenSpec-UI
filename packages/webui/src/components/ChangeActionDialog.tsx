// A change's action in the standalone app, over the Pipeline where its card
// was pressed (ADR 0044, a-change-is-acted-on-from-its-card). The server runs
// the action where the change is worked and answers with what to read, what
// was done, or the relations to pick from; an action that asks first asks
// here. The change's harness opens here in the page.
//
// This file draws and asks; what each action does is the server's and core's.

import { useEffect, useState } from "react";
import { changeAction, type ChangeActionAnswer, type ChangeActionId, type ChangeActionInput } from "@openspec-ui/core/browser";
import { renderMarkdown } from "../markdown.js";
import { ChangeHarnessSettingsView } from "./ChangeHarnessSettingsView.js";
import type { HarnessSettingsApi } from "./harness-settings-parts.js";

export interface ChangeActionTarget {
  action: ChangeActionId;
  changeName: string;
}

/** Posts one action to the host, with what the person gave it. */
export type PerformChangeAction = (target: ChangeActionTarget, input?: ChangeActionInput) => Promise<ChangeActionAnswer>;

/** The actions that ask before anything is sent. */
const ASKS_FOR_INPUT: ReadonlySet<ChangeActionId> = new Set(["sendMessage", "stopRun"]);

type Step =
  | { kind: "busy" }
  | { kind: "answer"; answer: ChangeActionAnswer }
  | { kind: "failed"; message: string }
  | { kind: "asking" };

export function ChangeActionDialog({ target, perform, harnessApi, onClose }: {
  target: ChangeActionTarget;
  perform: PerformChangeAction;
  harnessApi?: HarnessSettingsApi;
  onClose: () => void;
}): JSX.Element {
  const action = changeAction(target.action);
  const title = `${(action?.title ?? target.action).replace(/\.\.\.$/u, "")} ${target.changeName}`;
  const [step, setStep] = useState<Step>(() => (ASKS_FOR_INPUT.has(target.action) || target.action === "configureChangeHarness" ? { kind: "asking" } : { kind: "busy" }));

  const send = (input?: ChangeActionInput) => {
    setStep({ kind: "busy" });
    perform(target, input).then(
      (answer) => setStep({ kind: "answer", answer }),
      (error: unknown) => setStep({ kind: "failed", message: error instanceof Error ? error.message : String(error) }),
    );
  };

  useEffect(() => {
    if (!ASKS_FOR_INPUT.has(target.action) && target.action !== "configureChangeHarness") send();
    // Sent once, for the action the dialog was opened on.
  }, [target.action, target.changeName]);

  return (
    <section className="openspec-shell-panel openspec-change-action" role="dialog" aria-label={title} data-testid="change-action-dialog" tabIndex={-1}>
      <h3>{title}</h3>
      {target.action === "configureChangeHarness" ? (
        harnessApi !== undefined
          ? <ChangeHarnessSettingsView api={harnessApi} changeName={target.changeName} />
          : <p className="openspec-shell-note">The harness settings cannot be read here.</p>
      ) : step.kind === "busy" ? (
        <p className="openspec-shell-note" data-testid="change-action-busy">Working…</p>
      ) : step.kind === "failed" ? (
        <p className="openspec-shell-note" role="alert" data-testid="change-action-failed">{step.message}</p>
      ) : step.kind === "asking" ? (
        target.action === "sendMessage" ? <MessageForm onSend={(message) => send({ message })} /> : <StopForm onSend={(stop) => send({ stop })} />
      ) : step.answer.kind === "report" ? (
        <div className="openspec-md-preview" data-testid="change-action-report">{renderMarkdown(step.answer.markdown)}</div>
      ) : step.answer.kind === "done" ? (
        <p data-testid="change-action-done">{step.answer.message}</p>
      ) : (
        <RelationForm answer={step.answer} adding={target.action === "addRelation"} onSend={(relation) => send({ relation })} />
      )}
      <button className="button" type="button" data-testid="change-action-close" onClick={onClose}>Close</button>
    </section>
  );
}

function RelationForm({ answer, adding, onSend }: {
  answer: Extract<ChangeActionAnswer, { kind: "relations" }>;
  adding: boolean;
  onSend: (relation: { key: string; id: string }) => void;
}): JSX.Element {
  const [key, setKey] = useState<string>(answer.keys[0] ?? "follows");
  const [id, setId] = useState<string>(answer.changes[0] ?? "");
  const [stated, setStated] = useState<number>(0);
  if (!adding) {
    if (answer.stated.length === 0) return <p data-testid="change-action-done">This change states no relation.</p>;
    return (
      <form data-testid="change-action-relation" onSubmit={(event) => { event.preventDefault(); const chosen = answer.stated[stated]; if (chosen) onSend(chosen); }}>
        <label>
          Relation
          <select value={stated} onChange={(event) => setStated(Number(event.currentTarget.value))}>
            {answer.stated.map((relation, index) => <option key={`${relation.key} ${relation.id}`} value={index}>{`${relation.key} ${relation.id}`}</option>)}
          </select>
        </label>
        <button type="submit" className="button primary">Remove Relation</button>
      </form>
    );
  }
  return (
    <form data-testid="change-action-relation" onSubmit={(event) => { event.preventDefault(); if (id.length > 0) onSend({ key, id }); }}>
      <label>
        Relation
        <select value={key} onChange={(event) => setKey(event.currentTarget.value)}>
          {answer.keys.map((one) => <option key={one} value={one}>{one}</option>)}
        </select>
      </label>
      <label>
        Change
        <select value={id} onChange={(event) => setId(event.currentTarget.value)}>
          {answer.changes.map((one) => <option key={one} value={one}>{one}</option>)}
        </select>
      </label>
      <button type="submit" className="button primary" disabled={id.length === 0}>Add Relation</button>
    </form>
  );
}

function MessageForm({ onSend }: { onSend: (message: { kind: "note" | "ask"; words: string }) => void }): JSX.Element {
  const [kind, setKind] = useState<"note" | "ask">("note");
  const [words, setWords] = useState("");
  return (
    <form data-testid="change-action-message" onSubmit={(event) => { event.preventDefault(); if (words.trim().length > 0) onSend({ kind, words }); }}>
      <label>
        <input type="radio" name="message-kind" checked={kind === "note"} onChange={() => setKind("note")} />
        Note: words to take into account; no reply
      </label>
      <label>
        <input type="radio" name="message-kind" checked={kind === "ask"} onChange={() => setKind("ask")} />
        Question: answered by what the next stage says
      </label>
      <textarea aria-label="What to say" rows={3} value={words} onChange={(event) => { const value = event.currentTarget.value; setWords(value); }} />
      <button type="submit" className="button primary" disabled={words.trim().length === 0}>Send Message</button>
    </form>
  );
}

function StopForm({ onSend }: { onSend: (stop: { afterTask?: string; reason: string }) => void }): JSX.Element {
  const [afterTask, setAfterTask] = useState("");
  const [reason, setReason] = useState("");
  return (
    <form data-testid="change-action-stop" onSubmit={(event) => { event.preventDefault(); if (reason.trim().length > 0) onSend({ ...(afterTask.trim().length > 0 ? { afterTask: afterTask.trim() } : {}), reason }); }}>
      <label>
        After task (optional)
        <input type="text" placeholder="4.6" value={afterTask} onChange={(event) => { const value = event.currentTarget.value; setAfterTask(value); }} />
      </label>
      <label>
        Why
        <input type="text" placeholder="only up to 4.6" value={reason} onChange={(event) => { const value = event.currentTarget.value; setReason(value); }} />
      </label>
      <button type="submit" className="button alert" disabled={reason.trim().length === 0}>Stop Run</button>
    </form>
  );
}
