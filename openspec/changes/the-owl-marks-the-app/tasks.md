The owl logo marks the standalone shell, its browser tab, and the
extension, and a test that waited too little waits longer.

## 1. The logo files

- [x] 1.1 Make the images from `C:\Temp\Github_Avatars\owl_transparent.png`
  (1234 × 1245):
  - crop to the disc, and square it;
  - cut the light rim at the disc's edge, which shows as a ring on a dark
    background;
  - resize with Lanczos to 40 and 80 pixels for the headline, 32 for the
    favicon, and 256 for `media/icon.png`.

  Record how the rim was cut, and the size of each file.

  Done on 2026-09-14, with Pillow 12.3.0.
  - The alpha channel's bounding box is 1229 × 1228, squared to 1229.
  - **The rim.** The disc's outer 3 pixels on the source are opaque
    near-white (RGB 249–255), then the dark navy starts. It showed as a light
    ring on a dark background. It is cut with a disc mask inset 9 source
    pixels, drawn at 4× and downsampled so the new edge stays smooth. Against
    `#1e1e1e` no ring is left at any size.
  - **The files:** `owl-40.png` 3828 B, `owl-80.png` 11178 B, `favicon-32.png`
    2697 B, and `icon.png` at 256 pixels 70077 B.
- [x] 1.2 Draw `packages/extension/media/icon.svg` as a monochrome owl in
  `currentColor`, on the same 24 × 24 grid as the icon it replaces. Render it
  at 16, 24 and 32 pixels on a dark and a light background, and look at each.

  Done.
  - **The shapes:** the brow sweep, two eye rings with pupils, the beak, and
    the body's arc. It has no circuit lines, which turn to noise below
    32 pixels.
  - **The render:** Chromium rendered it at 16, 24, 32 and 96 pixels, in
    `#cccccc` on `#181818` and in `#616161` on `#f8f8f8`. The owl reads at
    16 pixels.

  **Reopened on 2026-09-14.** The owner found this outline poor in the
  Activity Bar, and offered their own black-and-white owl,
  `C:\Temp\owl_bw_32x32.png`. It is a grey illustration, 182 shades, light
  lines on a dark disc. VS Code uses only an Activity Bar icon's
  transparency, so it cannot go in as it is.

  Two sharp masks were made from it, and rendered at 24 pixels as VS Code
  draws them:
  - its lines alone, which break into strokes at that size;
  - a disc with the lines cut out, which reads best but is a heavy light
    disc in a dark theme.

  **Done again, from the owner's drawing.** The owner supplied
  `C:\Temp\owl_eyes_brows_nose.svg`, one even-odd path of brows, eye rings
  and beak in a 728 × 479 viewBox.
  - **Fitting.** Chromium measured the path at 697.3 × 449.4. `icon.svg` keeps
    the path unchanged, fills it with `currentColor`, and puts it in a square
    viewBox, `242.3 40.3 753.1 753.1`: the long side plus 4% each side,
    centred. The file is 9421 B.
  - **Render.** It was drawn as VS Code draws an Activity Bar icon: a mask
    filled with the theme's foreground, 24 pixels, at 1x and 2x, in Dark
    Modern and Light Modern colours, active and inactive. It is sharp in
    each, beside the rejected outline and the 32-pixel masks.

## 2. The standalone shell

- [x] 2.1 `packages/webui/src/owl-logo.ts` exports the 40- and 80-pixel images
  as data URIs.
  - `standalone-entry.tsx`'s headline shows the owl at its left, with
    `srcSet` for 2x and an empty `alt`.
  - `shell-ui.ts` lays the headline out as a row.

  Done.
  - `owl-logo.ts` is 20466 B.
  - The image itself is `components/OwlLogo.tsx`, shared by both headlines.
  - The heading and its line sit in a `div` beside the image.
- [x] 2.2 `packages/server/public/index.html` names the 32-pixel owl as its
  icon, as a data URI.

  Done. `standalone.spec.ts` now also asserts it: the link's `href` starts
  with `data:image/png;base64,`, the headline's owl is visible with an empty
  `alt`, and the image has loaded.
- [x] 2.3 The browser tests that find the "OpenSpec UI" level-one heading
  still pass: `standalone.spec.ts`, `pipeline.spec.ts` and
  `documentation-screenshots.spec.ts`.

  Done: all three passed inside the whole suite recorded under 5.4.

## 3. The extension

- [x] 3.1 `media/icon.png` is the 256-pixel owl, and `media/icon.svg` is the
  outline from 1.2.

  Done: `icon.png` is the owl from 1.1, and `icon.svg` is the owner's drawing
  from 1.2.
- [x] 3.2 `extension-entry.tsx`'s headline shows the owl as 2.1 does.
  `ai-panel.ts`'s bridge Content Security Policy gains `img-src data:`, and
  nothing else.

  Done. `ai-panel.test.ts` gains "allows data: images in the bridge webview,
  and no other image source". The file passed 41 of 41.
- [x] 3.3 Live check in the Extension Development Host, with screenshots:
  - the Activity Bar entry, in Dark Modern and in Light Modern;
  - the extension's icon in the Extensions view;
  - the AI panel's headline, with no Content Security Policy error in the
    webview's developer tools.

  **Done on 2026-09-14.** Playwright's `_electron` drove VS Code 1.137.0
  with `--extensionDevelopmentPath` on this worktree's extension. The bundles
  were built from this worktree, and each contains `openspec-shell-logo`.
  - **The Activity Bar.** The owl outline shows in each theme's icon colour,
    in Default Dark Modern and in Default Light Modern.
  - **The AI panel,** opened with "OpenSpec UI: Open Process Dashboard". In
    both themes the owl is at the headline's left, rendered 40 × 40 with an
    empty `alt`, beside the heading "OpenSpec UI".
  - **Console.** The window logged no "Content Security Policy" or
    "Refused to load" message.
  - **The Extensions view** lists no extension under development:
    `@installed OpenSpec` found none. "Developer: Show Running Extensions"
    lists it only by its id, with no icon, so it cannot show the icon either.
  - **The icon, checked on an installed package instead.**
    - `vsce package --no-dependencies` built a `.vsix` from this worktree's
      `dist`. It carries `extension/media/icon.png` (70077 B) and
      `icon.svg`, and its manifest names `icon.png` as the default icon.
    - It was installed with `code --install-extension` into an empty
      extensions directory and profile.
    - Launched without a development path, the Extensions view's
      `@installed` row "OpenSpec Workbench" shows the owl, loaded at
      256 × 256, and the Activity Bar shows the owl outline.

  **Taken again with the owner's icon from 1.2**, the same way, in Default
  Dark Modern and Default Light Modern:
  - the Activity Bar shows the owl's brows, eyes and beak in each theme's
    icon colour;
  - the AI panel's headline still shows the owl, 40 × 40 with an empty
    `alt`;
  - no "Content Security Policy" or "Refused to load" message was logged.

## 4. A test that waited too little

- [x] 4.1 In `packages/core/src/delegated-item-run.test.ts`, the test "keeps a
  status record naming the change while the run is under way" waits up to
  10 seconds for the record, and has a per-test timeout of 15 seconds.
  `lint:test-budgets` passes.

  Done. `npx vitest run --project core src/delegated-item-run.test.ts` passed
  15 of 15, and `lint:test-budgets` passed.
- [x] 4.2 In `packages/core/src/agent-status.test.ts`, the two tests that wait
  for a record with `vi.waitFor`'s default wait up to 10 seconds, each with a
  per-test timeout of 15 seconds:
  - "carries the command's run id, and the task a run was started for from
    its first write";
  - "keeps a record for a run, named by the change its command is for, and
    removes it on a clean end".

  Found by the first run of 5.3. It began at 15:38 on 2026-09-14, beside the
  editor sessions of 3.3. Both tests failed with `expected undefined to match
  object`: no record had appeared within 1 second. The first test's cleanup
  then failed with `EBUSY` on its temporary directory, because the run it
  started was still open. Alone, before the fix, the file passed 47 of 47,
  three runs of three. The failure is the same one 4.1 fixes, in the same
  kind of wait.

  Done. The file passed 47 of 47, and `lint:test-budgets` and core's lint
  passed. Both tests passed inside the verify recorded under 5.3.

## 5. Checks

- [x] 5.1 A changeset: `@openspec-ui/webui` minor, `openspec-ui-vscode` minor,
  `@openspec-ui/server` patch.
- [x] 5.2 `openspec validate the-owl-marks-the-app --strict` passes, and
  `lint:english` passes after `git add`.

  Done on 2026-09-14, rerun on the final stage with the owner's icon, every
  file of the change staged and nothing untracked. `openspec validate --strict`
  passed, and so did `lint:english`, `lint:source-text`, `lint:changesets`,
  `lint:test-budgets` and `lint:screenshots` (24 pictures, all captured).
- [x] 5.3 `npm run verify` passes, run unpiped. Record each package's test
  count.

  **The first run** began at 15:38 on 2026-09-14 and exited 1: two tests in
  `agent-status.test.ts` failed, which 4.2 records and fixes.

  **The second run,** 15:50 to 15:56, exited 0, with no other process of
  this change running and a CPU load of 16% before it began. Typecheck and
  lint passed. The tests:
  - the root scripts: 4, 11, 10, 9 and 4, all passed;
  - cli: 161 in 16 files, all passed;
  - core `core` project: 1453 in 103 files, all passed;
  - core `core-git-subprocess` project: 4 in 2 files, all passed;
  - extension: 376 in 28 files, all passed;
  - server: 100 in 4 files, all passed;
  - webui: 472 in 51 files, all passed.

  The Activity Bar icon of 1.2 is a media file that no test reads, so
  replacing it does not require this run again.
- [x] 5.4 The whole standalone browser suite passes.

  Done on 2026-09-14, 15:28 to 15:35. `npm run test:browser -w
  @openspec-ui/server` ran from this worktree, building first, and passed
  20 of 20 in 6.2 minutes.

  The screenshot specs rewrote six pictures under `docs/images/standalone/`,
  now with the owl in the headline. They were restored with `git checkout`:
  new pictures belong to the documentation change that follows, which takes
  them all at once.
- [x] 5.5 Live check of the standalone server, with a screenshot: the owl in
  the headline and in the browser tab.

  Done on 2026-09-14. `tsx src/cli.ts <worktree> 4827` ran from this
  worktree, and Chromium opened the page in the light and the dark colour
  scheme.
  - **The headline.** The owl is rendered 40 × 40, `currentSrc` is a PNG
    data URI, `alt` is empty, and the level-one heading is still named
    "OpenSpec UI".
  - **The icon.** The page's `link rel="icon"` decodes to a 32 × 32 image.
  - **Errors.** The page logged no console error.

  A headless browser has no tab strip to photograph, so the icon is checked
  by decoding it. The headline screenshots show the owl beside the title.
