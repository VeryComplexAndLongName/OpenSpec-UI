import { createRoot } from "react-dom/client";
import { ComplianceApp } from "./components/ComplianceApp.js";
import type { ComplianceApi } from "./components/ComplianceView.js";
import type { ComplianceReading } from "@openspec-ui/core/browser";

declare function acquireVsCodeApi(): { postMessage: (value: unknown) => void };
const bridge = acquireVsCodeApi();
const pending = new Map<string, { resolve: (reading: ComplianceReading) => void; reject: (error: Error) => void }>();
window.addEventListener("message", event => {
  const message = event.data;
  if (message?.type !== "compliance-result") return;
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  if (message.error) request.reject(new Error(message.error)); else request.resolve(message.reading);
});
const api: ComplianceApi = request => new Promise((resolve, reject) => {
  const id = crypto.randomUUID(); pending.set(id, { resolve, reject });
  bridge.postMessage({ type: "compliance", id, request });
});
const root = document.getElementById("root");
if (!root) throw new Error("Compliance root is missing");
createRoot(root).render(<ComplianceApp api={api} />);