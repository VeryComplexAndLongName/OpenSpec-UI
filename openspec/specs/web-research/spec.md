# web-research Specification

## Purpose
TBD - created by archiving change local-llm-web-research-tools. Update Purpose after archive.

## Requirements

### Requirement: Local models search through the configured aggregator

The `local-llm` and `local-llm-acp` agents SHALL offer a `search_web` tool
that queries only the SearXNG JSON endpoint configured by
`OPENSPEC_UI_SEARXNG_URL`. The tool SHALL return bounded JSON containing the
query, provider, retrieval timestamp, `trust: "untrusted"` and normalized results with title, URL,
snippet, and available engine and publication-date metadata. If the endpoint
is unset, unavailable, or returns invalid JSON, the tool SHALL return a
bounded actionable error without failing the whole agent run. Search results
SHALL be treated as untrusted data, not instructions.

#### Scenario: Search returns results

- **WHEN** a local model calls `search_web` and the configured SearXNG server
  returns valid JSON results
- **THEN** the tool returns normalized JSON with the query, retrieval time,
  result URLs and available source metadata

#### Scenario: Search is not configured

- **WHEN** a local model calls `search_web` and
  `OPENSPEC_UI_SEARXNG_URL` is unset
- **THEN** the tool reports that SearXNG must be configured, and the agent
  run remains able to continue

### Requirement: Local models fetch ordinary HTML as a JSON artifact

The `local-llm` and `local-llm-acp` agents SHALL offer a `fetch_webpage` tool
that returns bounded JSON with `trust: "untrusted"` containing the requested and final URL, UTC fetch
timestamp, HTTP status, content type, available title, description,
publication date and language, and extracted Markdown. Extraction SHALL
prefer `article`, then `main`, then `body`, and SHALL remove scripts, styles,
navigation and other non-content elements. Every data table SHALL be
written as a GitHub-flavored Markdown table, without its HTML attributes: a
cell spanning rows or columns SHALL be repeated into each place it covers,
leading rows of header cells SHALL become one header row whose cells join
their texts, and a table without header cells SHALL use its first row as the
header. A table of one column SHALL be read as ordinary text. The tool
SHALL fetch ordinary `text/html` only; it SHALL NOT execute scripts, render
JavaScript or fetch linked resources. Remote page content SHALL be identified
as untrusted data.

#### Scenario: A page contains an article and a table

- **WHEN** `fetch_webpage` receives a public HTML page with article content,
  navigation, scripts and a representable table
- **THEN** the artifact contains article Markdown and a Markdown table, omits
  navigation and scripts, and includes source URL and fetch timestamp

#### Scenario: A table with spans and two header rows

- **WHEN** a page holds a table whose first header cell spans two rows and
  whose next header cells span columns over a second header row
- **THEN** the artifact holds one Markdown table whose header joins the two
  rows per column, whose spanned cells are repeated, and which carries no
  HTML attribute

#### Scenario: Non-HTML response

- **WHEN** a page response is not `text/html`
- **THEN** the tool returns a bounded error

#### Scenario: A page larger than the byte bound

- **WHEN** a page response exceeds the configured byte bound
- **THEN** only its first bytes up to the bound are read, the artifact says
  `truncated: "page"`, and its Markdown ends with a line saying the page was
  cut; where the page fits but its Markdown exceeds the character bound, the
  artifact says `truncated: "markdown"`

### Requirement: Web tools cannot reach local services

`fetch_webpage` SHALL allow only HTTP(S) URLs without embedded credentials.
It SHALL refuse localhost, private, loopback, link-local and reserved
destinations, and SHALL validate each redirect destination before requesting
it. It SHALL cap redirects, response bytes, output characters and request
time. SearXNG results do not exempt a URL from this policy.

#### Scenario: A redirect targets a private address

- **WHEN** a public URL redirects to localhost or a private network address
- **THEN** the destination is refused before a request is sent to it

#### Scenario: A URL uses a non-web scheme or local destination

- **WHEN** `fetch_webpage` is called with a `file:` URL, URL credentials,
  localhost, or a private IP address
- **THEN** the tool refuses it without making a request
