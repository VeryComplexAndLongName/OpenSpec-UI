// The sprint report, as a page of the product
// (the-sprint-report-is-a-page-of-the-product).
//
// The report is the one thing this product makes that leaves it: it goes
// to whoever asked how the sprint went, and it is the only page of the
// product they will ever see. Until now it was drawn by pdfkit in
// Helvetica on white, in a look this product uses nowhere else, and that
// library cost core a dependency and the extension's bundle a special
// case.
//
// So it is drawn here, with the same stylesheets every other surface is
// drawn with, and the PDF comes from the browser's own print. The
// figures are core's and are not touched: this takes a SprintReport and
// returns characters.
//
// A string, not a component: nothing on this page is interacted with. A
// component would need a renderer at both call sites - a server that
// renders no React, and an extension command that writes a file - to
// produce the same characters.

import type { SprintReport, SprintReportEntry } from "@openspec-ui/core/browser";
import { metroCss } from "./metro-css.generated.js";
import { metroIconsCss } from "./metro-icons.generated.js";
import { shellThemeCss } from "./shell-ui.js";

/** Everything that comes from the repository goes through this. A change
 * name, a commit author and a summary excerpt are text, and a report
 * that quietly rendered one of them as markup would be a report that
 * lies about what is in the repository. */
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(date: string | null): string {
  if (!date) return "unknown";
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? "unknown" : parsed.toISOString().slice(0, 10);
}

function formatAuthor(author: SprintReportEntry["primaryAuthor"]): string {
  return author ? `${author.name} <${author.email}>` : "unknown";
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/** The rules the product's own sheet has no reason to carry: the report's
 * own layout, and what the page becomes on paper. */
const REPORT_CSS = `
  body {
    margin: 0;
    padding: 32px 24px 64px;
    background: var(--bg);
    color: var(--ink);
  }

  .openspec-report {
    max-width: 900px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .openspec-report-head h1 {
    margin: 0;
    color: var(--heading);
  }

  .openspec-report-range {
    color: var(--muted);
  }

  .openspec-report-entry {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .openspec-report-entry h2 {
    margin: 0;
    font-size: 16px;
    color: var(--heading);
  }

  .openspec-report-facts {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
    color: var(--muted);
    font-size: 13px;
  }

  .openspec-report-why {
    margin: 0;
    white-space: pre-wrap;
  }

  .openspec-report-authors {
    margin: 8px 0 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  /* On paper: no ground, no shadows, and a change is not cut in half by
     a page break. The person printing chooses the paper and the margins,
     which is why only the page margin is set here. */
  @media print {
    @page {
      margin: 16mm;
    }

    body {
      background: #ffffff;
      padding: 0;
    }

    .openspec-panel,
    .openspec-report-entry {
      box-shadow: none;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .openspec-report-print {
      display: none;
    }
  }
`;

function renderEntry(entry: SprintReportEntry): string {
  // The product's own state badge, under the classes that carry its hue:
  // `badge` alone draws no block outside a row.
  const state = entry.archived
    ? '<span class="openspec-change-state">Archived</span>'
    : '<span class="openspec-change-state openspec-change-state--in-progress">Active</span>';
  const archived = entry.archived ? `<span>Archived ${escapeHtml(formatDate(entry.archivedDate))}</span>` : "";
  const why = entry.whySummary
    ? `<p class="openspec-report-why">${escapeHtml(entry.whySummary)}</p>`
    : "";
  return `      <section class="openspec-panel openspec-report-entry">
        <h2>${escapeHtml(entry.changeName)}</h2>
        <div class="openspec-report-facts">
          ${state}
          <span>Created ${escapeHtml(formatDate(entry.createdDate))}</span>
          ${archived}
          <span>${escapeHtml(formatAuthor(entry.primaryAuthor))}</span>
          <span>${entry.completedTaskCount}/${entry.totalTaskCount} tasks done, ${entry.tasksCompletedInRange} in this sprint</span>
        </div>
        ${why}
      </section>`;
}

function renderStats(report: SprintReport): string {
  const byAuthor = report.stats.changesByAuthor
    .map(({ author, count }) =>
      `          <li>${escapeHtml(`${author.name} <${author.email}>`)}: ${count} ${plural(count, "change", "changes")}</li>`)
    .join("\n");
  const authors = byAuthor
    ? `        <h3>By author</h3>
        <ul class="openspec-report-authors">
${byAuthor}
        </ul>`
    : "";
  return `      <section class="openspec-panel openspec-report-entry">
        <h2>Statistics</h2>
        <div class="openspec-report-facts">
          <span>${report.stats.totalChanges} ${plural(report.stats.totalChanges, "change", "changes")}</span>
          <span>${report.stats.totalTasksCompletedInRange} ${plural(report.stats.totalTasksCompletedInRange, "task", "tasks")} completed within this sprint</span>
        </div>
${authors}
      </section>`;
}

/** One complete HTML document for one sprint summary. It carries its
 * styles, so it can be opened from a file with no server: the extension
 * writes it to disk, and the standalone hands it to a tab. */
export function renderSprintReportPage(report: SprintReport): string {
  const range = `${escapeHtml(formatDate(report.rangeStart))} to ${escapeHtml(formatDate(report.rangeEnd))}`;
  const entries = report.entries.length === 0
    ? `      <section class="openspec-panel openspec-report-entry">
        <p class="openspec-report-why">No changes in this report.</p>
      </section>`
    : report.entries.map(renderEntry).join("\n");

  return documentOf(`Sprint summary, ${range}`, `    <header class="openspec-panel openspec-report-head">
      <h1>Sprint summary</h1>
      <p class="openspec-report-range">${range}</p>
      <button type="button" class="button openspec-report-print" onclick="window.print()">Print, or save as PDF</button>
    </header>
${entries}
${renderStats(report)}`);
}

/** The page the report's tab shows before the report is ready, or
 * instead of it when it could not be made.
 *
 * The tab is opened by the click that asks for the report, before the
 * request: a browser lets a page open a tab only while it is answering
 * a click, and a report over the whole archive takes a minute. Opened
 * after the request, it was refused with nothing to show for the wait
 * (the-sprint-report-reads-like-the-timeline). */
export function renderSprintReportNotice(heading: string, message: string): string {
  return documentOf(escapeHtml(heading), `    <header class="openspec-panel openspec-report-head">
      <h1>${escapeHtml(heading)}</h1>
      <p class="openspec-report-range">${escapeHtml(message)}</p>
    </header>`);
}

function documentOf(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
${metroCss}
${metroIconsCss}
${shellThemeCss}
${REPORT_CSS}
</style>
</head>
<body>
  <main class="openspec-report">
${body}
  </main>
</body>
</html>
`;
}
