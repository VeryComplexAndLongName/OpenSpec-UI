## Context

ADR 0044 point 4: first the actions reach the card and the tree from one
list (done in a-change-is-acted-on-from-its-card); then the side panel
takes its new shape. The Pipeline panel is not kept while hidden: shown
again, its page loads anew.

## Goals / Non-Goals

**Goals:** a Workspace view for what belongs to no change; Changes as a
list to go to a change by; a change's actions in one place, its card, with
Show Actions... as the way to them from the tree.

**Non-Goals:** the standalone app, which has no side panel; the Change
Graph's own menus (relations, and messages to a run, on the graph's rows);
the Archive and Templates menus.

## Decisions

- **Choosing a change shows its card.** A change row's command is Open
  Pipeline with the change's name; Open Pipeline from a menu passes none.
  No new command, so nothing is added to the palette.
- **The page says when it runs.** The host keeps the change to show. A
  panel in sight is told at once; a panel created or shown again loads a
  page, which posts `openspec-ui/pipeline-ready`, and the host answers with
  `openspec-ui/show-card` once. A request is never answered twice, so a
  page shown again later does not jump back to an old card.
- **The embedded standalone page too.** Where the extension embeds the
  local server's page, the outer document says when the frame has loaded
  and passes `show-card` on to the frame's own origin alone. The page
  listens from the start, before it is drawn, and keeps the request until
  its Pipeline is.
- **Found once drawn.** `PipelineView` takes `focus: { changeName, at }`
  and looks for the card every 200 ms for up to 15 s: a Pipeline just
  opened draws its cards when its first reading returns. The card is
  scrolled to the middle, marked with `data-focused` for 2.5 s and its
  first button focused.
- **Agents are detected on opening.** Detection starts each agent's
  command-line program, so it runs when Agents is opened and again only on
  Refresh Views. The stages come from the workspace harness, read each
  time.
- **Open Dashboard stays in the Changes title as well.** A spec scenario
  opens the Dashboard from there, and it is where people found it; the
  checks move to Workspace rows.

## Risks / Trade-offs

- Someone used to right-clicking a change for Run Change... finds Show
  Actions... there, one step more → Show Actions... lists every action,
  grouped, as the card does; the card is a click away.
- Processes and Change Graph folded may look gone → their headers stay in
  the panel, and a view's fold is remembered by the editor once changed.
