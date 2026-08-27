// Renders a SprintReport to a PDF buffer (see openspec/changes/
// add-sprint-report-pdf/design.md). Plain, structured layout — no
// tables/graphics/custom fonts, matching this project's existing
// "plain and functional over polished" bias (e.g. the multi-change
// timeline's plain-CSS-position choice over a charting library).

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import type PDFKitDocument from "pdfkit";
import type { SprintReport } from "./sprint-report.js";

// pdfkit's package.json "exports" map points `import` at an ESM build
// (js/pdfkit.node.mjs) that uses real `import.meta.url` syntax. When
// esbuild bundles this package to a single CJS file (the VS Code
// extension host build), it cannot preserve `import.meta.url` and
// substitutes an empty object, which crashes that ESM build at load
// time ("TypeError: Invalid URL") -- breaking extension activation
// entirely, even though nothing calls PDF/A features that need it.
// Requiring "pdfkit" instead resolves the package's `require`
// condition (js/pdfkit.js), a genuinely CommonJS build that reads
// `__filename` instead, which esbuild *can* shim correctly for a
// node/cjs bundle. `__filename` is unavailable in this file's own
// plain-ESM runtime (server/core, unbundled) instead, hence the
// `typeof` guard -- safe because `typeof` never throws on an
// undeclared identifier.
declare const __filename: string | undefined;
const require = createRequire(
  typeof __filename !== "undefined" ? __filename : fileURLToPath(import.meta.url),
);
const PDFDocument = require("pdfkit") as typeof PDFKitDocument;

function formatDate(date: string | null): string {
  return date ? new Date(date).toLocaleDateString() : "unknown";
}

function formatAuthor(author: SprintReport["entries"][number]["primaryAuthor"]): string {
  return author ? `${author.name} <${author.email}>` : "unknown";
}

/** Renders `report` to a PDF and resolves with the complete file as a
 * `Buffer` — pdfkit has no built-in promise/buffer API, so this pipes
 * its output stream through a collector and buffers on `"end"`, the
 * standard pattern for this library. */
export async function renderSprintReportPdf(report: SprintReport): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.fontSize(20).text("Sprint Summary", { align: "left" });
  doc
    .fontSize(11)
    .fillColor("#555555")
    .text(`${formatDate(report.rangeStart)} — ${formatDate(report.rangeEnd)}`);
  doc.fillColor("#000000").moveDown(1.5);

  if (report.entries.length === 0) {
    doc.fontSize(12).text("No changes in this report.");
  }

  for (const entry of report.entries) {
    doc.fontSize(14).text(entry.changeName, { continued: false });
    doc
      .fontSize(10)
      .fillColor("#555555")
      .text(
        `${entry.archived ? "Archived" : "Active"} · Created ${formatDate(entry.createdDate)}` +
          (entry.archived ? ` · Archived ${entry.archivedDate ?? "unknown"}` : ""),
      )
      .text(`Author: ${formatAuthor(entry.primaryAuthor)}`)
      .text(
        `Tasks: ${entry.completedTaskCount}/${entry.totalTaskCount} completed` +
          ` (${entry.tasksCompletedInRange} within this sprint)`,
      );
    doc.fillColor("#000000").moveDown(0.3);
    if (entry.whySummary) {
      doc.fontSize(10).text(entry.whySummary, { align: "left" });
    }
    doc.moveDown(1);
  }

  doc.addPage();
  doc.fontSize(16).text("Statistics");
  doc.moveDown(0.5);
  doc.fontSize(11).text(`Changes: ${report.stats.totalChanges}`);
  doc.text(`Tasks completed within this sprint: ${report.stats.totalTasksCompletedInRange}`);
  doc.moveDown(0.5);
  if (report.stats.changesByAuthor.length > 0) {
    doc.fontSize(12).text("By author:");
    for (const { author, count } of report.stats.changesByAuthor) {
      doc.fontSize(10).text(`${author.name} <${author.email}>: ${count} change${count === 1 ? "" : "s"}`);
    }
  }

  doc.end();
  return done;
}
