## Context

Two hosts draw the same `PipelineView`:

- **The standalone shell** reads over HTTP, from the server's own process:
  `change-readiness-client.ts`, `worktree-survey-client.ts`,
  `change-standings-client.ts` and `live-runs-client.ts` post to
  `/api/change-readiness`, `/api/worktree-survey`, `/api/live-runs` and
  `/api/runs/ask-to-stop`, carrying `x-openspec-ui-token` read from the page's
  `#token=` fragment.
- **The VS Code panel** reads over the webview message bridge:
  `pipeline-entry.tsx` calls `bridge.request("pipeline/readiness")` and the
  rest, and `pipeline-panel.ts` answers them in the extension host.

The extension already knows how to embed the shell: `AiPanel.getLocalServerHtml`
builds an iframe whose `src` carries `?embed=vscode-local-server` ahead of the
`#token=` fragment, under a CSP scoped to that exact localhost address, and
`OptionalServerManager` holds the address and the access token.

What makes the panel go quiet is not the bridge itself but what it asks for:
`readPipelineReadiness` runs git per worktree on every request, and
`pipeline/refresh` fetches. Both sit in the process that is running the chain.
Measured on 2026-09-16 while a chain's `apply` stage ran: the processor at
100%, the extension host at 1,042 seconds of CPU, and all three readings past
the 10-second ceiling.

## Goals / Non-Goals

**Goals:**
- A card answers while a chain runs in this editor.
- A card keeps its actions: opening the change, and asking a run to stop.
- The default path is unchanged for anyone who has not enabled the server.

**Non-Goals:**
- **Moving the chain out of the extension host.** A larger decision, and not
  needed for the panel to answer.
- **Changing the readings themselves.** Their shapes and their routes stay.
- **Making the local server the default.** It stays opt-in.
- **Making the readings cheaper.** Answering from the last reading, and
  skipping git while a run holds the lease, are worth doing and are not this
  change.

## Decisions

### The panel embeds the server's page when the server is enabled

`PipelinePanel.show()` asks for the local server URL. With one, the panel's
HTML is an iframe at `<url>/?embed=vscode-local-server&tab=pipeline`, under
`default-src 'none'; frame-src <url>;`. With none, it loads the `pipeline.js`
bundle and the bridge, exactly as today.

Rejected: always embedding the server and starting it when the panel opens.
That turns an opt-in transport into the default one for a panel, and a person
who never enabled it would find a listening port they did not ask for.

### The embed's allow-list gains `pipeline`, and the tab is chosen by the URL

`ALLOWED_TABS_VSCODE_EMBED` becomes `["run-a-command", "pipeline"]`, and the
embedded shell selects its initial tab from a `tab=` parameter, so the AI
panel's iframe still opens on Run a Command and the Pipeline panel's opens on
Pipeline.

Rejected: a second embed signal (`embed=vscode-pipeline`). The signal says
which host is embedding, not which screen it wants; a separate parameter for
the tab keeps one signal with one meaning.

### Opening a change is relayed, with the origin checked

The embedded page posts `openspec-ui/open-change` to `window.parent`. The
panel's outer document listens, checks `event.origin` against the server's
address, and forwards the message to the extension, which calls `revealChange`
as it does today.

The existing refusals stay where they are: the panel already refuses a name
that is not an active change, and one that tries to escape the changes
directory.

### The panel names the editor's theme, and lets its stylesheet in

Found in the live check (tasks 5.7): a page served over http from the local
server cannot read the editor's colours, and chose light or dark from the
operating system, so a dark editor showed a light Pipeline. The iframe's URL
now carries `theme=light` or `theme=dark`, from the editor's active colour
theme, and the shell takes a theme it is told over a stored choice and the
system. The Pipeline panel frames the page again when the editor's theme
changes. The AI panel names the theme too, but does not frame its page again:
that would drop a run a person is watching.

The same check found the iframe at the browser's default 300 by 150 pixels.
The outer document's inline stylesheet had been refused: `default-src 'none'`
with no `style-src`. Both panels now allow it by a nonce, and the stylesheet
makes the iframe a block and the outer document unscrollable, so the only
scroll bar is the shell's. Both live in `embedded-page.ts`, which both panels
import.

Rejected: forwarding the editor's colour variables into the page. The shell
draws its own palette in both hosts; light or dark is the one fact it needs.

### A card's word reads the runs its lines read

Also found in the live check (tasks 5.6): with the server on, a card said
Ready above its own "running apply" line for as long as a loaded machine took
to read standings again. The standings reading surveys every directory too,
but it may fetch and ask `gh` first, so its runs are a reading behind the
survey's. `describeChangeCards` now gives each standing's copies the runs of
the survey the card's run line comes from, and keeps the rest of what the
standing read. The filter both use, `standingRunsOf`, lives in
`worktree-survey-facts.ts`.

Rejected: reading standings as often as the survey. It is the slow reading by
design, and the panel would go back to waiting on it.

### Stop stays the server's route

The card's Stop already goes to `/api/runs/ask-to-stop` in the browser, and
that is what the embedded page will use. The request is signed the same way,
and the server refuses a run that is not this person's, so the embed gains no
authority the browser does not already have.

## Risks / Trade-offs

- **Two transports for one panel.** The bridge path stays for the default
  configuration, so both have to keep working. The tests cover each.
- **A token in a URL fragment.** The AI panel already embeds the shell this
  way; this change adds no new exposure, and a fragment is not sent to the
  server by the browser.
- **The server's process can be busy too** — it serves the browser as well. It
  does not run the chain, which is the load that breaks the panel today.
- **A person with the server disabled sees no improvement.** Named in the
  proposal, and left to the change that makes the readings themselves cheaper.
