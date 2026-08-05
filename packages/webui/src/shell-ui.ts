export function buildDefaultChangeDir(cwd: string): string {
  const trimmed = cwd.trim();
  if (!trimmed) return "";
  const separator = trimmed.includes("\\") ? "\\" : "/";
  const normalized = trimmed.replace(/[\\/]+$/, "");
  return `${normalized}${separator}openspec${separator}changes`;
}

export const shellThemeCss = `
  :root {
    color-scheme: light;
    --bg: #f4f1ea;
    --bg-accent: #eadcc8;
    --surface: #fffef9;
    --surface-2: #f8f3e8;
    --ink: #1d1a16;
    --muted: #6f665b;
    --primary: #1f5d52;
    --primary-ink: #e9fff8;
    --danger: #9d2f2f;
    --line: #d8ccb6;
    --radius: 14px;
    --shadow: 0 16px 40px rgba(29, 26, 22, 0.12);
  }

  body {
    margin: 0;
    font-family: "Segoe UI", "Trebuchet MS", sans-serif;
    color: var(--ink);
    background:
      radial-gradient(circle at 20% 10%, #fff9ef 0%, transparent 45%),
      radial-gradient(circle at 85% 20%, #f5e9d3 0%, transparent 40%),
      linear-gradient(160deg, var(--bg) 0%, var(--bg-accent) 100%);
  }

  .openspec-standalone-app,
  .openspec-extension-app {
    max-width: 980px;
    margin: 22px auto;
    padding: 18px;
    display: grid;
    gap: 14px;
  }

  .openspec-shell-headline {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    padding: 16px 18px;
  }

  .openspec-shell-headline h1 {
    margin: 0 0 6px;
    font-size: 28px;
    letter-spacing: 0.2px;
  }

  .openspec-shell-headline p {
    margin: 0;
    color: var(--muted);
  }

  .openspec-shell-panel {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    padding: 14px;
  }

  .openspec-shell-panel h2 {
    margin: 0 0 10px;
    font-size: 19px;
  }

  .openspec-shell-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 10px;
  }

  .openspec-shell-field {
    display: grid;
    gap: 6px;
    font-size: 13px;
    color: var(--muted);
  }

  .openspec-shell-field input,
  .openspec-ai-panel-controls select,
  .openspec-ai-panel-controls button {
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 10px 12px;
    font: inherit;
    color: var(--ink);
    background: var(--surface-2);
  }

  .openspec-shell-field input:focus,
  .openspec-ai-panel-controls select:focus,
  .openspec-ai-panel-controls button:focus {
    outline: 2px solid color-mix(in srgb, var(--primary) 65%, white 35%);
    outline-offset: 1px;
  }

  .openspec-shell-note {
    margin: 0;
    color: var(--muted);
    font-size: 13px;
  }

  .openspec-ai-panel {
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 10px;
    background: #fffdfa;
  }

  .openspec-ai-panel-banner {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    padding: 10px 12px;
    margin-bottom: 10px;
    border-radius: 10px;
    border: 1px solid color-mix(in srgb, var(--danger) 40%, var(--line) 60%);
    background: #fff3f1;
    color: var(--ink);
    font-size: 13px;
  }

  .openspec-ai-panel-banner a {
    color: var(--danger);
    font-weight: 600;
    text-decoration: none;
  }

  .openspec-ai-panel-banner a:hover {
    text-decoration: underline;
  }

  .openspec-ai-panel-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 10px;
  }

  .openspec-run-insights {
    margin: 0 0 10px;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid color-mix(in srgb, var(--primary) 25%, var(--line) 75%);
    background: #f4fbf8;
    display: grid;
    gap: 8px;
  }

  .openspec-run-insights h3 {
    margin: 0;
    font-size: 14px;
  }

  .openspec-run-insights-meta {
    margin: 0;
    color: var(--muted);
    font-size: 12px;
  }

  .openspec-run-insights-steps,
  .openspec-run-insights-warnings {
    margin: 0;
    padding-left: 18px;
    display: grid;
    gap: 4px;
    font-size: 12px;
  }

  .openspec-run-insights-highlight {
    margin: 0;
    padding: 8px 10px;
    border-radius: 8px;
    background: #fff;
    border: 1px solid var(--line);
    font-size: 12px;
  }

  .openspec-ai-panel-controls button {
    cursor: pointer;
    background: var(--primary);
    color: var(--primary-ink);
    border-color: transparent;
    font-weight: 600;
  }

  .openspec-ai-panel-controls button[data-testid="cancel-button"] {
    background: var(--danger);
  }

  .openspec-ai-panel-controls button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .openspec-ai-panel-events {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 300px;
    overflow: auto;
    display: grid;
    gap: 6px;
  }

  .openspec-event {
    background: var(--surface-2);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 8px 10px;
    font-family: Consolas, "Courier New", monospace;
    font-size: 12px;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .openspec-event pre {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .openspec-status-card {
    display: grid;
    gap: 8px;
    padding: 8px;
    border-radius: 8px;
    border: 1px solid var(--line);
    background: #fff;
  }

  .openspec-status-card-head {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    align-items: baseline;
  }

  .openspec-status-card-meta,
  .openspec-status-card-instruction {
    margin: 0;
    font-size: 11px;
    color: var(--muted);
  }

  .openspec-status-meter {
    height: 7px;
    border-radius: 999px;
    overflow: hidden;
    background: #ece4d4;
  }

  .openspec-status-meter-fill {
    height: 100%;
    background: linear-gradient(90deg, #1f5d52 0%, #3e8c7f 100%);
  }

  .openspec-status-artifacts {
    margin: 0;
    padding-left: 0;
    list-style: none;
    display: grid;
    gap: 6px;
  }

  .openspec-status-artifacts li {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    align-items: center;
  }

  .openspec-status-artifact-id {
    color: var(--ink);
  }

  .openspec-status-pill {
    font-size: 10px;
    letter-spacing: 0.2px;
    padding: 2px 8px;
    border-radius: 999px;
    text-transform: uppercase;
    font-weight: 700;
    background: #efe8d7;
    color: #6f665b;
  }

  .openspec-status-pill.is-done,
  .openspec-status-pill.is-complete {
    background: #dff3ea;
    color: #1f5d52;
  }

  .openspec-status-pill.is-blocked,
  .openspec-status-pill.is-failed {
    background: #fbe3e3;
    color: #9d2f2f;
  }

  .openspec-event-checklist,
  .openspec-event-bullets,
  .openspec-event-steps {
    margin: 0;
    padding-left: 18px;
    display: grid;
    gap: 6px;
  }

  .openspec-event-step {
    display: grid;
    gap: 4px;
  }

  .openspec-event-step-title {
    font-weight: 700;
    color: var(--ink);
  }

  .openspec-event-step-details {
    margin: 0;
    padding-left: 16px;
    color: var(--muted);
    display: grid;
    gap: 2px;
  }

  .openspec-event-checklist li {
    display: flex;
    gap: 8px;
    align-items: baseline;
  }

  .openspec-checkmark {
    border-radius: 999px;
    padding: 1px 7px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    font-weight: 700;
  }

  .openspec-checkmark.is-checked {
    background: #dff3ea;
    color: #1f5d52;
  }

  .openspec-checkmark.is-open {
    background: #f2e8d7;
    color: #705634;
  }

  .openspec-event-kv {
    margin: 0;
    display: grid;
    gap: 6px;
  }

  .openspec-event-kv-row {
    display: grid;
    grid-template-columns: minmax(90px, 180px) 1fr;
    gap: 10px;
  }

  .openspec-event-kv dt {
    color: var(--muted);
  }

  .openspec-event-kv dd {
    margin: 0;
    color: var(--ink);
  }

  .openspec-event--failed,
  .openspec-event--stderr {
    border-color: color-mix(in srgb, var(--danger) 35%, var(--line) 65%);
    background: #fff2f2;
  }

  .openspec-event--completed {
    border-color: color-mix(in srgb, var(--primary) 35%, var(--line) 65%);
    background: #effaf6;
  }

  .openspec-diff {
    border: 1px solid var(--line);
    border-radius: 10px;
    overflow: hidden;
  }

  .openspec-diff-header {
    background: var(--surface-2);
    padding: 8px 10px;
    font-size: 12px;
    color: var(--muted);
    border-bottom: 1px solid var(--line);
  }

  .openspec-diff-body {
    margin: 0;
    padding: 10px;
    background: #fff;
    font-family: Consolas, "Courier New", monospace;
    font-size: 12px;
  }

  .openspec-diff-line--added { color: #15643f; }
  .openspec-diff-line--removed { color: #9c2d2d; }

  .openspec-overview {
    display: grid;
    gap: 12px;
  }

  .openspec-overview-meta {
    margin: 0;
    font-size: 12px;
    color: var(--muted);
  }

  .openspec-overview-block h3 {
    margin: 0 0 8px;
    font-size: 15px;
  }

  .openspec-overview-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    background: #fffdfa;
    border: 1px solid var(--line);
    border-radius: 10px;
    overflow: hidden;
  }

  .openspec-overview-table th,
  .openspec-overview-table td {
    text-align: left;
    padding: 8px 10px;
    border-bottom: 1px solid var(--line);
  }

  .openspec-overview-table thead th {
    background: var(--surface-2);
    color: var(--muted);
    font-weight: 600;
  }

  .openspec-overview-table tbody tr:last-child td {
    border-bottom: none;
  }

  .openspec-overview-error {
    margin: 0;
    color: var(--danger);
    font-size: 12px;
  }

  @media (max-width: 760px) {
    .openspec-shell-grid { grid-template-columns: 1fr; }
    .openspec-standalone-app,
    .openspec-extension-app { margin: 10px auto; padding: 10px; }
  }
`;