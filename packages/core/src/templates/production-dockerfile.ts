import type { CatalogTemplate } from "../template-catalog.js";

// New category ("containerization") — Node.js/TypeScript-specific
// (multi-stage build stages assume a compiled-JS runtime output);
// deliberately narrow to single-container local dev + a production image,
// not an orchestration template (see design.md's Non-Goals).

export const productionDockerfile: Omit<CatalogTemplate, "origin"> = {
  manifest: {
    id: "production-dockerfile",
    title: "Add a production Dockerfile + docker-compose for a Node.js/TypeScript service",
    category: "containerization",
    version: "1.0.0",
    summary:
      "Adds a multi-stage production Dockerfile and a docker-compose file for local development, for a Node.js/TypeScript service that has neither yet.",
    variables: [
      {
        name: "appPort",
        prompt: "Port the service listens on inside the container (e.g. 3000)",
        default: "3000",
      },
      {
        name: "startCommand",
        prompt: "Command that starts the built application (e.g. node dist/index.js)",
        default: "node dist/index.js",
      },
    ],
  },
  artifacts: {
    proposal: `## Why

<!-- Fill in: no containerized deployment path exists yet, or deployment
currently relies on manually provisioned hosts. -->

## What Changes

- Add a multi-stage \`Dockerfile\`: a build stage installing dependencies
  and compiling TypeScript, and a slim runtime stage copying only the
  built output, running \`{{startCommand}}\` and listening on
  \`{{appPort}}\`.
- Add a \`.dockerignore\` excluding \`node_modules\`, build output, and local
  env files from the build context.
- Add \`docker-compose.yml\` for local development, mapping \`{{appPort}}\` to
  the host.

## Capabilities

### New Capabilities

- \`containerized-deployment\`: <fill in what this actually covers in your
  project>

## Impact

- New: \`Dockerfile\`, \`.dockerignore\`, \`docker-compose.yml\`.
- No application code changes.
`,
    design: `## Context

<!-- Fill in: current deployment approach, if any. -->

## Goals / Non-Goals

**Goals:**
- The runtime image contains no build tooling, dev dependencies, or
  source TypeScript — only compiled output and production dependencies.
- \`docker compose up\` starts a working local instance with no manual
  setup beyond it.

**Non-Goals:**
- Not adding orchestration beyond single-container local dev (Kubernetes
  manifests, etc.) — a separate decision if the project needs it.
- Not baking secrets into the image — runtime configuration stays
  environment-variable-based.

## Decisions

### Multi-stage build, not a single-stage image with dev dependencies pruned post-install

<!-- Fill in the actual reason for this project — default rationale: a
multi-stage build guarantees the runtime image never contains build
tooling or dev dependencies, whereas post-install pruning is one missed
step away from shipping the entire dev toolchain into production. -->

### Base image: an official slim/alpine Node.js image, not a full OS image

<!-- Fill in — rejected alternatives and why, if a different choice was
actually considered. -->

## Risks / Trade-offs

- **[Risk]** Alpine-based images use musl libc, which occasionally breaks
  native (non-pure-JS) dependencies built against glibc. →
  **Mitigation**: if a dependency fails to load in the runtime stage,
  switch the runtime base to a \`-slim\` (Debian-based) variant instead of
  \`-alpine\`.
`,
    tasks: `## 1. Dockerfile

- [ ] 1.1 Add a build stage: install all dependencies (including dev),
  copy source, run the TypeScript build.
- [ ] 1.2 Add a runtime stage: copy only \`package.json\`/lockfile and built
  output from the build stage, install production-only dependencies, run
  \`{{startCommand}}\`, expose \`{{appPort}}\`.
- [ ] 1.3 Add \`.dockerignore\` excluding \`node_modules\`, build output,
  \`.git\`, and local env files.

## 2. Local development

- [ ] 2.1 Add \`docker-compose.yml\` building the Dockerfile and mapping
  \`{{appPort}}\` to the host.

## 3. Verification

- [ ] 3.1 Build the image (\`docker build .\`) and confirm it succeeds.
- [ ] 3.2 Run it (\`docker compose up\` or \`docker run\`) and confirm the
  service responds on \`{{appPort}}\`.
- [ ] 3.3 Confirm the built image does not contain dev dependencies or
  source TypeScript (e.g. \`docker run --rm <image> ls node_modules/.bin\`
  should not list dev-only tools like the TypeScript compiler).
`,
  },
};
