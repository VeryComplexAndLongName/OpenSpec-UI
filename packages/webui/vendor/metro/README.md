# Metro UI, vendored

`metro.css` and `LICENSE` are copied unchanged from the published npm
package `@olton/metroui@5.1.20` (`lib/metro.css` and `LICENSE`, MIT).

- Version: 5.1.20
- `metro.css`: 1481825 bytes
- SHA-256 of `metro.css`: `50e237f90becdbae2f216e97d84c2d3e35ef2bde1bbd1b69d2b24ed9c762c1f1`

Nothing here ships as it is. `scripts/build-metro.mjs` derives the copy the
web UI carries, `src/metro-css.generated.ts`: only the components the web UI
uses, every selector scoped under `.openspec-metro`, and no rule on a bare
element. A test recomputes the hash above, so an edited file cannot pass as
the published one. See ADR 0030 and the-web-ui-wears-metro.

To upgrade: replace both files from the new published package, update the
version and hash here, run `npm run build:metro -w @openspec-ui/webui`, and
retake the pictures.
