import { useEffect, useRef, useState } from "react";
import type { IssuePreview } from "@openspec-ui/core";
import { Icon } from "./Icon.js";

export function IssueChangeForm({ cwd, changeName, apiFetch, onCreate }: {
  cwd: string;
  changeName: string;
  apiFetch: (url: string, init: RequestInit) => Promise<Response>;
  onCreate: (issue: { reference: string; revision: string }) => Promise<void>;
}) {
  const [reference, setReference] = useState("");
  const [preview, setPreview] = useState<IssuePreview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  useEffect(() => { generation.current++; setPreview(null); setError(""); }, [cwd]);
  async function read() {
    const current = ++generation.current;
    setBusy(true); setError(""); setPreview(null);
    try {
      const response = await apiFetch("/api/change-editor/issue-preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cwd, reference }) });
      const payload = await response.json() as IssuePreview & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Issue preview failed.");
      if (current === generation.current) setPreview(payload);
    } catch (caught) {
      if (current === generation.current) setError(caught instanceof Error ? caught.message : String(caught));
    } finally { setBusy(false); }
  }
  return <section className="openspec-panel" aria-label="Change from issue">
    <div className="openspec-panel-head"><h2>From a repository issue</h2></div>
    <div className="openspec-panel-body">
      <label className="openspec-shell-field">Issue number or URL
        <input value={reference} onChange={(event) => { generation.current++; setReference(event.target.value); setPreview(null); setError(""); }} placeholder="123 or repository issue URL" />
      </label>
      <button type="button" className="button icon" aria-label="Show Issue" title="Show Issue" disabled={busy || !cwd || !reference.trim()} onClick={() => { void read(); }}><Icon meaning="review" /></button>
      {error && <p role="alert">{error}</p>}
      {preview && <div>
        <h3>{preview.title}</h3>
        <a href={preview.sourceUrl} target="_blank" rel="noreferrer">{preview.sourceUrl}</a>
        <p>{preview.forge} #{preview.number} - {preview.state} - updated {preview.updatedAt}</p>
        {preview.truncated && <p role="status">Source truncated. Read the original issue for the complete request.</p>}
        <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxHeight: "20rem", overflow: "auto" }}>{preview.body}</pre>
        <p>Confirm to create a change with this source in its own working directory. The existing create workflow may commit and push its branch. This does not approve requirements or start an agent. Use Run Change separately to run Propose.</p>
        <button type="button" className="button" disabled={busy || !/^[a-z0-9][a-z0-9-]*$/.test(changeName)} onClick={() => {
          setBusy(true);
          void onCreate({ reference, revision: preview.revision }).finally(() => setBusy(false));
        }}><Icon meaning="change" />Create Change From Issue</button>
      </div>}
    </div>
  </section>;
}
