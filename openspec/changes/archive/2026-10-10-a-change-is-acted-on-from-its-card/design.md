## Context

ADR 0044 decides the card is where a change is worked and that the card
and the tree offer the same actions from one list; ADR 0045 named them.
The owner chose, on 2026-10-09, both hosts in this change, and that a
writing action on a change worked in its own worktree runs there.

## Decisions

1. **One list, in core, browser-safe.** `CHANGE_ACTIONS` names every
   action on an active change with its command id, title, group (from its
   verb), codicon, whether it writes and whether it is confirmed (every
   Danger action is). `changeActionStates(facts)` answers, from where the
   change is worked, whether a run of it is going and its open tasks,
   whether each can run now and, where not, why - one sentence each, so the
   card's tooltip and the tree's Show Actions... say the same.
2. **Where it lives decides where it runs.** `workedElsewhere(ownership)`
   names the directory; `refuseToWrite` now refuses only where that
   directory's records do not check out. Each extension command acts in
   `workedIn(item, workspaceRoot)`; the server finds the directory with
   `changeActionRoot` from the worktree list, never from a request.
3. **The card runs the row's command.** In VS Code the Pipeline card posts
   the action and the change's name; the host checks both, builds the
   change as a Changes row carries it (`changeItemNamed`), and runs that
   command - so a card and a row cannot do different things. A card that
   confirmed a Danger action says so, and the command does not ask again.
4. **The standalone app runs them through one route.** `/api/change-action`
   reads, writes or answers with relations to pick from; the page asks
   first where an action needs words, and shows the answer over the
   Pipeline. Three actions are the page's own: Run Change is Start,
   Configure Change Harness opens the change's harness settings in the page
   (the harness routes now read and write where the change is worked), and
   Open Change Copy opens the change's tasks page.
5. **Icons as in VS Code, drawn from the font VS Code ships.** The card
   needs nineteen distinct pictures, and the web UI's Metro subset holds a
   handful; cutting a new subset is done out of band. The outlines are
   read once from VS Code's own `codicon.ttf` with fontTools
   (`scripts/extract-codicons.py`, CC BY 4.0, attributed in the generated
   file), so the card and the menus show one picture for one action, in
   both hosts, inline and within any Content Security Policy.
6. **Two fixed rows.** A card is 21rem wide, too narrow for eighteen icons
   in one row: what runs and what reads stand in the first, what sets up
   and what cannot be taken back in the second. Their height is in
   `PIPELINE_CARD_REM`, so a card is still derived, never measured. Run
   Change is the card's Start, not an icon again.
7. **The tree keeps a context menu's rules.** A menu has no disabled
   state, so Show Actions... is the place a row says why an action cannot
   run; Remove Relation still shows only on a row that states one, or on a
   row whose relations are read in another directory. Inspect and Set Up
   are submenus; Danger is last. The other directories' own pictures stay
   read-only: their cards are of other directories' queues.

## Risks / Trade-offs

- **Writing in another working directory.** An action now writes in the
  change's own worktree where it used to refuse. That is ADR 0044's
  decision, and the chain already worked there; a directory whose records
  do not check out is still refused.
- **The extracted outlines are a copy.** They are regenerated with the
  script when VS Code's icons change; a test fails where an action's icon
  has no outline.
