## 1. Fix the image links

- [x] 1.1 Replace all 9 relative `../../docs/images/extension/*.png`
  paths in `packages/extension/README.md` with absolute
  `raw.githubusercontent.com` URLs.

## 2. Version and changelog

- [x] 2.1 Bump `packages/extension/package.json` from `0.20.1` to
  `0.20.2`.
- [x] 2.2 Add a `0.20.2` entry to `packages/extension/CHANGELOG.md`.

## 3. Verification

- [x] 3.1 Confirm the root cause: build the VSIX
  (`npm run package --workspace openspec-ui-vscode`), extract the
  bundled `extension/readme.md`, and confirm the previous relative
  paths became a broken `HEAD/../../docs/images/...` URL.
- [x] 3.2 Rebuild the VSIX after the fix and confirm the bundled
  `extension/readme.md` now contains the absolute URLs unchanged (`vsce`
  does not rewrite already-absolute image URLs).
- [x] 3.3 Confirm each target URL actually resolves
  (`curl -o /dev/null -w "%{http_code}"` returns 200).
- [x] 3.4 `npm run lint:english` passes.
- [x] 3.5 Run `openspec change validate --strict fix-vsix-readme-image-links`.
