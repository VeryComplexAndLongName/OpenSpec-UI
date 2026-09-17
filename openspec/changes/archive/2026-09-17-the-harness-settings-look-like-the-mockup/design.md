## Context

The mockup's "Harness Settings" artboard
(<https://claude.ai/artifact/AXRHtMxhY2EsznHoAPo19L>) against the running tab
on 2026-09-16: every stage renders `AgentSelect`, `EffortSelect`,
`BudgetInput` and `CustomAgentSelect` as labelled blocks one under another,
so four stages fill two screens; `NamedConfigurationPicker` is a select with
four paragraphs; autonomy is a select and the review gate a sentence.

The same components render in three places: the standalone Harness
Settings tab, a change's Harness tab in the Change Editor, and the editor's
two harness panels (`harness-settings-entry.tsx`). The picker also renders
in the run dialog.

## Goals / Non-Goals

**Goals:**

- The tab matches the artboard in light and dark.
- Nothing the views do today is lost: inherit labels, custom agents and
  their notes, findings, unsaved state, what a save keeps.

**Non-Goals:**

- The timelines and the other tabs, which are later changes.
- A list of model ids. This product keeps none (ADR 0015); the model is a
  text field, and a malformed or unaccepted one is refused by core's
  validator when the file is written, as it is today.

## Decisions

### A stage is one grid row

`StageTable` draws a header — Stage, Agent, Model, Effort, Max cost — and
`StageRow` one row per stage: a numbered circle and the name, then a cell per
field. A field the stage's agent does not take shows a muted dash with a
title saying why, instead of disappearing and shifting the row. Each cell
carries its column's name in `data-label`; under 720 pixels the header is
hidden and the label is drawn above the field, so a narrow editor panel reads
as labelled blocks.

The controls keep their accessible names ("propose agent", "change apply
effort"), which is what the tests and a screen reader find them by; the
visible column header replaces the visible label.

### Custom agents stay per stage, their notes do not

A select under the agent is offered where the workspace defines agents for
the stage's CLI, or where a configured name is no longer found. The notes —
a CLI takes no custom agent; a CLI has no definitions, read from these
directories; a definition was found but refused — are said once per CLI
under the table. The requirement asks the surface to say so; saying it four
times was the wall of text in the owner's screenshot.

An agent's registry label can carry a caveat after a dash — "Claude CLI
(ACP) — progress only, no permission gate". In a table column the select cut
it off mid-word, so the option names the agent, the select's title keeps the
whole label, and the caveat is said once under the table with the stages
that use the agent.

### The model is a field in the form

`StageForms` gains `model`. `stepAgentsFromForms` writes the field instead of
keeping the loaded model out of sight: the form now shows it, so what is
saved is what is shown. A model is written only for an agent whose registry
entry has a `modelFlag`.

### Choices are native radios drawn as segments

`SegmentedChoice` is a `role="radiogroup"` of native radio inputs, each in a
label drawn as a segment, so arrow keys, focus and the checked state come
from the browser. It draws the named configuration, the autonomy level, and
a change's review gate.

### The run budget is `budget.maxCostUsd`

The field is laid over the loaded `budget`, so `maxTokens` and the per-stage
ceilings stay. Empty removes `maxCostUsd`, and an empty `budget` is removed.
In a change's view, empty means inherit, and the placeholder names the global
value. Applying a named configuration that sets a budget fills the field.

### Discard reads the file again

Discard reloads what the view loaded, rather than restoring a copy: the
file is the truth, and a copy could be stale.

### The page head's action shows the file

"agent-harness.json" toggles a panel under the settings with the JSON Save
would write — `globalConfigToSave` of the form — so a person who wants the
file can read it without leaving the tab. The action lives in
`standalone-entry.tsx`, which passes `showFile` to the view.

## Risks / Trade-offs

- **The picker changes in the run dialog too.** Its test ids stay except the
  select's, which becomes `-named-configuration-choice`.
- **Tests that change a select by value** click a radio by name instead.
- **The editor's panels change without an extension code change.** The
  narrow layout is the part that has to hold there; the extension's
  screenshot spec is run to see it.
