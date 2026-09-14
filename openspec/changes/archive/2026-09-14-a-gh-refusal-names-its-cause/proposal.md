# A gh refusal names its cause

## Why

A change's standing reads pull requests with `gh pr list`. When that fails,
the standing says so and leaves out every pull request fact
(a-change-says-where-it-stands). The reason it gives can be wrong.

`a-change-says-where-it-stands` 10.6 found the case:
- In a repository whose remote is not on GitHub, the standing said
  "Pull requests were not read: gh is not signed in".
- `gh auth status` reported the account signed in to github.com.
- `gh pr list` had refused with: "none of the git remotes configured for
  this repository point to a known GitHub host. To tell gh about a new
  GitHub host, please use `gh auth login`".

`whyGhFailed` in `packages/core/src/gh-pr-gateway.ts` tests the text for
`auth login` or `not logged in`. gh's refusal for a remote that is not on
a known host ends with that same `gh auth login` advice, so it matches, and
the reason names the wrong cause.

A person told they are signed out signs in again, and nothing changes.

## Capabilities

### Modified

- **The reason a standing gives for unread pull requests.** When gh refuses
  because no remote is on a GitHub host it knows, the reason says that. It
  does not say that gh is not signed in.

## Impact

- `packages/core/src/gh-pr-gateway.ts`: `whyGhFailed` checks for gh's
  unknown-host wording before its signed-out wording.
- `packages/core/src/gh-pr-list.test.ts`: a test with gh's refusal as it
  was recorded.
- Every host shows the reason core gives, so no host changes.
- A patch changeset for `@openspec-ui/core`.

## Out of scope

- **Other gh failures.** Where the wording is unknown, the reason still
  quotes gh's first line.
- **Reading pull requests from a host that is not GitHub.** The standing
  still leaves those facts out. It only says why.
