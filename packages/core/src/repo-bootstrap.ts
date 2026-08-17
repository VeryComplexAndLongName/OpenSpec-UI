import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// See openspec/changes/repo-bootstrap-snippets/design.md. Two different
// ownership mechanisms on purpose: section markers for prose files
// (CLAUDE.md/AGENTS.md/*.instructions.md — user content coexists below
// the managed block), a whole-file first-line marker for dependabot.yml
// (structured YAML — no in-place block merging). Content is deliberately
// narrow (two seed project types, matching the two ecosystems the
// built-in template catalog already has real content for) — not a
// claimed comprehensive style guide.

export type BootstrapProjectType = "node" | "python";
export type BootstrapSubtype = "backend" | "frontend" | "general";

export type ManagedFileStatus = "created" | "updated" | "skipped-foreign";

const SECTION_START = "<!-- openspec-ui:managed start -->";
const SECTION_END = "<!-- openspec-ui:managed end -->";
const DEPENDABOT_MARKER =
  "# managed-by: openspec-ui — regenerate via the \"Configure Dependabot\" command; hand-edits will make this file no longer be touched by it.";

interface ProjectTypeContent {
  label: string;
  agentInstructions: string;
  dependabotEcosystem: string;
  subtypeInstructions: Record<BootstrapSubtype, string>;
}

const CONTENT: Record<BootstrapProjectType, ProjectTypeContent> = {
  node: {
    label: "Node.js / TypeScript",
    agentInstructions: `# Node.js / TypeScript Guidelines

- Prefer ESM; do not mix ESM and CommonJS in the same package unless it
  already does.
- Treat lint and type errors as blocking, not advisory — run the
  project's own lint/typecheck/test scripts before considering a change
  complete.
- Do not add a dependency for something the standard library or an
  already-present dependency already covers.
- Never hand-edit the lockfile; let the package manager regenerate it.
- Prefer native \`fetch\`/\`async\`/\`await\` over adding a request or
  promise library unless the project already depends on one.`,
    dependabotEcosystem: "npm",
    subtypeInstructions: {
      backend: `## Backend-specific notes

- Validate and sanitize input at every external boundary (HTTP request
  bodies, query params, env vars) — never trust client-supplied data.
- Avoid blocking the event loop with synchronous I/O or CPU-heavy work
  in a request handler.
- Log with structured fields (not string concatenation) so logs stay
  queryable.`,
      frontend: `## Frontend-specific notes

- Do not fetch or mutate state directly inside a render function —
  fetch in an effect/loader, render from state.
- Keep components accessible: semantic HTML elements, labeled form
  controls, keyboard-operable interactive elements.
- Avoid unnecessary re-renders — memoize expensive derived values, not
  everything by default.`,
      general: `## General notes

No subtype-specific additions beyond the shared guidelines above.`,
    },
  },
  python: {
    label: "Python",
    agentInstructions: `# Python Guidelines

- Add type hints to new and changed public functions.
- Run the project's actual virtual environment/tool (uv, poetry, or
  pip+venv) — never assume a global \`python\` on \`PATH\` has the right
  dependencies installed.
- Run the project's own formatter/linter (e.g. black/ruff, whatever this
  project's own config already specifies) before considering a change
  complete.
- Prefer the standard library over a new dependency for something it
  already covers.
- Write tests with the project's existing test framework (pytest, unless
  the project has already established otherwise) rather than introducing
  a second one.`,
    dependabotEcosystem: "pip",
    subtypeInstructions: {
      backend: `## Backend-specific notes

- Validate and sanitize input at every external boundary (request
  bodies, query params, env vars) — never trust client-supplied data.
- Schema changes go through the project's migration tool — no
  \`create_all()\`/\`sync_db()\`-style implicit schema changes in
  application startup.
- If the framework is async, do not perform blocking I/O inside an
  async handler.`,
      frontend: `## Frontend/rendering-layer notes

- Keep templates/rendering logic free of business logic — compute values
  in the view/handler, not inside the template.
- Escape user-supplied content by default; only mark content safe/raw
  when it is genuinely already sanitized.`,
      general: `## General notes

No subtype-specific additions beyond the shared guidelines above.`,
    },
  },
};

export function listBootstrapProjectTypes(): Array<{ id: BootstrapProjectType; label: string }> {
  return (Object.keys(CONTENT) as BootstrapProjectType[]).map((id) => ({ id, label: CONTENT[id].label }));
}

function renderManagedBlock(body: string): string {
  return `${SECTION_START}\n${body.trimEnd()}\n${SECTION_END}\n`;
}

/** Writes `frontmatter + managed block` to `filePath`. If the file
 * doesn't exist, creates it. If it exists and starts with exactly
 * `frontmatter + SECTION_START`, replaces the managed block only,
 * preserving everything after the end marker verbatim. Otherwise the
 * file is "foreign" — left untouched. See design.md, "A file without our
 * marker is foreign, full stop." */
async function writeManagedFile(filePath: string, frontmatter: string, body: string): Promise<ManagedFileStatus> {
  const block = renderManagedBlock(body);
  const ownedPrefix = frontmatter + SECTION_START;

  let existing: string | undefined;
  try {
    existing = await readFile(filePath, "utf8");
  } catch {
    existing = undefined;
  }

  if (existing === undefined) {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, frontmatter + block, "utf8");
    return "created";
  }

  if (!existing.startsWith(ownedPrefix)) return "skipped-foreign";
  const endMarkerIndex = existing.indexOf(SECTION_END);
  if (endMarkerIndex === -1) return "skipped-foreign";

  const after = existing.slice(endMarkerIndex + SECTION_END.length);
  await writeFile(filePath, frontmatter + block + after, "utf8");
  return "updated";
}

export interface AgentInstructionsResult {
  claude: ManagedFileStatus;
  agents: ManagedFileStatus;
}

/** Writes identical content into both CLAUDE.md and AGENTS.md — no
 * cross-file link (see design.md, "Agent instructions are written fully
 * into both..."). Each file's ownership is checked/written
 * independently. */
export async function writeAgentInstructions(
  workspaceRoot: string,
  projectType: BootstrapProjectType,
): Promise<AgentInstructionsResult> {
  const body = CONTENT[projectType].agentInstructions;
  const [claude, agents] = await Promise.all([
    writeManagedFile(path.join(workspaceRoot, "CLAUDE.md"), "", body),
    writeManagedFile(path.join(workspaceRoot, "AGENTS.md"), "", body),
  ]);
  return { claude, agents };
}

export async function writeSubtypeInstructions(
  workspaceRoot: string,
  projectType: BootstrapProjectType,
  subtype: BootstrapSubtype,
): Promise<ManagedFileStatus> {
  const frontmatter = `---\napplyTo: "**"\n---\n\n`;
  const body = CONTENT[projectType].subtypeInstructions[subtype];
  const filePath = path.join(workspaceRoot, ".github", "instructions", `${subtype}.instructions.md`);
  return writeManagedFile(filePath, frontmatter, body);
}

function dependabotEcosystemBlock(ecosystem: string): string {
  return `  - package-ecosystem: "${ecosystem}"\n    directory: "/"\n    schedule:\n      interval: "weekly"`;
}

/** Whole-file ownership (first-line marker), not section markers — see
 * design.md. Regenerates the entire file from the union of already-
 * present ecosystems (detected via a simple substring scan, not a YAML
 * parser) and the newly requested ones, plus `github-actions` always. */
export async function writeDependabotConfig(
  workspaceRoot: string,
  projectTypes: BootstrapProjectType[],
): Promise<ManagedFileStatus> {
  const filePath = path.join(workspaceRoot, ".github", "dependabot.yml");

  let existing: string | undefined;
  try {
    existing = await readFile(filePath, "utf8");
  } catch {
    existing = undefined;
  }

  if (existing !== undefined && !existing.startsWith(DEPENDABOT_MARKER)) {
    return "skipped-foreign";
  }

  const ecosystems = new Set<string>(["github-actions"]);
  for (const type of projectTypes) ecosystems.add(CONTENT[type].dependabotEcosystem);
  if (existing) {
    for (const type of Object.keys(CONTENT) as BootstrapProjectType[]) {
      const ecosystem = CONTENT[type].dependabotEcosystem;
      if (existing.includes(`package-ecosystem: "${ecosystem}"`)) ecosystems.add(ecosystem);
    }
  }

  const orderedEcosystems = ["npm", "pip", "github-actions"].filter((eco) => ecosystems.has(eco));
  const content =
    `${DEPENDABOT_MARKER}\nversion: 2\nupdates:\n${orderedEcosystems.map(dependabotEcosystemBlock).join("\n")}\n`;

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
  return existing === undefined ? "created" : "updated";
}
