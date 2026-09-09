The settings view needs five answers from the host. The bridge carries a
command one way and events the other; neither is a question with an
answer, so that comes first.

## 1. Asking the host something

- [x] 1.1 A request/response message pair, correlated by an id the
  webview generates, with the reply carrying either a value or an error.
- [x] 1.2 The host answers five named operations and refuses anything
  else. A message names an operation, never a path or a file.
- [x] 1.3 The `cwd` is the host's own workspace root, not a field in the
  message.
- [x] 1.4 A rejected write comes back as an error the form shows, not as
  silence. A settings form that cannot say "this was refused" is the
  defect being fixed.

## 2. The view in the panel

- [x] 2.1 `DashboardContext` carries `showSettings`, in the first render's
  HTML like `runPlan` — it decides which component mounts.
- [x] 2.2 `extension-entry.tsx` mounts `HarnessSettingsView` when it is
  set, with an api built on the request channel.
- [x] 2.3 `Configure Harness` and `Configure Harness for this Change`
  reveal the panel. The per-change one loads that change's override
  without it having to be typed in again.
- [x] 2.4 The seeding both commands do stays: a missing global file gets
  the documented default, a missing per-change file an empty override.
- [x] 2.5 The view names the file it edits, so the person who wants the
  JSON knows where it is.

## 3. Tests

- [x] 3.1 A request is answered and resolves the caller's promise; a
  second request in flight resolves against its own id.
- [x] 3.2 An unknown operation comes back as an error, and nothing is
  read or written.
- [x] 3.3 A failing write comes back as an error rather than as a
  resolved promise.
- [x] 3.4 Both commands reveal the panel with `showSettings`, and seed
  the file when it does not exist.
- [x] 3.5 The per-change command carries the change name.

## 4. Verification

- [x] 4.1 `openspec validate --strict --changes`.
- [x] 4.2 `npm run verify` unpiped, after the last edit, with everything
  staged.
  Run 2026-09-09: exit 0 — 48 cli, 781 core, 302 extension, 68 server,
  322 webui.
- [x] 4.3 Version bump via `npx changeset` for `extension` and `webui`.
- [x] 4.4 `HARNESS.md`: where each setting is edited, in both hosts.
- [ ] 4.5 **Human-only**: in the Extension Development Host, open both
  commands, change an effort and a custom agent, save, and read the file.
  The tests drive a mocked webview; nothing here has seen the real panel.
