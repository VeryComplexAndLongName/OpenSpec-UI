// A change's action in the standalone app, over the Pipeline where its card
// was pressed (ADR 0044, a-change-is-acted-on-from-its-card). The server runs
// the action where the change is worked and answers with what to read, what
// was done, or the relations to pick from; an action that asks first asks
// here. The change's harness opens here in the page.
//
// This file draws and asks; what each action does is the server's and core's.

import { useEffect, useState } from "react";
import { changeAction, JUNIT_XML_MAX_BYTES, PR_REVIEW_EXAMPLE, say, type ChangeActionAnswer, type ChangeActionId, type ChangeActionInput, type JUnitImport } from "@openspec-ui/core/browser";
import { Clipboard, Link2, Upload, Wrench } from "lucide-react";
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
  const [copyStatus, setCopyStatus] = useState("");
  const [checksRequested, setChecksRequested] = useState(false);

  async function copySummary(summary: string, repair = false) {
    setCopyStatus(await copyPrSummary(summary, repair));
  }

  const send = (input?: ChangeActionInput) => {
    setStep({ kind: "busy" });
    perform(target, input).then(
      (answer) => setStep({ kind: "answer", answer }),
      (error: unknown) => setStep({ kind: "failed", message: error instanceof Error ? error.message : String(error) }),
    );
  };

  useEffect(() => {
    setCopyStatus("");
    setChecksRequested(false);
    if (!ASKS_FOR_INPUT.has(target.action) && target.action !== "configureChangeHarness") send();
    // Sent once, for the action the dialog was opened on.
  }, [target.action, target.changeName]);

  return (
    <section className="openspec-shell-panel openspec-change-action" role="dialog" aria-modal="true" aria-label={title} data-testid="change-action-dialog" tabIndex={-1}>
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
      ) : step.answer.kind === "pr-review" ? (
        <PrReview review={step.answer.report} onCopy={copySummary} copyStatus={copyStatus}
          onRefresh={() => {
            setCopyStatus("");
            setChecksRequested(true);
            send({ prReview: { refreshGitHubChecks: true,
              ...(step.answer.kind === "pr-review" && step.answer.report.sinceLastReview ? { sinceLastReview: true } : {}) } });
          }}
          onReviewAction={(selection) => {
            setCopyStatus("");
            send({ prReview: { ...selection, ...(checksRequested ? { refreshGitHubChecks: true } : {}),
              ...(step.answer.kind === "pr-review" && step.answer.report.sinceLastReview && (selection.scenarioMapping || selection.junitImport || selection.junitMapping || selection.prepareCiRepairTask)
                ? { sinceLastReview: true } : {}) } });
          }} />
      ) : step.answer.kind === "done" ? (
        <p data-testid="change-action-done">{step.answer.message}</p>
      ) : (
        <RelationForm answer={step.answer} adding={target.action === "addRelation"} onSend={(relation) => send({ relation })} />
      )}
      <button className="button" type="button" data-testid="change-action-close" onClick={onClose}>Close</button>
    </section>
  );
}

async function copyPrSummary(summary: string, repair = false): Promise<string> {
  try {
    await navigator.clipboard.writeText(summary);
    return say(repair ? "OSW-CHG-017" : "OSW-CHG-008").text;
  } catch {
    return say(repair ? "OSW-CHG-018" : "OSW-CHG-009").text;
  }
}

export function PrReviewExampleDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const [copyStatus, setCopyStatus] = useState("");
  return (
    <section className="openspec-shell-panel openspec-change-action" role="dialog" aria-modal="true" aria-label="PR Review example" tabIndex={-1}>
      <PrReview review={PR_REVIEW_EXAMPLE}
        onCopy={async (summary) => setCopyStatus(await copyPrSummary(summary))} copyStatus={copyStatus} />
      <button className="button" type="button" onClick={onClose}>Close</button>
    </section>
  );
}

function PrReview({ review, onCopy, copyStatus, onRefresh, onReviewAction }: {
  review: Extract<ChangeActionAnswer, { kind: "pr-review" }>["report"];
  onCopy: (summary: string, repair?: boolean) => Promise<void>;
  copyStatus: string;
  onRefresh?: () => void;
  onReviewAction?: (selection: NonNullable<ChangeActionInput["prReview"]>) => void;
}): JSX.Element {
  const head = review.head;
  const preview = review.mappingPreview;
  const junitPreview = review.junitMappingPreview;
  const repair = review.ciRepairTask;
  const [importing, setImporting] = useState(false);
  const [linkingTest, setLinkingTest] = useState(false);
  return (
    <>
      <button className="button primary" type="button" onClick={() => void onCopy(review.summary)}>Copy PR summary</button>
      {onRefresh !== undefined && <button className="button" type="button" onClick={onRefresh}>Refresh PR checks</button>}
      {onReviewAction !== undefined && <button className="button" type="button" title="Prepare CI Repair Task" aria-label="Prepare CI Repair Task"
        onClick={() => onReviewAction({ prepareCiRepairTask: true })}><Wrench size={16} aria-hidden="true" /></button>}
      {repair !== undefined && <button className="button" type="button" title="Copy CI Repair Task" aria-label="Copy CI Repair Task"
        onClick={() => void onCopy(repair, true)}><Clipboard size={16} aria-hidden="true" /></button>}
      {onReviewAction !== undefined && head !== undefined && <button className="button" type="button"
        title="Import JUnit XML" aria-label="Import JUnit XML" aria-expanded={importing} onClick={() => setImporting(!importing)}>
        <Upload size={16} aria-hidden="true" />
      </button>}
      {importing && onReviewAction !== undefined && head !== undefined &&
        <JUnitImportForm head={head} onImport={(junitImport) => onReviewAction({ junitImport })} />}
      {onReviewAction && head && review.junitMappingChoices && !junitPreview &&
        <button className="button" type="button" title="Link scenario to JUnit test" aria-label="Link scenario to JUnit test"
          aria-expanded={linkingTest} onClick={() => setLinkingTest(!linkingTest)}>
          <Link2 size={16} aria-hidden="true" />
        </button>}
      {onReviewAction !== undefined && head !== undefined && head !== review.lastReviewed &&
        <button className="button" type="button" onClick={() => onReviewAction({ markReviewedCommit: head })}>Mark as reviewed</button>}
      {onReviewAction !== undefined && review.lastReviewed !== undefined &&
        <button className="button" type="button" onClick={() => onReviewAction(review.sinceLastReview ? {} : { sinceLastReview: true })}>
          {review.sinceLastReview ? "Show Full PR Diff" : "Show Changes Since Last Review"}
        </button>}
      <span role="status">{copyStatus}</span>
      <div className="openspec-md-preview">{renderMarkdown(review.summary)}</div>
      {repair !== undefined && <details><summary>CI repair task draft</summary><pre aria-label="CI repair task draft"><code>{repair}</code></pre></details>}
      {onReviewAction !== undefined && head !== undefined &&
        (preview ? <section aria-label="Scenario mapping preview">
          <h4>Scenario mapping preview</h4>
          <pre aria-label="Scenario mapping diff"><code>{preview.diff}</code></pre>
          <button className="button primary" type="button" onClick={() => onReviewAction({ scenarioMapping: {
            mode: "save", selection: preview.selection, revision: preview.revision,
          } })}>Save Scenario Mapping</button>
          <button className="button" type="button" onClick={() => onReviewAction(review.sinceLastReview ? { sinceLastReview: true } : {})}>Show PR Review</button>
        </section> : review.mappingChoices && <ScenarioCheckPicker head={head} choices={review.mappingChoices} onReviewAction={onReviewAction} />)}
      {onReviewAction && head && (junitPreview
        ? <section aria-label="JUnit mapping preview">
          <h4>JUnit mapping preview</h4>
          <pre aria-label="JUnit mapping diff"><code>{junitPreview.diff}</code></pre>
          <button className="button primary" type="button" onClick={() => onReviewAction({ junitMapping: {
            mode: "save", selection: junitPreview.selection, revision: junitPreview.revision,
          } })}>Save Test Mapping</button>
          <button className="button" type="button" onClick={() => onReviewAction(review.sinceLastReview ? { sinceLastReview: true } : {})}>Show PR Review</button>
        </section>
        : linkingTest && review.junitMappingChoices && <JUnitTestPicker key={head + review.junitMappingChoices.reportId}
          head={head} choices={review.junitMappingChoices} onReviewAction={onReviewAction} />)}
      {review.diff !== null && (review.diff.length > 0 ? <details className="openspec-md-preview" open><summary>Committed diff</summary>
        <pre aria-label="Committed diff"><code>{review.diff}</code></pre>
      </details> : <p>{review.truncated ? "The patch exceeds the display limit." : "No committed changes in this comparison."}</p>)}
    </>
  );
}

function JUnitTestPicker({ head, choices, onReviewAction }: {
  head: string;
  choices: NonNullable<Extract<ChangeActionAnswer, { kind: "pr-review" }>["report"]["junitMappingChoices"]>;
  onReviewAction: (selection: NonNullable<ChangeActionInput["prReview"]>) => void;
}): JSX.Element {
  const [scenarioIndex, setScenarioIndex] = useState("");
  const [testIndex, setTestIndex] = useState("");
  const [query, setQuery] = useState("");
  const scenario = choices.scenarios[Number.parseInt(scenarioIndex, 10)];
  const test = choices.tests[Number.parseInt(testIndex, 10)];
  const filter = query.trim().toLowerCase();
  return <form aria-label="Link a JUnit test" onSubmit={(event) => {
    event.preventDefault();
    if (scenario && test) onReviewAction({ junitMapping: { mode: "preview", selection: {
      head, reportId: choices.reportId, scenario, test: { classname: test.classname, name: test.name },
    } } });
  }}>
    <p>{choices.testedCommit === head ? "User-declared tested commit" : "Historical report for user-declared commit"} <code>{choices.testedCommit}</code></p>
    <label>OpenSpec scenario
      <select value={scenarioIndex} onChange={(event) => setScenarioIndex(event.currentTarget.value)}>
        <option value="">Select a scenario</option>
        {choices.scenarios.map((entry, index) => <option key={index} value={index}>
          {`${entry.capability} / ${entry.requirement} / ${entry.scenario}`}
        </option>)}
      </select>
    </label>
    <label>Search JUnit tests<input type="search" value={query} onChange={(event) => {
      setQuery(event.currentTarget.value);
      setTestIndex("");
    }} /></label>
    <label>JUnit testcase
      <select value={testIndex} onChange={(event) => setTestIndex(event.currentTarget.value)}>
        <option value="">Select a testcase</option>
        {choices.tests.map((entry, index) => {
          const title = entry.classname ? `${entry.classname} / ${entry.name}` : entry.name;
          return title.toLowerCase().includes(filter)
            ? <option key={index} value={index}>{title} ({entry.state})</option> : null;
        })}
      </select>
    </label>
    <button className="button" type="submit" disabled={!scenario || !test}>Show Test Mapping Preview</button>
  </form>;
}

function JUnitImportForm({ head, onImport }: { head: string; onImport: (value: JUnitImport) => void }): JSX.Element {
  const [file, setFile] = useState<File>();
  const [testedCommit, setTestedCommit] = useState("");
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  return <form aria-label="Import JUnit report" onSubmit={(event) => {
    event.preventDefault();
    if (!file || reading) return;
    if (file.size > JUNIT_XML_MAX_BYTES) { setError(say("OSW-CHG-014").text); return; }
    setReading(true);
    setError("");
    file.text().then((xml) => onImport({ head, testedCommit: testedCommit.trim(), xml }),
      () => { setError(say("OSW-CHG-014").text); setReading(false); });
  }}>
    <label>JUnit XML report (up to 128 KiB)<input type="file" accept=".xml,application/xml,text/xml" required
      onChange={(event) => setFile(event.currentTarget.files?.[0])} /></label>
    <label>Tested commit (user-declared)<input value={testedCommit} required pattern="[a-f0-9]{40}([a-f0-9]{24})?"
      onChange={(event) => setTestedCommit(event.currentTarget.value)} /></label>
    <p>The report does not prove which commit was tested. Enter its full git commit ID; raw XML and test output are not retained.</p>
    <button className="button" type="submit" disabled={!file || reading || !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u.test(testedCommit.trim())}>
      <Upload size={16} aria-hidden="true" /> Import Report
    </button>
    {error && <p role="alert">{error}</p>}
  </form>;
}

function ScenarioCheckPicker({ head, choices, onReviewAction }: {
  head: string;
  choices: NonNullable<Extract<ChangeActionAnswer, { kind: "pr-review" }>["report"]["mappingChoices"]>;
  onReviewAction: (selection: NonNullable<ChangeActionInput["prReview"]>) => void;
}): JSX.Element {
  const [scenarioIndex, setScenarioIndex] = useState("");
  const [check, setCheck] = useState("");
  const scenario = scenarioIndex === "" ? undefined : choices.scenarios[Number(scenarioIndex)];
  return (
    <form aria-label="Link scenario to check" onSubmit={(event) => {
      event.preventDefault();
      if (scenario && choices.checks.includes(check)) onReviewAction({ scenarioMapping: {
        mode: "preview", selection: { head, scenario, check },
      } });
    }}>
      <label>Scenario
        <select value={scenarioIndex} onChange={(event) => setScenarioIndex(event.currentTarget.value)}>
          <option value="">Select a scenario</option>
          {choices.scenarios.map((entry, index) => <option key={index} value={index}>
            {`${entry.capability} / ${entry.requirement} / ${entry.scenario}`}
          </option>)}
        </select>
      </label>
      <label>Reported check
        <select value={check} onChange={(event) => setCheck(event.currentTarget.value)}>
          <option value="">Select a check</option>
          {choices.checks.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </label>
      <button className="button" type="submit" disabled={!scenario || check === ""}>Show Mapping Preview</button>
    </form>
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
