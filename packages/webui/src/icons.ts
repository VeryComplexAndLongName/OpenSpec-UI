// What a screen means, mapped to the glyph that draws it (ADR 0032;
// the-web-ui-wears-more-metro). A screen names a meaning and never writes a
// `mif-` class: `iconFor("change")`, not `mif-git-compare`.
//
// The glyph names below are Metro's own `mif-<name>` names, minus the
// `mif-` prefix — the same names `build-metro-icons.mjs`'s KEPT_GLYPHS
// lists. icons.test.ts fails when the two lists disagree in either
// direction: a meaning naming a glyph the generated font does not carry, or
// a glyph in the generated font that nothing here names.

/** The class prefix `metro-icons.generated.ts` gives every kept glyph. */
const CLASS_PREFIX = "openspec-icon-";

/** A meaning this product names, mapped to the Metro glyph that draws it. */
export const ICONS = {
  change: "git-compare",
  spec: "file-text",
  archive: "archive",
  task: "check-list",
  run: "play",
  stop: "stop",
  refresh: "refresh",
  review: "eye",
  open: "open-in",
  settings: "cog",
  agent: "robot",
  timeline: "timeline",
  log: "file-text",
  warning: "warning",
  ok: "checkmark",
} as const;

export type IconMeaning = keyof typeof ICONS;

/** The class an `Icon` draws for a meaning. */
export function iconFor(meaning: IconMeaning): string {
  return `${CLASS_PREFIX}${ICONS[meaning]}`;
}
