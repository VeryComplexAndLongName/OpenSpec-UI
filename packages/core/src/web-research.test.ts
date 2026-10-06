import { describe, expect, it, vi } from "vitest";
import type { FetchLike } from "./direct-fetch.js";
import { fetchWebpage, runWebResearchTool, searchWeb } from "./web-research.js";

const now = () => new Date("2026-10-05T12:34:56.000Z");
const publicLookup = async () => [{ address: "93.184.216.34", family: 4 as const }];

function response(body: string, status = 200, headers: Record<string, string> = { "content-type": "text/html; charset=utf-8" }): Response {
    return new Response(body, { status, headers });
}

describe("web research", () => {
    it("normalizes SearXNG JSON with source metadata and UTC retrieval time", async () => {
        const fetch = vi.fn<FetchLike>().mockResolvedValue(response(JSON.stringify({
            results: [
                { title: "Example", url: "https://example.com/a", content: "A snippet", engine: "brave", publishedDate: "2026-10-04", score: 2 },
                { title: "Unsafe", url: "javascript:alert(1)", content: "ignored" },
            ]
        }), 200, { "content-type": "application/json" }));
        const artifact = await searchWeb("  query  ", { fetch, searxngUrl: "http://search.local:8080", now });
        expect(fetch.mock.calls[0]?.[0]).toBe("http://search.local:8080/search?q=query&format=json");
        expect(artifact).toEqual({
            kind: "web-search",
            trust: "untrusted",
            provider: "SearXNG",
            query: "query",
            fetchedAt: "2026-10-05T12:34:56.000Z",
            results: [{
                title: "Example", url: "https://example.com/a", snippet: "A snippet", engine: "brave",
                score: 2, publishedAt: "2026-10-04T00:00:00.000Z",
            }],
        });
    });

    it("reports missing search configuration without making a request", async () => {
        const fetch = vi.fn<FetchLike>();
        const result = await runWebResearchTool("search_web", { query: "test" }, { fetch });
        expect(result.failed).toBe(true);
        expect(result.output).toContain("OPENSPEC_UI_SEARXNG_URL");
        expect(fetch).not.toHaveBeenCalled();
    });

    it("extracts article text and GFM tables while removing page chrome and scripts", async () => {
        const html = `<!doctype html><html lang="en"><head><title>Fallback title</title>
      <meta property="og:title" content="Research page"><meta name="description" content="Summary">
      <meta property="article:published_time" content="2026-10-04T08:00:00Z"></head><body>
      <nav>Navigation noise</nav><main><header>Header noise</header><article><h1>Findings</h1>
      <p>Useful paragraph.</p><table><thead><tr><th>Name</th><th>Count</th></tr></thead>
      <tbody><tr><td>alpha</td><td>3</td></tr></tbody></table><script>doNotRun()</script>
      </article></main></body></html>`;
        const artifact = await fetchWebpage("https://example.com/report", {
            fetch: vi.fn<FetchLike>().mockResolvedValue(response(html)),
            lookupHost: publicLookup,
            now,
        });
        expect(artifact).toMatchObject({
            requestedUrl: "https://example.com/report",
            trust: "untrusted",
            finalUrl: "https://example.com/report",
            fetchedAt: "2026-10-05T12:34:56.000Z",
            title: "Research page",
            description: "Summary",
            publishedAt: "2026-10-04T08:00:00.000Z",
            language: "en",
        });
        expect(artifact.markdown).toContain("# Findings");
        expect(artifact.markdown).toContain("| Name | Count |");
        expect(artifact.markdown).toContain("| alpha | 3 |");
        expect(artifact.markdown).not.toMatch(/Navigation noise|Header noise|doNotRun/u);
    });

    it.each([
        "file:///etc/passwd",
        "https://user:secret@example.com/",
        "http://127.0.0.1/",
        "http://192.168.1.10/",
        "http://localhost/",
    ])("refuses unsafe URL %s before fetching", async (url) => {
        const fetch = vi.fn<FetchLike>();
        await expect(fetchWebpage(url, { fetch, lookupHost: publicLookup })).rejects.toThrow();
        expect(fetch).not.toHaveBeenCalled();
    });

    it("rejects a hostname with any non-public DNS answer", async () => {
        const fetch = vi.fn<FetchLike>();
        await expect(fetchWebpage("https://public.example.org/page", {
            fetch,
            lookupHost: async () => [
                { address: "93.184.216.34", family: 4 },
                { address: "10.0.0.4", family: 4 },
            ],
        })).rejects.toThrow("public IP addresses");
        expect(fetch).not.toHaveBeenCalled();
    });

    it("checks every redirect before requesting its destination", async () => {
        const fetch = vi.fn<FetchLike>()
            .mockResolvedValueOnce(response("", 302, { location: "http://127.0.0.1/admin" }))
            .mockResolvedValueOnce(response("private"));
        await expect(fetchWebpage("https://example.com/start", { fetch, lookupHost: publicLookup })).rejects.toThrow("public IP addresses");
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("rejects a non-HTML response", async () => {
        await expect(fetchWebpage("https://example.com/file", {
            fetch: vi.fn<FetchLike>().mockResolvedValue(response("pdf", 200, { "content-type": "application/pdf" })),
            lookupHost: publicLookup,
        })).rejects.toThrow("Expected HTML");
    });

    // local-llm-web-research-tools 4.4: a large page was refused whole; its
    // beginning is read instead, and the artifact says so.
    it("reads the first megabyte of a larger page, and says it did", async () => {
        const opening = "<html><body><main><h1>Start of a long page</h1><p>";
        const artifact = await fetchWebpage("https://example.com/large", {
            fetch: vi.fn<FetchLike>().mockResolvedValue(response(`${opening}${"x".repeat(1_200_000)}</p></main></body></html>`, 200, {
                "content-type": "text/html",
                "content-length": "1200100",
            })),
            lookupHost: publicLookup,
        });
        expect(artifact.truncated).toBe("page");
        expect(artifact.markdown).toContain("# Start of a long page");
        expect(artifact.markdown).toContain("only its first 1000000 bytes were read");
    });

    it("says when the Markdown, not the page, was cut", async () => {
        const artifact = await fetchWebpage("https://example.com/long", {
            fetch: vi.fn<FetchLike>().mockResolvedValue(response(`<html><body><main><p>${"long text ".repeat(5_000)}</p></main></body></html>`)),
            lookupHost: publicLookup,
        });
        expect(artifact.truncated).toBe("markdown");
    });

    it("still refuses an oversized search response, which is useless cut", async () => {
        await expect(searchWeb("query", {
            fetch: vi.fn<FetchLike>().mockResolvedValue(response("x".repeat(256_001), 200, { "content-type": "application/json" })),
            searxngUrl: "http://search.local:8080/search",
        })).rejects.toThrow("byte limit");
    });

    // local-llm-web-research-tools 4.4: a Wikipedia table with spans and two
    // header rows was kept as HTML with its ids and classes.
    it("writes a table with spans and two header rows as one GFM table, without attributes", async () => {
        const html = `<html><body><main><table class="wikitable" id="mwIA"><caption>ISO paper sizes</caption><tbody>
          <tr><th rowspan="2" id="h1">Size</th><th colspan="2">A series</th><th colspan="2">B series</th></tr>
          <tr><th>name</th><th>mm</th><th>name</th><th>mm</th></tr>
          <tr><th>0</th><td>A0</td><td>841 × 1189</td><td>B0</td><td>1000 × 1414</td></tr>
          <tr><th>1</th><td>A1</td><td>594 × 841</td><td rowspan="2">B1 | B2</td><td>707 × 1000</td></tr>
          <tr><th>2</th><td>A2</td><td>420 × 594</td><td>500 × 707</td></tr>
        </tbody></table></main></body></html>`;
        const artifact = await fetchWebpage("https://example.com/sizes", {
            fetch: vi.fn<FetchLike>().mockResolvedValue(response(html)),
            lookupHost: publicLookup,
        });
        expect(artifact.markdown).toContain("**ISO paper sizes**");
        expect(artifact.markdown).toContain("| Size | A series / name | A series / mm | B series / name | B series / mm |");
        expect(artifact.markdown).toContain("| --- | --- | --- | --- | --- |");
        expect(artifact.markdown).toContain("| 0 | A0 | 841 × 1189 | B0 | 1000 × 1414 |");
        expect(artifact.markdown).toContain("| 1 | A1 | 594 × 841 | B1 \\| B2 | 707 × 1000 |");
        expect(artifact.markdown).toContain("| 2 | A2 | 420 × 594 | B1 \\| B2 | 500 × 707 |");
        expect(artifact.markdown).not.toMatch(/<table|wikitable|mwIA|rowspan|colspan/u);
    });

    it("reads a table without header cells by its first row, and a one-column table as text", async () => {
        const html = `<html><body><main>
          <table><tr><td>Planet</td><td>Moons</td></tr><tr><td>Mars</td><td>2</td></tr></table>
          <table><tr><td><p>Layout <a href="https://example.com/x">link</a></p></td></tr></table>
        </main></body></html>`;
        const artifact = await fetchWebpage("https://example.com/plain", {
            fetch: vi.fn<FetchLike>().mockResolvedValue(response(html)),
            lookupHost: publicLookup,
        });
        expect(artifact.markdown).toContain("| Planet | Moons |\n| --- | --- |\n| Mars | 2 |");
        expect(artifact.markdown).toContain("Layout [link](https://example.com/x)");
        expect(artifact.markdown).not.toContain("| Layout");
    });

    it("returns valid bounded JSON when extracted page content exceeds the tool-result cap", async () => {
        const result = await runWebResearchTool("fetch_webpage", { url: "https://example.org/large" }, {
            fetch: vi.fn<FetchLike>().mockResolvedValue(response(`<html><body><main><p>${"long text ".repeat(8_000)}</p></main></body></html>`)),
            lookupHost: publicLookup,
            now,
        });
        expect(result.failed).toBe(false);
        expect(result.output.length).toBeLessThanOrEqual(40_000);
        expect(JSON.parse(result.output)).toMatchObject({ kind: "web-page", trust: "untrusted", markdown: expect.stringContaining("truncated") });
    });

    it("caps SearXNG results and reports malformed service responses as tool errors", async () => {
        const results = Array.from({ length: 14 }, (_, index) => ({ title: `Page ${index}`, url: `https://example.com/${index}` }));
        const artifact = await searchWeb("query", {
            fetch: vi.fn<FetchLike>().mockResolvedValue(response(JSON.stringify({ results }), 200, { "content-type": "application/json" })),
            searxngUrl: "http://search.local:8080/search",
            now,
        });
        expect(artifact.results).toHaveLength(10);

        const malformed = await runWebResearchTool("search_web", { query: "query" }, {
            fetch: vi.fn<FetchLike>().mockResolvedValue(response("not json", 200, { "content-type": "application/json" })),
            searxngUrl: "http://search.local:8080/search",
        });
        expect(malformed.failed).toBe(true);
        expect(malformed.output).toContain("Web research error");
    });
});