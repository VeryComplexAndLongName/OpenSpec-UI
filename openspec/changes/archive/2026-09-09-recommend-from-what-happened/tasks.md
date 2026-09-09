The aggregate shows three rows of medians and leaves the reader to draw
the conclusion. On this repository the conclusions are plain: one agent
of three reports a cost at all, and `claude-cli` takes 2.4 times as long
as its ACP variant for the same work.

## 1. What is recommended

- [x] 1.1 Cheapest, by median cost among groups that reported one.
- [x] 1.2 Fastest, by median duration.
- [x] 1.3 Most likely to finish, by completed over runs.
- [x] 1.4 Each carries the figure it won on and the runs behind it. The
  name is the conclusion; the observation is what makes it arguable.

## 2. When it is not recommended

- [x] 2.1 A comparison needing two candidates is not offered with one. A
  superlative over a single row claims a distinction that was never
  established — on this repository that silences the cost recommendation
  entirely, which is the honest state of it.
- [x] 2.2 A group below the aggregate's threshold cannot win. The
  threshold exists because a figure over too few runs is not an answer.
- [x] 2.3 A tie names every candidate. Breaking one arbitrarily presents
  a fabricated distinction as a finding.
- [x] 2.4 Nothing is invented where nothing was recorded: an agent with
  no cost samples is not a candidate for the cheapest, rather than being
  treated as costing zero.

## 3. Where it appears

- [x] 3.1 In the first box, above the figures it was drawn from — the
  conclusion first, its evidence beneath.
- [x] 3.2 Where no recommendation can be made, the box says why rather
  than showing the figures alone. "Nothing can be compared yet" and "no
  comparison was attempted" are different.

## 4. Tests

- [x] 4.1 Two agents with costs: the cheaper is named, with its figure.
- [x] 4.2 One agent with costs: no cost recommendation.
- [x] 4.3 A tie names both.
- [x] 4.4 A group below the threshold does not win despite a better
  figure.
- [x] 4.5 An agent with no cost samples is not the cheapest.
- [x] 4.6 Run it over this repository's real log and record what it says.
  Run 2026-09-09:

      Fastest here: copilot-cli-acp — 5.9 min median across 12 runs
      Most likely to finish: claude-cli — 10 of 10 runs completed
      cheapest: not offered — only claude-cli-acp reports a cost, so
                there is nothing to compare it against

  The third line is the one worth having. Naming `claude-cli-acp` the
  cheapest would have been easy and wrong: it is the only agent with a
  cost figure, so "cheapest" would have been the only option presented as
  a comparison. It refuses and says why.

  The first two also differentiate rather than repeating one answer:
  fastest and most-likely-to-finish are different agents, which is the
  trade a person is actually making.

## 5. Verification

- [x] 5.1 `openspec change validate --strict recommend-from-what-happened`.
  Run 2026-09-09: valid.
- [x] 5.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine, after the last edit rather than before it.
  Run 2026-09-09 after the last edit: typecheck clean; lint clean with no
  warnings. Tests 48 cli, 734 core, 304 extension, 65 server, 305 webui
  — core up 8, webui up 2.
- [x] 5.3 Version bump via `npx changeset` for `core` and `webui`.
  Done: `.changeset/recommend-from-what-happened.md`.
