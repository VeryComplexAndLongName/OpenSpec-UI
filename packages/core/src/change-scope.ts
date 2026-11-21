import { z } from "zod";
import type { SimpleGit } from "simple-git";

const MAX_BYTES = 64 * 1024;
const declaration = z.strictObject({ paths: z.array(z.string().min(1).max(500).refine((value) => {
  if (/[\\:*?[\]{}\p{Cc}\p{Zl}\p{Zp}]/u.test(value)) return false;
  const parts = value.replace(/\/$/u, "").split("/");
  return parts.every((part) => part !== "" && part !== "." && part !== "..");
})).max(256).refine((paths) => new Set(paths).size === paths.length) });

function literal(value: string): string {
  const safe = value.replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, " ");
  const fence = "`".repeat(Math.max(0, ...(safe.match(/`+/gu) ?? []).map((one) => one.length)) + 1);
  return `${fence} ${safe} ${fence}`;
}

/** Scope is reviewed data, not permission to write or proof of coverage. */
export function scopeSummary(change: string, current: string | undefined, previous: string | undefined, changed: readonly string[] | undefined): string[] {
  const lines = ["", "### Declared change scope", "",
    "- Advisory comparison of committed paths only; this does not enforce permissions or establish requirement completion."];
  if (current === undefined) return [...lines, "- No readable committed change-scope.json beside the proposal. Declared scope is unknown."];
  let paths: string[];
  try {
    if (Buffer.byteLength(current, "utf8") > MAX_BYTES) throw new Error("Declaration exceeds the limit");
    paths = declaration.parse(JSON.parse(current)).paths;
  } catch {
    return [...lines, "- change-scope.json is invalid or exceeds its limits. Declared scope is unknown."];
  }
  lines.push("- Using the declaration at the reviewed head, plus this change's own planning directory.");
  if (current !== previous) lines.push("- The declaration is new, changed or unreadable at the comparison base. Review its diff before treating these paths as agreed scope.");
  if (changed === undefined) return [...lines, "- The committed comparison is unavailable. Outside-scope paths could not be determined."];
  const own = `openspec/changes/${change}/`;
  const outside = [...new Set(changed)].filter((file) => !file.startsWith(own)
    && !paths.some((allowed) => allowed.endsWith("/") ? file.startsWith(allowed) : file === allowed));
  lines.push(`- Outside declared scope: ${outside.length} path${outside.length === 1 ? "" : "s"} in this comparison (both sides of renames are considered).`);
  lines.push(...outside.slice(0, 30).map((file) => `  - ${literal(file)}`));
  if (outside.length > 30) lines.push(`  - ${outside.length - 30} more outside paths.`);
  return lines;
}

async function committedDeclaration(git: SimpleGit, commit: string, change: string): Promise<string | undefined> {
  const object = `${commit}:openspec/changes/${change}/change-scope.json`;
  try {
    const size = Number((await git.raw(["cat-file", "-s", object])).trim());
    // Preserve an invalid outcome without reading an oversized blob into memory.
    if (!Number.isSafeInteger(size) || size < 0 || size > MAX_BYTES) return "!oversized declaration";
    return await git.raw(["show", object]);
  } catch { return undefined; }
}

export async function readScopeSummary(git: SimpleGit, change: string, head: string | undefined, base: string | undefined): Promise<string[]> {
  if (head === undefined) return scopeSummary(change, undefined, undefined, undefined);
  const [current, previous, names] = await Promise.all([
    committedDeclaration(git, head, change),
    base === undefined ? undefined : committedDeclaration(git, base, change),
    base === undefined ? undefined : git.raw(["diff", "--no-ext-diff", "--no-textconv", "--no-renames", "--name-only", "-z", base, head, "--"]).catch(() => undefined),
  ]);
  return scopeSummary(change, current, previous, names?.split("\0").filter(Boolean));
}
