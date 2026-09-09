# Design

## Decision: remove the source, keep `--with-deps`

One line before the install:

```
sudo rm -f /etc/apt/sources.list.d/google-chrome.list
```

`--with-deps` stays and still installs what Chromium needs from Ubuntu's
own archives. What goes is a source this job never reads a package from.

## Rejected: retrying the install

Tried three times across half an hour on 2026-09-09, failing identically
each time. A retry loop would turn a hard failure into a slow one and
would still be red when the publish takes longer than the loop.

## Rejected: `playwright install chromium` without `--with-deps`

It would have passed today, and it would pass every day until the runner
image drops a library Chromium needs — at which point the failure is a
crash inside the browser rather than a missing package, which is a much
worse place to learn it.

## Rejected: pinning or mirroring the third-party repository

We do not install anything from it. Configuring it more carefully is
work spent on a source whose right amount of involvement is none.
