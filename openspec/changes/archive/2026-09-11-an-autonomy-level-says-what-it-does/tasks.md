Three implemented levels, two labelled unimplemented, and one of them
offered where saving it is refused.

## 1. The labels

- [x] 1.1 `packages/webui/src/components/HarnessSettingsView.tsx`: each
  option names what the level does. No option carries
  "(not yet implemented)".

## 2. The scope

- [x] 2.1 The options offered are derived from the section's scope. The
  global select does not offer `autonomous`, which
  `writeGlobalHarnessConfig` refuses.
  Correction to this task's own premise: deriving them inside the view
  would have left two lists that can disagree, which is how this defect
  arose. `HARNESS_AUTONOMY_LEVELS` and `autonomyLevelsFor` moved to
  `harness-step-agent.ts`, the browser-safe leaf; `harness-config.ts`
  enforces that list and re-exports the type, and the view reads the
  same function. One list, two readers.
- [x] 2.2 The per-change select still offers all three, plus inherit.

## 3. The guide

- [x] 3.1 `HARNESS.md`: remove the caption calling the suffix stale UI
  copy, since the copy is gone.
- [x] 3.2 Regenerate the settings screenshots from the browser suite
  that produces them, and say which changed.
  `harness-settings.png` and `harness-change-override.png`. Both are
  this change's own output: the level select is in each.

## 4. Tests

- [x] 4.1 Webui: the global select's options are exactly `assisted` and
  `semi-autonomous`; the per-change select's are those two plus
  `autonomous` and inherit.
- [x] 4.2 Webui: no rendered option text contains "not yet
  implemented".
- [x] 4.3 A test tying the offered global values to what
  `writeGlobalHarnessConfig` accepts, so the two cannot drift apart
  again.

## 5. Verification

- [x] 5.1 `openspec validate --strict --changes`.
- [x] 5.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Recorded in the commit.
- [x] 5.3 Whole browser suite, not only the specs this touches. 12
  passed, 3.1 minutes.
- [x] 5.4 Version bump via `npx changeset` for webui.
