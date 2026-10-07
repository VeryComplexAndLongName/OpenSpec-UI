## Context

`local-llm` currently streams one chat completion without tools.
`local-llm-acp` already has a bounded tool loop and emits tool calls/results
through ACP updates. Both use the same OpenAI-compatible local model endpoint
and core-owned runner configuration. See [ADR
0040](../../../docs/adr/0040-local-models-research-the-web.md).

## Goals / Non-Goals

**Goals:**

- Offer identical `search_web` and `fetch_webpage` tools to both local model
  adapters.
- Use only the configured SearXNG JSON endpoint for search.
- Return bounded JSON page artifacts with Markdown, metadata and UTC
  timestamps; write every data table as a Markdown table.
- Restrict fetches to public HTTP(S) HTML and test the rejection paths.
- Keep `local-llm` restricted to web tools; do not expose its ACP coding tools.

**Non-Goals:**

- JavaScript execution, browser automation, PDF or other non-HTML extraction.
- Multiple search providers, ranking customization or host UI settings.
- Changes to the command/event protocol, non-local agents or transport APIs.
- A separate artifact store; the JSON result is the transferable artifact.

## Decisions

1. **One core web-research module with adapter-specific loops.** The module
   owns schemas, SearXNG normalization, URL policy, extraction and JSON
   artifacts. ACP reuses its existing loop. Direct `local-llm` uses the
   existing OpenAI-compatible completion parser with only the two web tools.
   Rejected: giving direct `local-llm` the ACP filesystem and shell tools,
   which would change its security contract.
2. **SearXNG is configured by `OPENSPEC_UI_SEARXNG_URL`.** Treat the value as
   the server base URL and request its JSON search endpoint. A missing or
   invalid setting is a tool-level configuration error, not a run failure.
   Rejected: a silent public fallback or model-provided endpoint, neither of
   which is predictable or safe.
3. **Use an explicit public-web policy.** Allow only HTTP and HTTPS without
   URL credentials; reject localhost, private, loopback, link-local and
   reserved destinations; validate redirect targets; bound redirect count,
   timeout and bytes; accept only `text/html`. Rejected: trusting a URL just
   because it appeared in SearXNG results.
4. **Extract readable HTML without executing it.** Remove scripts, styles,
   navigation and other non-content elements; prefer `article` then `main`,
   falling back to `body`; convert with a Markdown converter that supports
   GFM tables. Rejected: a headless browser, which runs page code and fetches
   additional resources.
5. **Return structured JSON with content provenance.** Include requested and
   final URL, fetch timestamp, HTTP/content-type data, title, description,
   publication time where present, language where available, and Markdown.
   Search results include query, provider, retrieval timestamp, title, URL,
   snippet and available engine/date metadata. Rejected: bare text, which
   loses source and timing information during agent handoff.
6. **Every data table becomes a GFM table** (found in the owner's 4.4 check,
   2026-10-06). The GFM plugin converts only tables it can represent and
   keeps the rest as raw HTML, attributes included: a Wikipedia table with
   `rowspan`/`colspan` and two header rows came through as HTML with every
   `id`, `class` and `rel`, and filled the Markdown budget. The module writes
   tables itself: spans are repeated into the cells they cover, leading
   header rows join per column ("A series / mm"), a table without header
   cells uses its first row, a nested table is read as its cell's text, a
   cell is cut at 300 characters, and a table of one column (layout) is read
   as ordinary text. Rejected: stripping attributes and keeping HTML, which
   still costs the model markup it has to read through.
7. **A page larger than the byte bound is read up to it** (same check: a
   large Wikipedia list was refused whole). The first `MAX_PAGE_BYTES` are
   parsed, the artifact carries `truncated: "page"` and its Markdown ends with
   a line saying so; Markdown cut at the character bound carries
   `truncated: "markdown"`. A search response is still refused when too
   large: cut JSON cannot be read.
8. **Do not change protocol events.** Existing ACP tool updates and the
   existing `stdout`/`progress` event kinds carry results. No command or event
   kind is added or changed; server and extension adapters remain compatible.

## Risks / Trade-offs

- Remote HTML and search results can contain prompt injection. They remain
  data, are clearly labeled as untrusted, and cannot affect core policy.
- URL validation and redirect validation reduce SSRF exposure; DNS answers
  and redirect behavior need tests, and the implementation must not follow
  redirects automatically before checking their destinations.
- Public pages can be large or malformed. Time, byte, redirect, result and
  output limits bound what is read; a page cut at the byte bound says so,
  and extraction is best-effort.
- Tool-call support varies by local model server. Unsupported calls remain
  subject to the existing text tool-call parser, and models without either
  form simply do not invoke the tools.
- SearXNG is a user-operated dependency. Search reports a clear configuration
  error when unavailable; `fetch_webpage` still works independently.

## Migration Plan

Ship additively. Existing agent IDs, settings and harness files continue to
work. `local-llm` sends tool definitions in its completion requests and uses a
bounded loop only when the model returns one of the offered web tools.

## Open Questions

- None for the first version; JavaScript-rendered pages and non-HTML formats
  remain explicitly out of scope.