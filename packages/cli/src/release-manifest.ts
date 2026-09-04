// Builds the `releases.json` manifest the homepage reads.
//
// The contract is NOT defined here. `OpenSpec-Ui-Homepage`'s
// `app/schemas/manifest.py` is the reference definition; this module
// conforms to it, and where the two disagree that file is right. Its
// rules that shape this one:
//
//   * unknown fields are ignored, so this may add fields before the site
//     renders them;
//   * an unknown `schema_version` is REJECTED outright and the site keeps
//     showing its last good snapshot, so that number changes only after
//     the site has learned the new one;
//   * product ids are unique, and deliberately decoupled from package
//     names "so that repository refactoring cannot break the site or
//     re-announce an existing version under a new identity".
//
// The changelog parsing below deliberately mirrors that repository's
// `github_source.py` line for line, including which bullets it drops.
// The site is switching from that source to this one, and a summary that
// came out differently would look like an edited release note rather
// than the same release from a new producer.

import { readFile } from "node:fs/promises";
import path from "node:path";

/** The one format version the site currently accepts. */
export const MANIFEST_SCHEMA_VERSION = 1;

export type ChangeKind = "major" | "minor" | "patch";

export interface ChangeEntry {
  kind: ChangeKind;
  summary: string;
}

export interface Artifact {
  kind: string;
  url: string;
  size_bytes?: number;
  sha256?: string;
}

export interface ProductLinks {
  changelog?: string;
  docs?: string;
  release?: string;
  marketplace?: string;
}

export interface ManifestProduct {
  id: string;
  name: string;
  package?: string;
  public: boolean;
  version: string;
  released_at?: string;
  tag?: string;
  prerelease: boolean;
  summary?: string;
  links: ProductLinks;
  artifacts: Artifact[];
  changes: ChangeEntry[];
}

export interface ReleaseManifest {
  schema_version: number;
  generated_at: string;
  repository: string;
  commit?: string;
  products: ManifestProduct[];
}

/** Where one product lives, and how it is presented.
 *
 * `id` is copied from the site's own `PackageSpec` list, not chosen here.
 * It is not the npm package name — `standalone-app` is
 * `@openspec-ui/server` — and "correcting" one would make the site
 * announce every shipped version again under a new identity, with
 * nothing in CI going red. `release-manifest.test.ts` pins all five. */
export interface ProductSpec {
  id: string;
  name: string;
  directory: string;
  public: boolean;
  summary?: string;
}

export const MANIFEST_PRODUCTS: readonly ProductSpec[] = [
  {
    id: "vscode-extension",
    name: "VS Code Extension",
    directory: "packages/extension",
    public: true,
    summary: "OpenSpec Workbench inside VS Code.",
  },
  {
    id: "standalone-app",
    name: "Standalone App",
    directory: "packages/server",
    public: true,
    summary: "Local web application, no editor required.",
  },
  {
    id: "core",
    name: "Core",
    directory: "packages/core",
    public: true,
    summary: "Execution engine shared by both delivery targets.",
  },
  { id: "shared-ui", name: "Shared UI", directory: "packages/webui", public: false },
  { id: "ci-cli", name: "CLI", directory: "packages/cli", public: false },
];

// The site's own expressions, transcribed. Changing one of these changes
// what a visitor reads, so they are kept together and named the same.
const VERSION_HEADING = /^##\s+([0-9]\S*)\s*$/;
const SECTION_HEADING = /^###\s+(Major|Minor|Patch)\s+Changes\s*$/i;
const ANY_HEADING = /^#{1,6}\s/;
const BULLET = /^-\s+(.*)$/;
const COMMIT_PREFIX = /^[0-9a-f]{7,40}:\s*/;

export interface ParsedChangelog {
  /** The newest version the file describes, or `undefined` if it has no
   * version heading at all. */
  version?: string;
  entries: ChangeEntry[];
}

/** Reads the newest release's notes out of a changesets `CHANGELOG.md`.
 *
 * Never throws: a file in an unexpected shape yields no entries, because
 * `changes` is optional in the contract and an empty list is honest
 * where an invented summary is not. */
export function parseChangelog(markdown: string): ParsedChangelog {
  const lines = markdown.split(/\r?\n/);

  let start = -1;
  let version: string | undefined;
  for (let index = 0; index < lines.length; index += 1) {
    const heading = VERSION_HEADING.exec((lines[index] ?? "").trim());
    if (heading) {
      version = heading[1];
      start = index + 1;
      break;
    }
  }
  if (version === undefined) return { entries: [] };

  const entries: ChangeEntry[] = [];
  // Anything before the first section heading is a patch, matching the
  // site's default rather than dropping it.
  let kind: ChangeKind = "patch";

  for (const raw of lines.slice(start)) {
    const stripped = raw.trim();
    if (VERSION_HEADING.test(stripped)) break; // reached the previous release
    const section = SECTION_HEADING.exec(stripped);
    if (section) {
      kind = (section[1] as string).toLowerCase() as ChangeKind;
      continue;
    }
    if (ANY_HEADING.test(stripped)) continue;

    // Matched against the RAW line, not the stripped one: an indented
    // bullet is a continuation of the entry above it — the package list
    // under "Updated dependencies" — and must not become an entry of its
    // own once that parent has been dropped.
    const bullet = BULLET.exec(raw);
    if (!bullet) continue;

    let summary = (bullet[1] ?? "").trim();
    // changesets emits a dependency-bump bullet in every package; it is
    // bookkeeping between packages, not something a visitor cares about.
    if (!summary || summary.toLowerCase().startsWith("updated dependencies")) continue;
    summary = summary.replace(COMMIT_PREFIX, "");
    if (!summary) continue;

    entries.push({ kind, summary });
  }

  return { version, entries };
}

/** A GitHub Release this manifest should point at, supplied by the
 * caller rather than fetched here — the generator makes no network
 * calls, so its behaviour is entirely testable from fixtures. */
export interface ReleaseAssets {
  productId: string;
  tag?: string;
  url?: string;
  artifacts?: Artifact[];
}

export interface BuildManifestOptions {
  repoRoot: string;
  /** `owner/name`, used to build the changelog and docs links. */
  repository: string;
  /** The ref those links point at. */
  ref?: string;
  commit?: string;
  generatedAt?: Date;
  /** Releases to attach, keyed by product id. Absent means a product has
   * no downloadable artifact — which is the case for four of the five. */
  releases?: readonly ReleaseAssets[];
  readFileText?: (filePath: string) => Promise<string | undefined>;
}

async function defaultReadFileText(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return undefined;
  }
}

export class ReleaseManifestError extends Error {}

/** Builds the manifest from the repository's own records.
 *
 * Throws when a product's `package.json` cannot be read or carries no
 * version: that is a broken generator, not an absent field, and
 * publishing a manifest missing a product would read to the site as that
 * product having been withdrawn. */
export async function buildReleaseManifest(options: BuildManifestOptions): Promise<ReleaseManifest> {
  const {
    repoRoot,
    repository,
    ref = "main",
    commit,
    generatedAt = new Date(),
    releases = [],
    readFileText = defaultReadFileText,
  } = options;

  // `released_at` is the moment of generation, not the release commit's
  // timestamp (design.md, "Questions that were open"). The manifest is
  // published only when a version actually changes, so this reads as
  // "when this version was first published" and cannot drift for a
  // release that already shipped.
  const generatedAtIso = generatedAt.toISOString();
  const products: ManifestProduct[] = [];

  for (const spec of MANIFEST_PRODUCTS) {
    const packageJsonPath = path.join(repoRoot, spec.directory, "package.json");
    const packageJsonText = await readFileText(packageJsonPath);
    if (packageJsonText === undefined) {
      throw new ReleaseManifestError(`cannot read ${spec.directory}/package.json`);
    }

    let version: string;
    let packageName: string | undefined;
    try {
      const parsed = JSON.parse(packageJsonText) as { version?: unknown; name?: unknown };
      if (typeof parsed.version !== "string" || parsed.version.length === 0) {
        throw new Error("no version field");
      }
      version = parsed.version;
      packageName = typeof parsed.name === "string" ? parsed.name : undefined;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ReleaseManifestError(`cannot read version from ${spec.directory}/package.json: ${message}`);
    }

    const changelogRelative = `${spec.directory}/CHANGELOG.md`;
    const changelogText = await readFileText(path.join(repoRoot, spec.directory, "CHANGELOG.md"));
    let changes: ChangeEntry[] = [];
    if (changelogText !== undefined) {
      const parsed = parseChangelog(changelogText);
      // Only trust the notes when they describe the version that is
      // actually shipping; otherwise show the version with no notes.
      if (parsed.version === version) changes = parsed.entries;
    }

    const release = releases.find((entry) => entry.productId === spec.id);
    const links: ProductLinks = {
      changelog: `https://github.com/${repository}/blob/${ref}/${changelogRelative}`,
      docs: `https://github.com/${repository}/blob/${ref}/${spec.directory}/README.md`,
    };
    if (release?.url) links.release = release.url;

    products.push({
      id: spec.id,
      name: spec.name,
      ...(packageName !== undefined ? { package: packageName } : {}),
      public: spec.public,
      version,
      released_at: generatedAtIso,
      ...(release?.tag !== undefined ? { tag: release.tag } : {}),
      prerelease: false,
      ...(spec.summary !== undefined ? { summary: spec.summary } : {}),
      links,
      artifacts: release?.artifacts ? [...release.artifacts] : [],
      changes,
    });
  }

  const seen = new Set<string>();
  for (const product of products) {
    if (seen.has(product.id)) {
      throw new ReleaseManifestError(`duplicate product id in manifest: ${product.id}`);
    }
    seen.add(product.id);
  }

  return {
    schema_version: MANIFEST_SCHEMA_VERSION,
    generated_at: generatedAtIso,
    repository,
    ...(commit !== undefined ? { commit } : {}),
    products,
  };
}

/** The set the publish step compares against what the branch already
 * holds. `generated_at` and `commit` move on every push; these do not,
 * so a push that releases nothing publishes nothing. */
export function versionFingerprint(manifest: ReleaseManifest): string {
  return manifest.products
    .map((product) => `${product.id}@${product.version}`)
    .sort()
    .join(",");
}
