Three identical failures across half an hour, none of them ours.

## 1. The fix

- [x] 1.1 Drop `/etc/apt/sources.list.d/google-chrome.list` before the
  install, with the reason next to it.
- [x] 1.2 `--with-deps` stays: the guarantee is the point, the source is
  the problem.

## 2. Verification

- [x] 2.1 `openspec validate --strict --changes`.
- [ ] 2.2 The browser suite passes on this pull request — the only place
  this failure was ever visible, and the reason a local run proves
  nothing here.
