## Why

[ADR 0038](../../../docs/adr/0038-the-local-model-codes-in-the-product.md)
puts local-model behavior and its security controls in `packages/core`, but
neither local adapter can currently search the web or fetch a source page.
Users need both local-model adapters to consult one SearXNG JSON endpoint and
return ordinary HTML pages as Markdown-backed JSON artifacts that can be
analyzed or passed to another agent.

## What Changes

- Add `search_web` and `fetch_webpage` as shared core tools for `local-llm`
  and `local-llm-acp`.
- Configure the single SearXNG instance with `OPENSPEC_UI_SEARXNG_URL`; return
  an explicit error when search has not been configured.
- Restrict page fetching to bounded public HTTP(S) HTML, convert article/main
  content to Markdown, write every data table as a Markdown table, read a
  page larger than its bound up to the bound and say so, and return provenance,
  page metadata and timestamps in JSON.
- Keep remote content as untrusted data and leave all non-local agents
  unchanged.

## Capabilities

### New Capabilities

- `web-research`: bounded search and HTML-page retrieval for local model
  agents.

### Modified Capabilities

- `execution-core`: local model adapters expose the shared web tools without
  changing command/event kinds or granting `local-llm` repository tools.

## Impact

- `packages/core`: shared SearXNG client, public-URL/response bounds, HTML to
  Markdown conversion, and tool-loop integration for both local adapters.
- `packages/core/package.json`: HTML/Markdown parser dependencies.
- `docs/adr/0040-local-models-research-the-web.md`: new network security
  boundary and tool contract.
- No server, extension or web UI transport changes; environment configuration
  is read by the shared core runner.