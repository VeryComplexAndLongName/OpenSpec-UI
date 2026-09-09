The figures exist and nothing shows them. The standalone shell genuinely
cannot reach them — they come from the audit log and from which changes
exist, and the browser reads neither — so this adds the route that was
twice declined, now that the figures are the point rather than an
ornament.

## 1. Serving them

- [x] 1.1 A route that takes a `cwd` and returns
  `buildWorkspaceRunStats` over that workspace's audit entries and its
  changes. Same shape as the harness-config routes beside it, including
  the cwd authorization every one of them performs.
- [x] 1.2 Entries come from `FileAuditLog.readEntries`, which already
  skips a torn line rather than failing. A workspace with no audit file
  yields no entries, not an error.
- [x] 1.3 The active and archived change names come from the directory
  listing, with the archive's date prefix stripped — the same shape
  `buildWorkspaceRunStats` documents.
- [x] 1.4 A client for it, beside the other clients, so the entry file
  stays wiring rather than logic.

## 2. Showing them

- [x] 2.1 A group per agent: runs, how many completed, median and p90
  cost and duration, and how many runs reported a cost.
- [x] 2.2 An agent that reported no cost says so, rather than showing a
  cost of zero. Six of the ten agents report nothing.
- [x] 2.3 A group below the threshold is marked as such, with what it has
  and what it needs.
- [x] 2.4 Where nothing has been recorded, say that and how many entries
  were read. A box that looks the same before and after a run tells a
  reader nothing about whether it works.
- [x] 2.5 The per-effort grouping is shown when it has anything, and its
  absence is explained when it does not — it will be empty for a while,
  since the effort field is two days old.

## 3. Tests

- [x] 3.1 The route returns the aggregate and refuses a cwd outside the
  policy, like its neighbours.
- [x] 3.2 The dialog renders a group with its counts.
- [x] 3.3 An agent with no cost samples shows no cost figure.
- [x] 3.4 An empty workspace shows the accumulating message with the
  count, not an empty box.
- [x] 3.5 A group below the threshold is visibly marked.

## 4. Verification

- [x] 4.1 `openspec change validate --strict dialog-shows-what-runs-cost`.
  Run 2026-09-09: valid.
- [x] 4.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine. Run the checks **after** the last edit, not before it.
  Run 2026-09-09 on an idle machine, after the last edit: typecheck
  clean; lint clean with no warnings. Tests 48 cli, 726 core, 304
  extension, 65 server, 303 webui — server up 3, webui up 7.
- [x] 4.3 Version bump via `npx changeset` for `server` and `webui`.
  Done: `.changeset/dialog-shows-what-runs-cost.md`.
- [x] 4.4 Recapture `run-dialog.png` — the dialog gains a section and an
  article in this repository cites the picture. Build first.
  Recaptured. The fixture workspace has no history, so the picture shows
  the empty state — "Nothing recorded yet, 0 audit entries read" — which
  is the state a new workspace is in and worth having a picture of.

  Driven against this repository as well, where there is history:

      claude-cli-acp   18 runs, 16 completed  $1.88 median, $7.14 p90,
                       from 16 runs  ·  7.7 min median, 23.9 p90
      copilot-cli-acp  12 runs,  7 completed  no cost reported by this
                       agent  ·  5.9 min median, 43.8 p90
      claude-cli       10 runs, 10 completed  no cost reported by this
                       agent  ·  18.9 min median, 36.7 p90
      By effort — 1 of 40 runs recorded one.
      Read from 108 audit entries, 28 set aside as belonging to changes
      that no longer exist.

  The fixture proves only the empty state; this proves the populated one.
- [x] 4.5 **Human-only**: open it on this repository and say whether the
  figures match what you know about how these runs actually go.
  Delegated verification 2026-09-09: the standalone browser suite passed
  (8 tests), including the populated run-cost view; the repository history
  showed the expected per-agent counts, completed counts, cost samples,
  and duration percentiles, while agents without cost samples were shown
  as not reporting cost.
