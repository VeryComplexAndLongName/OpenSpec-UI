import { useEffect, useState } from "react";
import type { OpenSpecListSpecsResult, OpenSpecLocations } from "@openspec-ui/core";

type Request = (url: string, init: RequestInit) => Promise<Response>;

async function read<T>(request: Request, cwd: string, signal: AbortSignal, store?: string): Promise<T> {
  const response = await request("/api/openspec-locations", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ cwd, store }), signal,
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? "The OpenSpec locations could not be read.");
  }
  return response.json() as Promise<T>;
}

export function OpenSpecLocationsDialog({ cwd, request, onClose }: {
  cwd: string;
  request: Request;
  onClose: () => void;
}): JSX.Element {
  const [locations, setLocations] = useState<OpenSpecLocations>();
  const [overviewError, setOverviewError] = useState("");
  const [selected, setSelected] = useState("");
  const [detail, setDetail] = useState<OpenSpecListSpecsResult>();
  const [detailError, setDetailError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void read<OpenSpecLocations>(request, cwd, controller.signal).then(
      (value) => { if (!controller.signal.aborted) setLocations(value); },
      (error: Error) => { if (!controller.signal.aborted) setOverviewError(error.message); },
    );
    return () => controller.abort();
  }, [request, cwd]);
  useEffect(() => {
    if (selected === "") return;
    const controller = new AbortController();
    void read<OpenSpecListSpecsResult>(request, cwd, controller.signal, selected).then(
      (value) => { if (!controller.signal.aborted) setDetail(value); },
      (error: Error) => { if (!controller.signal.aborted) setDetailError(error.message); },
    );
    return () => controller.abort();
  }, [request, cwd, selected]);
  return (
    <section role="dialog" aria-modal="true" aria-label="OpenSpec Stores and Worksets" className="openspec-shell-panel">
      <h3>OpenSpec Stores and Worksets</h3>
      {overviewError && <p role="alert">{overviewError}</p>}
      {!locations && !overviewError && <p role="status">Reading OpenSpec locations…</p>}
      {locations && <>
        {locations.issues.map((issue) => <p key={issue} role="status">{issue}</p>)}
        <h4>Registered stores</h4>
        {locations.stores.length === 0 ? <p>No registered stores to display.</p> :
          <ul>{locations.stores.map((store) => <li key={store.id}>
            <button type="button" className="button" aria-pressed={selected === store.id} onClick={() => {
              if (selected === store.id) return;
              setDetail(undefined);
              setDetailError("");
              setSelected(store.id);
            }}>{store.id}</button> <code>{store.root}</code>
          </li>)}</ul>}
        {selected && <section aria-label={`Specifications in ${selected}`}>
          <h4>Specifications in {selected}</h4>
          {detailError ? <p role="alert">{detailError}</p> : detail === undefined ? <p role="status">Reading specifications…</p>
            : detail.specs.length === 0 ? <p>This store has no specifications.</p>
              : <ul>{detail.specs.map((spec) => <li key={spec.id}>{spec.id} ({spec.requirementCount} requirements)</li>)}</ul>}
        </section>}
        <h4>Saved worksets</h4>
        {locations.worksets.length === 0 ? <p>No saved worksets to display.</p> :
          <ul>{locations.worksets.map((workset) => <li key={workset.name}>{workset.name}
            <ul>{workset.members.map((member) => <li key={member.path}>{member.name} <code>{member.path}</code></li>)}</ul>
          </li>)}</ul>}
      </>}
      <button className="button" type="button" onClick={onClose}>Close</button>
    </section>
  );
}
