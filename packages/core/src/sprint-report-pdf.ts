// Renders a SprintReport to a PDF buffer (see openspec/changes/
// add-sprint-report-pdf/design.md). Plain, structured layout — no
// tables/graphics/custom fonts, matching this project's existing
// "plain and functional over polished" bias (e.g. the multi-change
// timeline's plain-CSS-position choice over a charting library).

import PDFDocument from "pdfkit";
import type { SprintReport } from "./sprint-report.js";

// A plain static import: correct and sufficient for every plain-Node/ESM
// consumer (server, core's own tests). pdfkit's package.json "exports"
// resolves this to its ESM build (js/pdfkit.node.mjs), which needs real
// `import.meta.url` support -- something the VS Code extension's esbuild
// CJS bundle cannot provide (see build-options.mjs's `alias` entry for
// "pdfkit" in `extensionHostBuildOptions`, which redirects that one
// consumer to pdfkit's CommonJS build instead, at bundle time).

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
