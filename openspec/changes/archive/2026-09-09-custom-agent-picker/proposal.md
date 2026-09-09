# A custom agent is chosen where the stage's agent is chosen

## Why

`custom-agents-are-visible` shipped the whole path — a definition is
found, a stage may name one, naming one for a CLI that accepts none is
refused, and the adapters pass it — and shipped no way to pick one. Task
3.1 of that change says so outright: the requirement about offering them
was taken back out rather than left declared and unmet.

So today a person who has written a reviewer agent for their repository
can use it only by hand-editing `harness.json` with a name nothing on
screen ever showed them. The discovery reads directories, and nothing
carries what it found to the browser.

## Capabilities

### New

- The custom agents a workspace defines are readable by the browser, and
  offered for each stage whose agent accepts one.

## Out of scope

The VS Code wizard's own quick-picks. `Configure Harness for this Change`
asks its questions as a series of quick-picks, and those are being
replaced by a webview that renders the same components this change adds
to. Building the picker twice, once in a surface with a replacement
already agreed, would be work done to be deleted — so this change puts it
in the shared settings view, which the webview will host.

Said rather than left as an absence: until that webview lands, a custom
agent is chosen in the standalone UI, and a `harness.json` written there
is read by both hosts.

Creating or editing a definition. They are files their own tools already
manage; this reads them.
