import { createContext, useContext, useState } from "react";
import { formatFeedbackDiagnostics, WORKBENCH_ISSUE_DRAFT, type FeedbackFacts } from "@openspec-ui/core/browser";

export const FeedbackFactsContext = createContext<FeedbackFacts>({});

export function FeedbackLink(): JSX.Element {
  return <a href={WORKBENCH_ISSUE_DRAFT} target="_blank" rel="noopener noreferrer">Send Feedback</a>;
}

export function SendFeedback({ cause }: { cause: FeedbackFacts["cause"] }): JSX.Element {
  const facts = useContext(FeedbackFactsContext);
  const report = formatFeedbackDiagnostics({ ...facts, ...(cause === undefined ? {} : { cause }) });
  const [status, setStatus] = useState("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(report);
      setStatus("Diagnostics copied.");
    } catch {
      setStatus("Could not copy diagnostics. Select the preview to copy it manually.");
    }
  }

  return (
    <details>
      <summary>Preview diagnostics</summary>
      <pre aria-label="Diagnostic preview">{report}</pre>
      <button type="button" className="button" onClick={() => void copy()}>Copy diagnostics</button>{" "}
      <FeedbackLink />
      <p role="status">{status}</p>
    </details>
  );
}
