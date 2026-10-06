## 1. Decision and specification

- [x] 1.1 `docs/adr/0040-local-models-research-the-web.md` records the shared
  web-tool contract and SSRF policy; `docs/adr/README.md` indexes ADR 0040.
- [x] 1.2 `openspec/changes/local-llm-web-research-tools/proposal.md` and
  `design.md` name both capabilities, non-goals, rejected alternatives and
  compatibility; strict OpenSpec validation accepts the change.
- [x] 1.3 `openspec/changes/local-llm-web-research-tools/specs/web-research/spec.md`
  defines search and HTML artifact behavior; strict OpenSpec validation
  accepts its delta.
- [x] 1.4 `openspec/changes/local-llm-web-research-tools/specs/execution-core/spec.md`
  defines both adapters' additive tools and unchanged event contract; strict
  OpenSpec validation accepts its delta.

## 2. Shared web research

- [x] 2.1 `packages/core/src/web-research.ts` exports `searchWeb`,
  `fetchWebpage` and JSON artifact types; tests in `web-research.test.ts`
  verify SearXNG JSON normalization, metadata and UTC timestamps.
- [x] 2.2 `packages/core/src/web-research.ts` rejects unsupported schemes,
  credentials and private destinations, validates every redirect, and caps
  response size/time; `web-research.test.ts` covers each rejection and cap.
- [x] 2.3 `packages/core/src/web-research.ts` extracts ordinary HTML to
  Markdown and preserves GFM-representable tables; `web-research.test.ts`
  verifies article/main selection, removed scripts/navigation and table
  output.
- [x] 2.4 `packages/core/src/agents/local-agent/tools.ts` offers
  `search_web` and `fetch_webpage` schemas and dispatches both to core web
  research; `tools.test.ts` verifies both tools and their bounded JSON result.
- [x] 2.5 `packages/core/src/agents/local-agent/agent-loop.ts` passes the
  configured SearXNG endpoint and shared fetch to web tool execution;
  `agent-loop.test.ts` verifies the tool result returns to the model.

- [x] 2.6 Found in the owner's 4.4 check: `web-research.ts` writes every
  data table as GFM (spans repeated, header rows joined, no attributes,
  one-column tables as text) (design.md decision 6); `web-research.test.ts`
  covers a table with spans and two header rows, one without header cells
  and a layout table. Live: https://en.wikipedia.org/wiki/ISO_216 now gives
  "| Size | A series formats / name | A series formats / mm | ..." with no
  raw `<table`.
- [x] 2.7 Same check: a page over 1 MB is read up to the bound with
  `truncated: "page"`, and Markdown cut at its bound says
  `truncated: "markdown"` (decision 7); a search response over its bound is
  still refused. Three cases in `web-research.test.ts`, 18 passed. Live:
  https://en.wikipedia.org/wiki/List_of_tallest_buildings, refused before,
  now returns its first megabyte with 27 table rows and the note.
- [x] 2.8 Same check, in the DocsAI SearXNG on `hppii-tools`, not in this
  repository: every result came from DuckDuckGo, because `keep_only` keeps
  `bing` and `yandex` but the image's own settings disable both. `bing` is
  now enabled in `hppii-tools/searxng/settings.yml` there; `yandex` stays
  off, answering a direct `engines=yandex` with a parse error. After the
  change the same query returned results from both `bing` and `duckduckgo`.

## 3. Adapter integration

- [x] 3.1 `packages/core/src/agents/local-llm-acp.ts` passes web research
  configuration through to its in-process agent; `local-llm-acp.test.ts`
  verifies both web tools reach ACP tool-call updates.
- [x] 3.2 `packages/core/src/agents/local-llm.ts` runs a bounded completion
  loop offering only `search_web` and `fetch_webpage`; `local-llm.test.ts`
  verifies a tool call/result/follow-up turn and verifies no file or command
  tool is offered.
- [x] 3.3 `packages/core/src/default-runners.ts` resolves
  `OPENSPEC_UI_SEARXNG_URL` and threads it and the selected fetch through both
  adapter paths; `default-runners.test.ts` verifies configured and unset
  behavior.

## 4. Release and validation

- [x] 4.1 `packages/core/package.json` declares only the required HTML and
  Markdown parser dependencies; `package-lock.json` is consistent with the
  pinned npm version.
- [x] 4.2 `.changeset/local-llm-web-research-tools.md` proposes a minor
  `@openspec-ui/core` release for the additive agent tools.
- [x] 4.3 `packages/core` typecheck, lint and tests pass; root changeset and
  strict OpenSpec validation pass.
  `web-research.ts` references its ambient GFM declaration explicitly so
  importing workspaces also typecheck; `eslint.config.js` permits that
  path reference only for this file.
- [x] 4.4 **Human-only**: review rendered Markdown from at least one real
  SearXNG JSON response and one public HTML page; record the URLs and observed
  metadata/table result here before closing the change.
  Human review confirmed on 2026-10-06: "Everything OK."

### 4.4 Live evidence for human review

Verified on 2026-10-06 using Node 22.11.0 and this change worktree's
`searchWeb` and `fetchWebpage`, with real HTTP responses, not fixtures.
Human review of the rendered results was confirmed on 2026-10-06.

- Search URL: <http://192.168.137.39:8888/search?q=HTML+table+Markdown&format=json>.
  At `2026-10-06T13:58:25.796Z`, the normalized SearXNG artifact contained
  10 results with titles, URLs, snippets, engines (`bing`, `duckduckgo`) and
  scores. It recorded `provider: SearXNG` and `trust: untrusted`; publication
  dates were absent. Example: [HTML Tutorial - W3Schools](https://www.w3schools.com/html/),
  engine `bing`, score `1`; [HTML Table to Markdown](https://www.markdowntools.io/html-table-to-markdown),
  engine `duckduckgo`, score `1`. Search returns JSON, not page Markdown.
- HTML URL: <https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/MIME_types/Common_types>.
  At `2026-10-06T13:58:26.510Z`, the artifact recorded HTTP `200`,
  `text/html`, unchanged final URL, title `Common media types - HTTP | MDN`,
  language `en-US`, a description and extracted timestamp
  `2026-10-06T00:12:38.000Z`. The timestamp is extracted from the page, not
  independently verified as its publication date. Markdown contained 8,621
  characters and a three-column GFM table with 77 data rows; inline code
  and links survived conversion. A rendered excerpt follows.

| Extension | Kind of document | MIME Type |
| --- | --- | --- |
| `.aac` | AAC audio | `audio/aac` |
| `.abw` | [AbiWord](https://en.wikipedia.org/wiki/AbiWord) document | `application/x-abiword` |
| `.apng` | Animated Portable Network Graphics (APNG) image | `image/apng` |
| `.arc` | Archive document (multiple files embedded) | `application/x-freearc` |
