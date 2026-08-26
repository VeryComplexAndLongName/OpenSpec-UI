# Security Policy

## Reporting a Vulnerability

Please report security vulnerabilities privately through GitHub's
built-in reporting flow, not as a public issue: open this repository's
**Security** tab, then **Report a vulnerability** (or go directly to
[github.com/VeryComplexAndLongName/OpenSpec-UI/security/advisories/new](https://github.com/VeryComplexAndLongName/OpenSpec-UI/security/advisories/new)).
This creates a private draft security advisory visible only to the
maintainer and you, so the issue is not disclosed before a fix is
available.

Include, as far as you can:

- The affected package (`@openspec-ui/core`, `@openspec-ui/server`,
  `@openspec-ui/webui`, `openspec-ui-vscode`, or `@openspec-ui/cli`) and
  version.
- Steps to reproduce, or a minimal example.
- The potential impact (what an attacker could actually do).

This is a project with a single maintainer, not a security team with a
formal SLA — reports are triaged and responded to on a best-effort basis,
but every report is read.

## Supported Versions

Only the latest published version of each package is supported. There
are no maintained long-term-support branches; fixes land on `main` and
ship in the next version bump (see the root `README.md`'s "Versioning"
section and `.changeset/README.md` for how versions are cut).

## Scope

This is a local-first developer tool: the standalone server binds to
`localhost` only and the VS Code extension runs inside the user's own
editor process. Neither is designed to be exposed to an untrusted
network or to run against untrusted, unauthenticated remote clients —
findings that require an attacker to already have that level of local
access are still worth reporting, but are lower severity by design than
they would be for a networked service.

## Known Accepted Risks

Some `npm audit` findings are dependency-tree-only (dev/test tooling —
`vitest`/`vite`/`esbuild`/`mocha` and their transitive dependencies —
never shipped in the VSIX or the server's runtime bundle) whose only fix
requires a major version bump this repository's `.github/dependabot.yml`
deliberately blocks because it currently breaks the build. These are a
tracked, deliberate trade-off, not an oversight — see the archived
`ignore-vitest-major` and `fix-nanoid-vulnerability` OpenSpec changes for
the reasoning. They will be revisited once the upstream breakage
(`@rolldown/binding` native-module resolution under `vitest@4`) is fixed
or a workaround is found.
