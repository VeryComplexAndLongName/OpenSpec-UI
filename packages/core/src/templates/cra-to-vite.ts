import type { CatalogTemplate } from "../template-catalog.js";

// JavaScript/frontend counterpart to `flask-to-fastapi` in the same
// category — closes a gap where `framework-migration` only had a Python
// backend example, while "JavaScript" is named as its own target language
// separately from "Node.js" (template-catalog-v2/proposal.md, Why).
// Deliberately narrow — the well-established core migration steps
// (build tool, env vars, HTML entry point), not a claimed complete guide
// to every `react-scripts` feature's Vite equivalent (e.g. CRACO/custom
// webpack overrides are explicitly out of scope, see design.md's
// Non-Goals).

export const craToVite: Omit<CatalogTemplate, "origin"> = {
  manifest: {
    id: "cra-to-vite",
    title: "Migrate a Create React App project to Vite",
    category: "framework-migration",
    version: "1.0.0",
    summary:
      "Replaces react-scripts with Vite: build/dev-server config, the HTML entry point, and REACT_APP_-prefixed environment variables.",
    variables: [
      {
        name: "sourceDir",
        prompt: "Source directory containing the app code (e.g. src)",
        default: "src",
      },
      {
        name: "envVarPrefix",
        prompt: "Existing Create React App environment variable prefix to migrate away from",
        default: "REACT_APP_",
      },
    ],
  },
  artifacts: {
    proposal: `## Why

<!-- Fill in: what forces this change now — react-scripts' dev-server/
build performance, wanting Vite-ecosystem plugins, or react-scripts no
longer receiving updates for a needed feature. -->

## What Changes

- Replace \`react-scripts\` with \`vite\` + \`@vitejs/plugin-react\`; add
  \`vite.config.ts\`.
- Move \`public/index.html\` to the project root as \`index.html\`, and add
  a \`<script type="module" src="/{{sourceDir}}/index.tsx">\` entry point
  tag (Vite serves \`index.html\` from the root, not \`public/\`).
- Rename every \`{{envVarPrefix}}*\` environment variable to \`VITE_*\`, and
  replace \`process.env.{{envVarPrefix}}X\` reads in \`{{sourceDir}}\` with
  \`import.meta.env.VITE_X\`.
- Replace the \`start\`/\`build\` npm scripts (\`react-scripts start\`/
  \`react-scripts build\`) with \`vite\`/\`vite build\`.

## Capabilities

### Modified Capabilities

- \`frontend-build\`: <fill in what this actually covers in your project —
  the same app now built/served by Vite instead of react-scripts>

## Impact

- New: \`vite.config.ts\`, \`index.html\` at the project root.
- Modified: every \`{{sourceDir}}\` file reading a \`{{envVarPrefix}}*\`
  environment variable; \`package.json\` scripts.
- Removed: \`public/index.html\`, \`react-scripts\` dependency (once
  migration is complete).
- Dependencies: \`vite\`, \`@vitejs/plugin-react\` (add); \`react-scripts\`
  (remove once cutover is complete).
`,
    design: `## Context

<!-- Fill in: current react-scripts version, any CRACO or custom
webpack-override tooling already layered on top (that tooling has no
direct Vite equivalent and needs its own migration plan — see
Non-Goals), and whether env vars are consumed anywhere outside
{{sourceDir}} (e.g. a server-side rendering entry point). -->

## Goals / Non-Goals

**Goals:**
- \`vite\` (dev) and \`vite build\` (production) produce a working app with
  the same behavior as the \`react-scripts\` equivalents, before
  \`react-scripts\` is removed.
- Every \`{{envVarPrefix}}*\` environment variable has a working
  \`VITE_*\` equivalent consumed via \`import.meta.env\`, not
  \`process.env\` (Vite does not polyfill \`process.env\` by default).

**Non-Goals:**
- Not migrating CRACO or custom webpack-override configuration beyond
  what Vite's defaults handle — a project using those needs a separate,
  explicit plan for whatever they customized (proxying, path aliases,
  custom loaders).
- Not migrating the test runner (CRA's Jest-via-react-scripts setup) —
  that is a separate decision; see the \`node-vitest-testing-baseline\`
  template if adopting Vitest for tests as well.
- Not changing routing, state management, or any other application-level
  concern — this is a build-tool migration only.

## Decisions

### Env var prefix: \`VITE_\`, not a custom \`envPrefix\` config to keep \`{{envVarPrefix}}\`

Vite's \`envPrefix\` config option *can* be set to accept
\`{{envVarPrefix}}\`-prefixed variables instead of renaming them, but doing
so keeps a CRA-specific naming convention alive for no benefit once
\`react-scripts\` itself is gone; renaming to \`VITE_*\` is the one-time
cost that avoids carrying the old convention forward indefinitely.

### HTML entry point: root \`index.html\`, not a build-time-generated one

<!-- Fill in the actual reason for this project if it differs — default
rationale: Vite treats index.html as a real source file, participating in
the module graph (e.g. the injected script tag), rather than a template
populated by a plugin the way CRA's HtmlWebpackPlugin does. -->

## Risks / Trade-offs

- **[Risk]** A missed \`process.env.{{envVarPrefix}}X\` read (not caught by
  a global search) silently becomes \`undefined\` at runtime under Vite,
  since Vite does not polyfill \`process.env\`. → **Mitigation**: search
  the full \`{{sourceDir}}\` tree for \`process.env.{{envVarPrefix}}\`
  before cutover, not just the files touched during migration.
`,
    tasks: `## 1. Vite setup

- [ ] 1.1 Add \`vite\` and \`@vitejs/plugin-react\` as dev dependencies; add
  \`vite.config.ts\` with the React plugin registered.
- [ ] 1.2 Move \`public/index.html\` to the project root as \`index.html\`;
  add \`<script type="module" src="/{{sourceDir}}/index.tsx">\`.

## 2. Environment variables

- [ ] 2.1 Search \`{{sourceDir}}\` for every \`process.env.{{envVarPrefix}}\`
  read; rename each variable to a \`VITE_\`-prefixed equivalent in \`.env\`
  files and replace the read with \`import.meta.env.VITE_<name>\`.

## 3. Scripts

- [ ] 3.1 Replace \`"start": "react-scripts start"\` with \`"dev": "vite"\`
  and \`"build": "react-scripts build"\` with \`"build": "vite build"\` in
  \`package.json\`.

## 4. Cutover

- [ ] 4.1 Confirm \`vite\` (dev) serves the app with the same behavior as
  the previous \`react-scripts start\`.
- [ ] 4.2 Confirm \`vite build\` produces a working production build with
  the same behavior as the previous \`react-scripts build\` output.
- [ ] 4.3 Remove \`public/index.html\` and the \`react-scripts\` dependency.

## 5. Verification

- [ ] 5.1 Run the full existing test suite (still on its pre-migration
  runner, per this template's Non-Goals) and confirm no regressions.
- [ ] 5.2 Manually load the app built via \`vite build\` and confirm every
  feature depending on a migrated \`VITE_*\` environment variable still
  works.
`,
  },
};
