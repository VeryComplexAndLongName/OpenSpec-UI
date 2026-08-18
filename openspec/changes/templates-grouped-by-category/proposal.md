## Why

The template catalog now has 9 built-in templates across 6 categories
(`data-layer`, `framework-migration`, `architecture-migration`,
`testing`, `ci-cd`, `auth`, `containerization`), after
`feat/template-catalog-v3-agent-relevant-templates`. Both delivery
targets currently present the catalog as two flat lists (Built-in /
Project) with category shown only as incidental metadata (a table column
in the standalone shell, a small gray `.description` suffix in the VS
Code tree) — finding a specific kind of template means scanning the
whole flat list. Grouping by category was raised directly by the user
while reviewing the Templates panel screenshots taken for the README.

## What Changes

- VS Code Templates tree: each of the existing "Built-in" and "Project"
  group nodes gains an intermediate, alphabetically-sorted category
  subgroup level (e.g. Built-in → "auth" → `jwt-auth-middleware`),
  instead of listing every template as a flat child of the origin group.
  A group with only one template still gets its own category subgroup —
  no special-casing for group size.
- Standalone Templates tab: the table's rows are sorted and grouped by
  category, with a full-width subheader row per category boundary,
  instead of the current unsorted flat row order. The existing "Category"
  column stays (redundant with the subheader but keeps the table
  independently sortable/scannable — not removed).
- No change to the underlying catalog data, customize/insert/delete
  actions, or the `category` field itself — this is presentation-only
  grouping of the existing list.
- VS Code tree leaf items no longer repeat the category in their
  `.description` suffix (now redundant with the category subgroup
  header above them); the "customized" marker on forked templates stays.

## Capabilities

### Modified Capabilities

- `template-catalog`: the standalone Templates tab and the VS Code
  Templates tree both group templates by category instead of presenting
  a flat list per origin.

## Impact

- `packages/extension/src/tree/templates-tree.ts`
  (`TemplateCategoryGroupTreeItem` — new; `TemplatesTreeProvider.getChildren`
  builds category subgroups under each origin group).
- `packages/webui/src/standalone-entry.tsx` (Templates tab table render:
  group + sort `allTemplates` by category before mapping to rows, insert
  a subheader row per category).
- `openspec/specs/template-catalog/spec.md` (delta below).
