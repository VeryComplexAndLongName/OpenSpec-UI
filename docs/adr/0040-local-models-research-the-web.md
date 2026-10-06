# 0040: Local Models Research the Web

Status: Accepted

Date: 2026-10-05

## Context

ADR 0038 puts local-model tools in `packages/core`, where their behavior,
limits and security can be tested, and keeps `local-llm` as the chat-only
adapter. Users now need both local model adapters to search the web through
one SearXNG instance and fetch ordinary HTML pages as Markdown artifacts for
analysis or handoff to another agent.

Fetching model-selected URLs crosses the existing working-directory-only
network boundary. Search results and page contents are untrusted input, and a
page must not be able to instruct the agent or reach a local service.

## Decision

1. **Put search and page-fetch behavior in `packages/core`.** Both
   `local-llm` and `local-llm-acp` expose the same `search_web` and
   `fetch_webpage` tools; adapters only drive their respective tool-call
   loops. No host-specific copy of this behavior is added.
2. **Use one configured SearXNG JSON endpoint.** The endpoint is configured
   with `OPENSPEC_UI_SEARXNG_URL`. Search is unavailable with an explicit
   tool error when it is unset; the feature does not select or fall back to
   other search providers.
3. **Only fetch public HTTP(S) HTML.** Reject credentials, unsupported
   schemes, localhost and non-public IP destinations. Validate each redirect
   independently, use bounded redirects, response size and time, and reject
   non-HTML responses. Do not execute JavaScript or fetch linked resources.
4. **Return a JSON artifact, not only extracted text.** Include requested and
   final URLs, fetch time, HTTP status, content type, available page metadata,
  and Markdown, with an explicit `trust: "untrusted"` marker. Write every
  data table as a GitHub-flavored Markdown table, spans repeated and stacked
  header rows joined, without HTML attributes. Bound text and result counts;
  read a page larger than its byte bound up to the bound and say so.
5. **Treat all remote text as untrusted data.** Tool descriptions and results
   identify remote content as data; page instructions never alter execution
   policy, allowlists, working directories or permissions.

## Rejected Alternatives

- **Give the web tools to every agent.** Rejected: the request is specifically
  for the local-model adapters, and broadening every adapter's network surface
  adds unrelated behavior and risk.
- **Use a browser or render JavaScript.** Rejected for this first version:
  ordinary HTML is the agreed scope; rendering adds an execution surface,
  resource loading and substantially more operational cost.
- **Let the model choose a search endpoint or fetch arbitrary schemes.**
  Rejected: the search service is a host configuration, and unrestricted URL
  fetching would allow local-service access and non-web protocols.
- **Return only Markdown.** Rejected: downstream agents and audit consumers
  need stable provenance and timing metadata alongside the readable content.

## Consequences

- `local-llm` gains a bounded function-call loop for web tools only; it does
  not gain repository editing or command execution tools.
- `local-llm-acp` adds the same web tools to its existing local tool loop.
- The product introduces outbound requests to a configured search service and
  public web pages. Page requests use a pinned connection to a validated
  public IP; DNS rebinding and redirect handling are covered by the fetch
  policy and tests. Remote content remains untrusted.
- Search requires a SearXNG instance and an explicit URL. Page fetching does
  not require the search service.
- No command or event kind changes. Existing hosts continue to receive the
  existing event protocol.