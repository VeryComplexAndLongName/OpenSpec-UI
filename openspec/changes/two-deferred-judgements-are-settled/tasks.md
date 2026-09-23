Asked by the owner on 2026-09-23: tick the two deferred judgements that
the events of 2026-09-22 answered.

## 1. The two judgements

- [x] 1.1 The rebase of a behind branch, ticked with what the sweep did:
  three branches on 2026-09-22, each pushed with a lease, each pull
  request's checks run again on the pushed head (#692, #695, #715).
- [x] 1.2 The main checkout following an archive, ticked with the two
  lines the sweep wrote in the same pass, for #700 and again for #714 and
  #717, with nobody pulling.
- [x] 1.3 One requirement: a ticked judgement says what settled it.

## 2. Checks

- [x] 2.1 Both lines name what was seen, where, and when, and say they
  were ticked at the owner's request.
- [x] 2.2 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`, run unpiped, exit code 0: cli 192, core 1837 and 53,
  extension 493, server 116, webui 655. No browser or integration suite:
  this change ships no code.
- [x] 2.3 `openspec validate two-deferred-judgements-are-settled --strict`:
  valid. The merge gate locally with `--base origin/main`: ok.

No changeset: nothing ships. The judgements are about work already
released, and the file they live in is the workspace's own record.
