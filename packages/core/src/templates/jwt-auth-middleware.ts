import type { CatalogTemplate } from "../template-catalog.js";

// New category ("auth") — deliberately narrow: token *verification*
// middleware for already-issued tokens, not a login/issuance flow (see
// design.md's Non-Goals). Language-agnostic wording so it applies to
// either a Node.js or Python API; the fill-in dependency line names both.

export const jwtAuthMiddleware: Omit<CatalogTemplate, "origin"> = {
  manifest: {
    id: "jwt-auth-middleware",
    title: "Add JWT-based authentication middleware to an HTTP API",
    category: "auth",
    version: "1.0.0",
    summary:
      "Adds JWT verification middleware that rejects unauthenticated requests to protected routes, without introducing token issuance or a session store.",
    variables: [
      {
        name: "jwtSecretEnvVar",
        prompt: "Environment variable name holding the JWT signing secret",
        default: "JWT_SECRET",
      },
      {
        name: "protectedPathPrefix",
        prompt: "Route path prefix the middleware protects (e.g. /api)",
        default: "/api",
      },
    ],
  },
  artifacts: {
    proposal: `## Why

<!-- Fill in: routes under {{protectedPathPrefix}} are currently
unauthenticated, or a specific new protected route needs to be added. -->

## What Changes

- Add JWT verification middleware that reads a bearer token from the
  \`Authorization\` header on requests under \`{{protectedPathPrefix}}\`,
  verifies it against \`{{jwtSecretEnvVar}}\`, and rejects the request with
  401 on a missing, invalid, or expired token.
- Attach the decoded token payload to the request object for downstream
  handlers.
- Leave token issuance (login endpoint, refresh tokens) explicitly out of
  scope — this adds verification only.

## Capabilities

### New Capabilities

- \`request-authentication\`: <fill in what this actually covers in your
  project>

## Impact

- New: JWT verification middleware module.
- Modified: route registration for every route under
  \`{{protectedPathPrefix}}\` (wired through the middleware).
- Dependencies: a JWT library (e.g. \`jsonwebtoken\` for Node.js, \`pyjwt\`
  for Python — pick per the project's language).
`,
    design: `## Context

<!-- Fill in: current auth state — no auth yet, or migrating from a
session-cookie scheme. -->

## Goals / Non-Goals

**Goals:**
- Every route under \`{{protectedPathPrefix}}\` rejects requests with a
  missing, malformed, or expired token before any handler logic runs.
- The verification failure reason (missing vs. expired vs. invalid
  signature) is distinguishable in logs, even though the client-facing
  response is a uniform 401.

**Non-Goals:**
- Not implementing token issuance (login endpoint) or refresh-token
  rotation — this template covers verification of already-issued tokens
  only.
- Not choosing a claims schema beyond what verification itself needs
  (subject, expiry).

## Decisions

### Token transport: \`Authorization: Bearer <token>\` header, not a cookie

<!-- Fill in the actual reason for this project — default rationale:
header-based bearer tokens avoid CSRF concerns that cookie-based auth
requires separate mitigation for, at the cost of the client needing to
manage token storage itself. -->

### Failure response: uniform 401 with no distinguishing detail in the body

Returning different messages for "missing token" vs. "expired token" vs.
"invalid signature" in the response body would let an attacker
distinguish valid-but-expired tokens from garbage, aiding token-guessing/
replay attempts; the distinction is logged server-side instead.

## Risks / Trade-offs

- **[Risk]** A leaked \`{{jwtSecretEnvVar}}\` value lets an attacker mint
  arbitrary valid tokens. → **Mitigation**: treat it as a real secret (not
  committed, rotated on suspected leak); this template does not itself
  add secret-rotation tooling.
`,
    tasks: `## 1. Middleware

- [ ] 1.1 Add a JWT verification middleware module that reads the bearer
  token from the \`Authorization\` header, verifies it against
  \`{{jwtSecretEnvVar}}\`, and returns 401 on any missing/invalid/expired
  token.
- [ ] 1.2 On success, attach the decoded payload to the request object for
  downstream handlers to read.

## 2. Wiring

- [ ] 2.1 Register the middleware for every route under
  \`{{protectedPathPrefix}}\`; confirm routes outside that prefix are
  unaffected.

## 3. Verification

- [ ] 3.1 Add a test confirming a request with no \`Authorization\` header
  is rejected with 401.
- [ ] 3.2 Add a test confirming a request with an expired token is
  rejected with 401.
- [ ] 3.3 Add a test confirming a request with a valid token reaches the
  downstream handler with the decoded payload attached.
`,
  },
};
