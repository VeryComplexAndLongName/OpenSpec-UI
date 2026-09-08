# The kill-confirmation timer is cleared

## Why

`spawnAndStream` arms a ten-second timer when a run is cancelled, to
notice a process that outlives its own termination. It never clears it.

The `finally` block removes the abort listener and nothing else, so on
the ordinary cancellation path — the child dies, `cancelled` is yielded,
the generator ends — a timer stays armed for ten seconds with nothing
left to consume what it pushes.

Two consequences. A pending `setTimeout` holds the Node event loop open,
so a CLI run that was cancelled takes up to ten seconds longer to exit
than it should. And the timer fires into a queue nobody is reading, which
is harmless today only because the wake function happens to be null by
then — a property of the current loop, not a guarantee anyone stated.

The lint rule has been reporting this all along:
`'killTimer' is assigned a value but never used`. The variable exists to
be cleared and the clearing was forgotten, so the warning is exactly
right. It has been dismissed as pre-existing in every verification run
this project has recorded today.

## Capabilities

### Modified

- A cancelled run leaves no timer behind.

## Out of scope

The `killConfirmationTimeoutMs` value and what it reports. Both were
argued in `cancel-reports-what-happened` and neither changes here.
