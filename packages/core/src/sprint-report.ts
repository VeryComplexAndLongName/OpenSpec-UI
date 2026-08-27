// Sprint summary report data (see
// openspec/changes/add-sprint-report-pdf/design.md): reuses
// getChangeTimeline/getChangeAuthorship unchanged for per-change data —
// this module only aggregates, it does not add any new git primitives.

import {
  getChangeAuthorship,
  getChangeTimeline,
  type ChangeTimelineRequestEntry,
  type CommitAuthor,
} from "./change-timeline.js";
import { discoverOpenSpecWorkspace } from "./workbench.js";

export interface SprintReportEntry {
  changeName: string;
  archived: boolean;
  createdDate: string | null;
  archivedDate: string | null;
  /** Plain-text excerpt of proposal.md's "## Why" section (markdown
   * syntax stripped, truncated) — not the rendered HTML/React output
   * `renderMarkdown` produces, since PDF rendering needs plain text. */
  whySummary: string;
  completedTaskCount: number;
  totalTaskCount: number;
  /** Tasks whose completion date falls within `[rangeStart, rangeEnd]`
   * — see design.md's date-range semantics: the range filters which
   * tasks count toward the sprint's stats, not which changes appear. */
  tasksCompletedInRange: number;
  primaryAuthor: CommitAuthor | null;
  contributors: CommitAuthor[];
}

export interface SprintReportAuthorStat {
  author: CommitAuthor;
  count: number;
}

export interface SprintReportStats {
  totalChanges: number;
  totalTasksCompletedInRange: number;
  /** Sorted by count descending. Keyed by `primaryAuthor.email` — a
   * change with no determinable primary author contributes to no
   * author's count (not silently attributed to anyone). */
  changesByAuthor: SprintReportAuthorStat[];
}

export interface SprintReport {
  rangeStart: string;
  rangeEnd: string;
  entries: SprintReportEntry[];
  stats: SprintReportStats;
}

const WHY_SECTION_RE = /##\s*Why\s*\n+([\s\S]*?)(?:\n##\s|\s*$)/i;
const MAX_WHY_SUMMARY_LENGTH = 400;

/** Best-effort plain-text summary of a proposal's "## Why" section (or
 * the whole document if no such heading exists) — strips the most
 * common markdown syntax (code spans, bold, links) rather than parsing
 * a full AST, since a report excerpt does not need perfect fidelity. */
function extractWhySummary(proposalMarkdown: string): string {
  const match = proposalMarkdown.match(WHY_SECTION_RE);
  const raw = (match?.[1] ?? proposalMarkdown).trim();
  const plain = raw
    .replaceAll(/`([^`]+)`/g, "$1")
    .replaceAll(/\*\*([^*]+)\*\*/g, "$1")
    .replaceAll(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replaceAll(/\s+/g, " ")
    .trim();
  if (plain.length <= MAX_WHY_SUMMARY_LENGTH) return plain;
  return `${plain.slice(0, MAX_WHY_SUMMARY_LENGTH).trimEnd()}…`;
}

function isWithinRange(date: string | null, rangeStartMs: number, rangeEndMs: number): boolean {
  if (!date) return false;
  const timestamp = new Date(date).getTime();
  return timestamp >= rangeStartMs && timestamp <= rangeEndMs;
}

export async function buildSprintReport(
  workspaceRoot: string,
  entries: ChangeTimelineRequestEntry[],
  rangeStart: string,
  rangeEnd: string,
): Promise<SprintReport> {
  const rangeStartMs = new Date(rangeStart).getTime();
  const rangeEndMs = new Date(rangeEnd).getTime();
  const workspace = await discoverOpenSpecWorkspace(workspaceRoot);

  const reportEntries = await Promise.all(
    entries.map(async (entry): Promise<SprintReportEntry> => {
      const change = (entry.archived ? workspace.archivedChanges : workspace.changes).find(
        (c) => c.name === entry.changeName,
      );
      const [timeline, authorship] = await Promise.all([
        getChangeTimeline(workspaceRoot, entry.changeName, entry.archived),
        change
          ? getChangeAuthorship(workspaceRoot, change.path)
          : Promise.resolve({ primaryAuthor: null, contributors: [] }),
      ]);
      const tasksCompletedInRange = timeline.tasks.filter((task) =>
        isWithinRange(task.date, rangeStartMs, rangeEndMs),
      ).length;

      return {
        changeName: timeline.changeName,
        archived: timeline.archived,
        createdDate: timeline.createdDate,
        archivedDate: timeline.archivedDate,
        whySummary: extractWhySummary(timeline.proposal),
        completedTaskCount: timeline.tasks.filter((task) => task.done).length,
        totalTaskCount: timeline.tasks.length,
        tasksCompletedInRange,
        primaryAuthor: authorship.primaryAuthor,
        contributors: authorship.contributors,
      };
    }),
  );

  const authorCounts = new Map<string, SprintReportAuthorStat>();
  for (const entry of reportEntries) {
    if (!entry.primaryAuthor) continue;
    const key = entry.primaryAuthor.email;
    const existing = authorCounts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      authorCounts.set(key, { author: entry.primaryAuthor, count: 1 });
    }
  }

  return {
    rangeStart,
    rangeEnd,
    entries: reportEntries,
    stats: {
      totalChanges: reportEntries.length,
      totalTasksCompletedInRange: reportEntries.reduce((sum, entry) => sum + entry.tasksCompletedInRange, 0),
      changesByAuthor: [...authorCounts.values()].sort((a, b) => b.count - a.count),
    },
  };
}
