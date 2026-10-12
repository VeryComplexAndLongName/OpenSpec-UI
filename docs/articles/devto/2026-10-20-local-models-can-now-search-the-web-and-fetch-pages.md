---
title: Local models can now search the web and fetch pages
published: false
description: Two new shared core tools, search_web and fetch_webpage, let local-model agents consult a SearXNG endpoint and retrieve HTML pages as Markdown. No remote agents are changed.
tags: openspec, ai, local-llm, opensource
cover_image: https://raw.githubusercontent.com/VeryComplexAndLongName/OpenSpec-UI/main/docs/articles/site/local-models-can-now-search-the-web-and-fetch-pages/cover.jpg
canonical_url: https://openspec-ui.dev/articles/local-models-can-now-search-the-web-and-fetch-pages/
---

*First published on [openspec-ui.dev](https://openspec-ui.dev/articles/local-models-can-now-search-the-web-and-fetch-pages/).*

OpenSpec Workbench puts local-model behavior and its security controls in
the shared core, but until now neither local adapter could search the web
or fetch a source page. Two new shared core tools have been added:
`search_web` and `fetch_webpage`. They let local-model agents consult a
SearXNG endpoint and retrieve HTML pages as Markdown-backed JSON artifacts
that can be analyzed or passed to another agent.

## What the tools do

`search_web` sends a query to a SearXNG JSON endpoint and returns the
results as structured data. `fetch_webpage` retrieves a public HTTP(S) URL,
converts the article or main content to Markdown, writes every data table
as a Markdown table, and returns provenance, page metadata and timestamps
in JSON.

Both tools are available to both local-model adapters: `local-llm` and
`local-llm-acp`. Remote agents are unchanged. The tools do not speak to
any vendor API; they speak only to the SearXNG instance you configure.

## Configuration and bounds

The single SearXNG instance is configured with the `OPENSPEC_UI_SEARXNG_URL`
environment variable. When search has not been configured, the tools return
an explicit error rather than failing silently or hanging.

Page fetching is restricted to bounded public HTTP(S) HTML. Pages larger
than the configured bound are read up to the bound and the response says
so. Remote content is treated as untrusted data throughout the pipeline.

## Why this matters for local models

A local model is only as useful as the information it can bring to bear.
Before these tools, a local agent could reason about what was already in
its context window, but it could not look up a current fact or read a
source page. Now it can search for context and fetch the page that
contains it, all without sending data to a remote API.

The tools return Markdown-backed JSON artifacts, not raw HTML. This means
the local model receives clean, structured content that fits into its
context window more efficiently, and that data tables are preserved as
Markdown tables rather than lost in markup noise.

## What this deliberately does not do

These tools are not a general-purpose web browser. They do not execute
JavaScript, they do not render CSS, and they do not interact with forms
or buttons. They search and fetch, convert to Markdown, and return. If a
page requires JavaScript to render its content, the fetch will return
whatever the server sends without execution.

They also do not change the command or event protocol. No new transport
channels are opened, no new agent types are introduced. The tools are
exposed through the existing local-model adapters, and the environment
configuration is read by the shared core runner.

## Try it

The code is at
[github.com/VeryComplexAndLongName/OpenSpec-UI](https://github.com/VeryComplexAndLongName/OpenSpec-UI),
where the repository and packages keep the name OpenSpec-UI.

```bash
OPENSPEC_UI_SEARXNG_URL=http://localhost:8080 openspec-ui-cli run --change my-change
```
