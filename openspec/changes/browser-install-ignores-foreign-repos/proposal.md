# The browser install does not depend on a repository we do not use

## Why

The browser suite has failed three runs in a row, across half an hour,
on something that is neither our code nor our dependency:

```
E: Failed to fetch https://dl.google.com/linux/chrome-stable/deb/dists/stable/main/binary-amd64/Packages.gz
   Hash Sum mismatch
E: Some index files failed to download.
Failed to install browsers
```

The runner image ships Google's Chrome apt repository. This job does not
use it — Playwright downloads its own Chromium build from Microsoft's
CDN. But `playwright install --with-deps` runs `apt-get update`, which
reads every source configured on the image, so a bad publish in that
third-party repository stops an install that has nothing to do with it.

Re-running is not a fix. It was tried three times, ten minutes apart,
and the mismatch is on someone else's CDN and clears on their schedule.

## Capabilities

### Modified

- The browser suite installs its system dependencies without reading apt
  sources this repository does not use.

## Out of scope

Dropping `--with-deps`. That is the flag that guarantees the libraries
Chromium needs are present, and removing it would trade a real guarantee
for someone else's outage. The source is what goes, not the check.
