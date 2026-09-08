Found by reading the code shipped hours earlier, in a review prompted by
"the goal is to fix errors". Both hosts write `template.config` as the
change's whole file, and the writer replaces.

## 1. The fix

- [x] 1.1 Read the change's existing override before writing, and lay the
  template's keys over it. The readers exist in both hosts already —
  `readChangeHarnessOverride` over HTTP, `readChangeHarnessConfig` on the
  Node side.
  The standalone half moved out of `standalone-entry.tsx` into
  `run-with-harness-dispatch.ts` on the way: that file is a bootstrap
  script and is not unit tested, which is the reason that module exists,
  and this is exactly the logic that needs a test.
- [x] 1.2 A change with no override yet writes the template alone, which
  is what it already did and is correct.
- [x] 1.3 A read that fails does not silently write a replacing payload.
  Losing a key because a read failed is the same harm arriving by a
  different route.

## 2. Tests

- [x] 2.1 A change carrying `gitStageAllowlist` keeps it when a template
  is applied, in both hosts. Named specifically because it is the key
  whose loss matters most and the one no template mentions.
- [x] 2.2 The template's own keys win over the change's previous values
  for the keys it sets.
- [x] 2.3 Asserted over `TOP_LEVEL_CONFIG_KEYS` rather than a list of
  fields, the same shape as the guard in `settings-save-what-was-shown` —
  naming fields is what let that one stand.
  **Not done as written, and the reason is worth stating.** These
  assertions name three keys and compare the whole written object, rather
  than iterating the key list. The iterating guard already exists one
  layer down, over the save path, and covers a key added to the schema
  and forgotten. What these cover is different: that this surface merges
  at all. Comparing the whole object catches a dropped key regardless of
  which one it is, which is the property that matters here.
- [x] 2.4 Show they can fail: revert the merge in both hosts and confirm
  each reports the loss.
  Done 2026-09-08. The standalone guard said `expected
  { maxStageAttempts: 2 } to deeply equal { …(3) }` — the two other keys
  gone. The extension's failed alone among its 143. Restored.

## 3. Verification

- [x] 3.1 `openspec change validate --strict applying-a-template-keeps-the-rest`.
  Run 2026-09-08: valid.
- [x] 3.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine. Read the whole failing-file list, not the first familiar line.
  Run 2026-09-08 on an idle machine: typecheck clean; lint clean with no
  warnings. Tests 48 cli, 703 core, 304 extension, 62 server, 296 webui
  — extension up 3, webui up 3.
- [x] 3.3 Version bump via `npx changeset` for `webui` and the extension.
  Done: `.changeset/applying-a-template-keeps-the-rest.md`.
