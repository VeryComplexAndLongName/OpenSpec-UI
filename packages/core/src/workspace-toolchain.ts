import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { TextDecoder } from "node:util";
import { z } from "zod";
import { EXACT_TOOL_VERSION, type DetectedAgent } from "./agent-detection.js";
import type { Finding } from "./environment-report.js";

const TOOLCHAIN = "openspec/workbench-tools.json";
const relativePath = z.string().min(1).max(300).refine((value) => !/[:\\\p{Cc}\p{Zl}\p{Zp}]/u.test(value)
  && value.split("/").every((part) => part !== "" && part !== "." && part !== ".."));
const config = z.strictObject({
  openspecVersion: z.string().max(100).regex(EXACT_TOOL_VERSION).optional(),
  instructions: z.array(z.strictObject({ path: relativePath, sha256: z.string().regex(/^[a-f0-9]{64}$/u) })).max(32)
    .refine((files) => new Set(files.map((entry) => entry.path)).size === files.length).optional(),
});

async function readWorkspaceText(root: string, name: string, limit: number): Promise<string> {
  const file = path.resolve(root, name);
  if (path.relative(file, await realpath(file)) !== "") throw new Error("Symlinked files cannot be checked.");
  const info = await lstat(file);
  if (!info.isFile() || info.size > limit) throw new Error("The file is not a bounded regular file.");
  const bytes = await readFile(file);
  if (bytes.length > limit) throw new Error("The file exceeds the size limit.");
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function mismatch(id: string, statement: string, remedy: string): Finding {
  return { id, statement, remedy, severity: "worth-knowing" };
}

export async function readWorkspaceToolchain(workspaceRoot: string, detected: DetectedAgent): Promise<Finding[]> {
  const root = await realpath(workspaceRoot).catch(() => workspaceRoot);
  let expected: z.infer<typeof config>;
  try {
    expected = config.parse(JSON.parse(await readWorkspaceText(root, TOOLCHAIN, 16 * 1024)));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    return [mismatch("toolchain-declaration", "The workspace toolchain declaration is invalid or unreadable.",
      `Check ${TOOLCHAIN} for valid pins and repository-relative paths.`)];
  }
  const findings: Finding[] = [];
  if (expected.openspecVersion && expected.openspecVersion !== detected.version) {
    findings.push(mismatch("openspec-version-pin",
      `OpenSpec version: ${detected.version ?? "unavailable"}. The workspace expects ${expected.openspecVersion}.`,
      "Use the OpenSpec version declared by this workspace and run the diagnosis again."));
  }
  for (const entry of expected.instructions ?? []) {
    try {
      const contents = await readWorkspaceText(root, entry.path, 128 * 1024);
      const actual = createHash("sha256").update(contents.replace(/\r\n/gu, "\n"), "utf8").digest("hex");
      if (actual !== entry.sha256) findings.push(mismatch(`instruction-pin:${entry.path}`,
        `Instruction fingerprint differs for ${entry.path}. Expected ${entry.sha256}; found ${actual}.`,
        "Review the local instructions against the project's pinned version."));
    } catch (error) {
      findings.push(mismatch(`instruction-pin:${entry.path}`,
        `Instruction file ${entry.path} is ${(error as NodeJS.ErrnoException).code === "ENOENT" ? "missing" : "unsafe or unreadable"}.`,
        "Restore the project instruction file in this workspace."));
    }
  }
  return findings;
}
