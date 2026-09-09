# The run dialog is a panel, not a quick-pick

## Why

In VS Code, `Run` answers "what will this do before it does it" through a
quick-pick. That control gives one line per item and cuts the rest
without saying so — measured from a screenshot on 2026-09-08, every
configuration's intent ended mid-word — so the dialog built to stop
showing less than was known shows less than it knows.

Four things it has to say do not fit there:

- The named configurations, each with what it is for, when it is the
  wrong choice, and where its ceilings came from. The quick-pick shows
  one of those sentences, truncated.
- What each configuration would set for the agents this change uses. The
  standalone dialog resolves the effort per agent; the quick-pick has no
  room for a second line.
- What runs have cost in this workspace.
- The custom agent a stage would use, which the quick-pick cannot offer
  at all.

The standalone shell already renders all of it, from components in
`webui`, and the extension already hosts `webui` in a webview panel. The
work is carrying the plan into that panel and carrying a choice back —
not building a second dialog.

## Capabilities

### Modified

- `Run` in VS Code shows the same dialog the standalone shell shows,
  rendered in the panel that already exists, and starts nothing until a
  path is chosen.

## Out of scope

The `Configure Harness for this Change` wizard. It is a different
question — editing a configuration rather than starting a run — and its
own quick-picks are worth replacing separately, with the settings view
that already exists for them.

Changing what the dialog says. Every sentence it renders is already
written and already tested in `webui`; this change is about which host
can show them.
