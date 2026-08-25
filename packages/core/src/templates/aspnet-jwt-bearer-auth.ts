import type { CatalogTemplate } from "../template-catalog.js";

// ASP.NET Core-specific counterpart to `jwt-auth-middleware`. Deliberately
// separate rather than folding into that generic template: ASP.NET Core's
// idiomatic shape (built-in `AddJwtBearer` middleware registered once in
// `Program.cs`, declarative `[Authorize]` attributes on controllers/
// endpoints instead of a hand-written middleware function) is different
// enough to be its own template, not just another `{{...}}` variable on
// the existing one. Same narrow scope as `jwt-auth-middleware`: token
// *verification* only, no issuance/login endpoint.

export const aspnetJwtBearerAuth: Omit<CatalogTemplate, "origin"> = {
  manifest: {
    id: "aspnet-jwt-bearer-auth",
    title: "Add JWT bearer authentication to an ASP.NET Core API",
    category: "auth",
    version: "1.0.0",
    summary:
      "Wires up ASP.NET Core's built-in JWT bearer authentication middleware and [Authorize] attributes to reject unauthenticated requests, without introducing token issuance or a session store.",
    variables: [
      {
        name: "jwtSecretEnvVar",
        prompt: "Environment variable name holding the JWT signing key",
        default: "Jwt__SigningKey",
      },
      {
        name: "protectedControllerName",
        prompt: "Name of the first controller/endpoint group to protect (e.g. OrdersController)",
        default: "OrdersController",
      },
    ],
  },
  artifacts: {
    proposal: `## Why

<!-- Fill in: {{protectedControllerName}} (or a specific new endpoint
group) is currently unauthenticated, or needs to become so. -->

## What Changes

- Register ASP.NET Core's built-in JWT bearer authentication
  (\`AddAuthentication().AddJwtBearer(...)\`) in \`Program.cs\`, reading the
  signing key from configuration bound to \`{{jwtSecretEnvVar}}\`.
- Add \`app.UseAuthentication()\` / \`app.UseAuthorization()\` to the request
  pipeline, in that order, before endpoint routing is reached.
- Add \`[Authorize]\` to \`{{protectedControllerName}}\` so its actions
  require a valid bearer token; a missing, invalid, or expired token
  results in the framework's standard 401 response.
- Leave token issuance (login endpoint, refresh tokens) explicitly out of
  scope — this adds verification only.

## Capabilities

### New Capabilities

- \`request-authentication\`: <fill in what this actually covers in your
  project>

## Impact

- Modified: \`Program.cs\` (authentication/authorization registration and
  middleware pipeline), \`{{protectedControllerName}}\` (\`[Authorize]\`
  attribute), \`appsettings.json\` (JWT configuration section placeholder —
  actual signing key stays in \`{{jwtSecretEnvVar}}\`, never committed).
- Dependencies: \`Microsoft.AspNetCore.Authentication.JwtBearer\`.
`,
    design: `## Context

<!-- Fill in: current auth state — no auth yet, or migrating from a
different scheme (cookie auth, API keys). -->

## Goals / Non-Goals

**Goals:**
- Every action on \`{{protectedControllerName}}\` rejects requests with a
  missing, malformed, or expired token before any action logic runs,
  using the framework's built-in pipeline rather than custom middleware.
- The verification failure reason (missing vs. expired vs. invalid
  signature) is distinguishable in logs, even though the client-facing
  response is the framework's uniform 401.

**Non-Goals:**
- Not implementing token issuance (login endpoint) or refresh-token
  rotation — this template covers verification of already-issued tokens
  only.
- Not choosing a claims schema beyond what verification itself needs
  (subject, expiry, issuer/audience if validated).

## Decisions

### Token transport: \`Authorization: Bearer <token>\` header, not a cookie

<!-- Fill in the actual reason for this project — default rationale:
header-based bearer tokens avoid CSRF concerns that cookie-based auth
requires separate mitigation for, at the cost of the client needing to
manage token storage itself. -->

### Authorization mechanism: declarative \`[Authorize]\` attributes, not a hand-written middleware function

ASP.NET Core's authentication/authorization pipeline already provides
per-token validation, claims population, and a standard 401/403 response
shape; a hand-written middleware (as the ecosystem-agnostic
\`jwt-auth-middleware\` template uses for other frameworks) would duplicate
what the framework already does idiomatically here.

## Risks / Trade-offs

- **[Risk]** A leaked \`{{jwtSecretEnvVar}}\` value lets an attacker mint
  arbitrary valid tokens. → **Mitigation**: treat it as a real secret (not
  committed, rotated on suspected leak); this template does not itself add
  secret-rotation tooling.
`,
    tasks: `## 1. Authentication registration

- [ ] 1.1 In \`Program.cs\`, call
  \`builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(...)\`,
  reading the signing key from configuration bound to
  \`{{jwtSecretEnvVar}}\`.
- [ ] 1.2 Add \`app.UseAuthentication();\` and \`app.UseAuthorization();\` to
  the middleware pipeline, before endpoint mapping.

## 2. Wiring

- [ ] 2.1 Add \`[Authorize]\` to \`{{protectedControllerName}}\` (or the
  specific actions that need it).
- [ ] 2.2 Confirm actions/controllers without \`[Authorize]\` remain
  unaffected.

## 3. Verification

- [ ] 3.1 Add a test confirming a request to \`{{protectedControllerName}}\`
  with no \`Authorization\` header is rejected with 401.
- [ ] 3.2 Add a test confirming a request with an expired token is
  rejected with 401.
- [ ] 3.3 Add a test confirming a request with a valid token reaches the
  action and the expected claims are available via \`HttpContext.User\`.
`,
  },
};
