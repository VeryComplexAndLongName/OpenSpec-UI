# Metro UI icons, vendored as a cut subset

What this folder carries, and nothing else:

| File | Bytes | SHA-256 |
| --- | --- | --- |
| `icons-subset.woff` | 2,388 | `3d50a4a60378df6e58b4d890d0eb09bbe4db1113871093bb0be9b76402838f2c` |
| `icons-subset.json` | 293 | `263431364b4b20d7d4f539c2dd095921bae67b04bf03f92bed04d88e19aaa5e0` |
| `LICENSE` | 1,108 | MIT, `@olton/metroui` |

`icons-subset.woff` holds 14 glyphs cut from Metro UI 5.1.20's own icon font,
and `icons-subset.json` gives each one's codepoint. `scripts/build-metro-icons.mjs`
reads the pair and writes `src/metro-icons.generated.ts`: one `@font-face`
inlining the subset as a `data:` URI, plus one class per glyph.

The glyphs: `archive`, `check-list`, `checkmark`, `cog`, `eye`, `file-text`,
`git-compare`, `open-in`, `play`, `refresh`, `robot`, `stop`, `timeline`,
`warning`.

**The cut happens out of band, not in this repository's build.** A
font-subsetting library would otherwise sit in every install's dependency
tree to be run twice a year. The project site cuts its own subset the same
way, with a script that is not part of its build.

## Cutting the subset again

Needed when a glyph is added to `scripts/build-metro-icons.mjs`'s
`KEPT_GLYPHS`, or when Metro is upgraded. Nothing here is read at build time
until the new files are in place, and the build refuses a name the subset does
not carry.

1. Fetch the published package's icon font and stylesheet for the pinned
   version — `@olton/metroui@5.1.20`, files `icons/core/fonts/metro-ui-core.ttf`
   (266,492 bytes) and `lib/icons.css` (392,894 bytes). Neither is committed.
2. Read each kept glyph's codepoint from that stylesheet's
   `.mif-<name>:before{content:"\eXXX"}` rules, and write them to
   `icons-subset.json`.
3. Cut the font to those codepoints, as WOFF, and write `icons-subset.woff`.
   `npx --yes subset-font` does it in one call; so does `fonttools`'
   `pyftsubset --flavor=woff`.
4. Run `npm run build:metro-icons -w @openspec-ui/webui`, and update the table
   above with the new sizes and hashes.

See ADR 0032 and `openspec/changes/the-web-ui-wears-more-metro/`.
