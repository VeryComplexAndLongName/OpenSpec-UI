import type { CatalogTemplate } from "../template-catalog.js";

// Deliberately narrow — the well-established core migration steps
// (app factory to ASGI app, decorator-based routes to path operation
// functions, request/response validation), not a claimed complete guide
// to every Flask feature's FastAPI equivalent.

export const flaskToFastapi: Omit<CatalogTemplate, "origin"> = {
  manifest: {
    id: "flask-to-fastapi",
    title: "Migrate a Flask app to FastAPI",
    category: "framework-migration",
    version: "1.0.0",
    summary:
      "Replaces a Flask WSGI application with an equivalent FastAPI ASGI application: app factory, routes, and request/response validation.",
    variables: [
      {
        name: "packageName",
        prompt: "Python package/module name for the application (e.g. app)",
        default: "app",
      },
      {
        name: "asgiServer",
        prompt: "ASGI server to run the app (e.g. uvicorn)",
        default: "uvicorn",
      },
    ],
  },
  artifacts: {
    proposal: `## Why

<!-- Fill in: what forces this change now — need for async request
handling, automatic OpenAPI docs, typed request/response validation, or
a specific Flask limitation being hit. -->

## What Changes

- Replace the Flask \`create_app()\` factory with an equivalent FastAPI
  \`app = FastAPI()\` instance in \`{{packageName}}/main.py\`.
- Convert each \`@app.route(...)\` view function to a FastAPI path
  operation function (\`@app.get\`/\`@app.post\`/etc.), replacing manual
  \`request.get_json()\`/\`request.args\` access with typed Pydantic request
  models and query/path parameters.
- Replace Flask's \`jsonify(...)\` responses with returned Pydantic
  response models (FastAPI serializes them automatically).
- Switch the run command from the WSGI server (e.g. \`flask run\` /
  gunicorn+Flask) to \`{{asgiServer}}\`.

## Capabilities

### Modified Capabilities

- \`http-api\`: <fill in what this actually covers in your project — the
  same routes now served by FastAPI instead of Flask>

## Impact

- New: \`{{packageName}}/main.py\` (FastAPI app + routes), Pydantic
  request/response models per endpoint.
- Removed: Flask app factory and \`@app.route\` view functions, once every
  route has a FastAPI equivalent.
- Dependencies: \`fastapi\`, \`{{asgiServer}}\` (add); Flask can be removed
  once migration is complete.
`,
    design: `## Context

<!-- Fill in: current Flask app structure (blueprints? single module?),
number of routes, any Flask-specific middleware/extensions in use
(Flask-Login, Flask-SQLAlchemy, etc.) that also need a FastAPI
equivalent or replacement. -->

## Goals / Non-Goals

**Goals:**
- Every existing route has a working FastAPI equivalent with the same
  external behavior (status codes, response shape) before the Flask app
  is removed.
- Request/response validation becomes explicit (Pydantic models) instead
  of manual dict access.

**Non-Goals:**
- Not migrating background job/task infrastructure (Celery, etc.) unless
  it specifically depends on the Flask app context — that is a separate
  decision if it applies to this project.
- Not adopting FastAPI's dependency-injection system beyond what request
  validation and the target route set actually need.

## Decisions

### Migration order: route-by-route behind the same URL prefix, not a big-bang rewrite

<!-- Fill in — e.g. run both apps side by side during migration via a
reverse-proxy path split, or migrate one blueprint at a time. Rejected
alternatives and why. -->

### Auth/session handling: <fill in — e.g. FastAPI dependency replacing Flask-Login's \`current_user\`>

<!-- Rejected alternatives and why. -->

## Risks / Trade-offs

- **[Risk]** Flask's implicit request context (\`flask.g\`, \`flask.request\`
  accessed anywhere) has no FastAPI equivalent — every such access must
  become an explicit parameter or dependency. → **Mitigation**: migrate
  and test one route at a time rather than assuming behavior carries over
  unchanged.
`,
    tasks: `## 1. FastAPI app setup

- [ ] 1.1 Add \`{{packageName}}/main.py\` with \`app = FastAPI()\`,
  replacing the Flask app factory.
- [ ] 1.2 Add \`{{asgiServer}}\` as the run command; confirm the app starts
  and serves the auto-generated \`/docs\` page.

## 2. Route migration

- [ ] 2.1 For each Flask route, add the equivalent FastAPI path operation
  function with typed parameters and a Pydantic response model.
- [ ] 2.2 Replace manual \`request.get_json()\`/\`request.args\` access with
  Pydantic request models / FastAPI query/path parameters.
- [ ] 2.3 Confirm each migrated route's status codes and response shape
  match the original Flask route (existing tests, or new ones covering
  the same cases).

## 3. Cutover

- [ ] 3.1 Remove the Flask app factory and \`@app.route\` functions once
  every route has a passing FastAPI equivalent.
- [ ] 3.2 Remove the Flask dependency and WSGI server from the project.

## 4. Verification

- [ ] 4.1 Run the full existing test suite against the FastAPI app and
  confirm no regressions in response status/shape for any migrated route.
`,
  },
};
