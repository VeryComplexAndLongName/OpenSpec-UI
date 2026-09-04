import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  MANIFEST_PRODUCTS,
  MANIFEST_SCHEMA_VERSION,
  ReleaseManifestError,
  buildReleaseManifest,
  parseChangelog,
  versionFingerprint,
} from "./release-manifest.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixtureRepo(
  packages: Record<string, { version: string; name?: string; changelog?: string }>,
): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-manifest-"));
  temporaryRoots.push(root);
  for (const [directory, spec] of Object.entries(packages)) {
    const dir = path.join(root, directory);
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({ name: spec.name ?? directory.replace("packages/", "@openspec-ui/"), version: spec.version }),
      "utf8",
    );
    if (spec.changelog !== undefined) await writeFile(path.join(dir, "CHANGELOG.md"), spec.changelog, "utf8");
  }
  return root;
}

/** Every product at the same version, so a test can vary one thing. */
async function completeRepo(version = "1.0.0"): Promise<string> {
  const packages: Record<string, { version: string }> = {};
  for (const spec of MANIFEST_PRODUCTS) packages[spec.directory] = { version };
  return fixtureRepo(packages);
}

describe("MANIFEST_PRODUCTS — the ids the site already uses", () => {
  it("carries exactly the five products, with the site's own ids, names and public flags", () => {
    // Pinned deliberately. These come from OpenSpec-Ui-Homepage's
    // `PackageSpec` list and are NOT the npm package names —
    // `standalone-app` is `@openspec-ui/server`. Getting one wrong is
    // the silent failure here: nothing else goes red, and the site
    // announces every already-shipped version again under a new
    // identity.
    expect(MANIFEST_PRODUCTS.map((p) => [p.id, p.name, p.directory, p.public])).toEqual([
      ["vscode-extension", "VS Code Extension", "packages/extension", true],
      ["standalone-app", "Standalone App", "packages/server", true],
      ["core", "Core", "packages/core", true],
      ["shared-ui", "Shared UI", "packages/webui", false],
      ["ci-cli", "CLI", "packages/cli", false],
    ]);
  });

  it("declares the one schema version the site accepts", () => {
    // The site rejects an unknown version outright and keeps its last
    // good snapshot, so this changes only after the site learns the new
    // one.
    expect(MANIFEST_SCHEMA_VERSION).toBe(1);
  });
});

describe("parseChangelog", () => {
  it("reads each of the three kinds under the newest version", () => {
    const parsed = parseChangelog(
      [
        "# @openspec-ui/core",
        "",
        "## 2.1.0",
        "",
        "### Major Changes",
        "",
        "- abc1234: A breaking thing.",
        "",
        "### Minor Changes",
        "",
        "- def5678: An added thing.",
        "",
        "### Patch Changes",
        "",
        "- 0123456: A fixed thing.",
        "",
        "## 2.0.0",
        "",
        "### Minor Changes",
        "",
        "- Older, must not appear.",
        "",
      ].join("\n"),
    );

    expect(parsed.version).toBe("2.1.0");
    expect(parsed.entries).toEqual([
      { kind: "major", summary: "A breaking thing." },
      { kind: "minor", summary: "An added thing." },
      { kind: "patch", summary: "A fixed thing." },
    ]);
  });

  it("drops the dependency-bump bookkeeping and its indented package list", () => {
    // An indented bullet is a continuation of the entry above it, so it
    // must not become an entry of its own once that parent is dropped.
    const parsed = parseChangelog(
      [
        "## 1.2.3",
        "",
        "### Patch Changes",
        "",
        "- Updated dependencies [abc1234]:",
        "  - @openspec-ui/core@0.50.0",
        "  - @openspec-ui/webui@1.25.0",
        "- deadbee: A real note.",
        "",
      ].join("\n"),
    );

    expect(parsed.entries).toEqual([{ kind: "patch", summary: "A real note." }]);
  });

  it("returns nothing for a file with no version heading, rather than throwing", () => {
    const parsed = parseChangelog("# @openspec-ui/core\n\nNothing released yet.\n");
    expect(parsed.version).toBeUndefined();
    expect(parsed.entries).toEqual([]);
  });

  it("treats bullets before any section heading as patch", () => {
    const parsed = parseChangelog("## 1.0.0\n\n- An uncategorised note.\n");
    expect(parsed.entries).toEqual([{ kind: "patch", summary: "An uncategorised note." }]);
  });
});

describe("buildReleaseManifest", () => {
  it("takes the version from package.json and the notes from the matching changelog section", async () => {
    const root = await completeRepo("1.0.0");
    const withNotes = await fixtureRepo({
      ...Object.fromEntries(MANIFEST_PRODUCTS.map((p) => [p.directory, { version: "1.0.0" }])),
      "packages/core": {
        version: "0.50.0",
        name: "@openspec-ui/core",
        changelog: "## 0.50.0\n\n### Minor Changes\n\n- abc1234: Recorded usage.\n",
      },
    });
    expect(root).toBeDefined();

    const manifest = await buildReleaseManifest({ repoRoot: withNotes, repository: "owner/name" });
    const core = manifest.products.find((p) => p.id === "core");

    expect(core?.version).toBe("0.50.0");
    expect(core?.changes).toEqual([{ kind: "minor", summary: "Recorded usage." }]);
    expect(manifest.schema_version).toBe(1);
    expect(manifest.repository).toBe("owner/name");
  });

  it("shows no notes when the changelog describes a different version from the one shipping", async () => {
    // Only trust the notes when they describe the version that is
    // actually shipping. A changelog left behind by a failed release
    // would otherwise attach the wrong release's notes.
    const root = await fixtureRepo({
      ...Object.fromEntries(MANIFEST_PRODUCTS.map((p) => [p.directory, { version: "1.0.0" }])),
      "packages/core": {
        version: "0.50.0",
        changelog: "## 0.49.0\n\n### Minor Changes\n\n- abc1234: The previous release.\n",
      },
    });

    const manifest = await buildReleaseManifest({ repoRoot: root, repository: "owner/name" });
    const core = manifest.products.find((p) => p.id === "core");

    expect(core?.version).toBe("0.50.0");
    expect(core?.changes).toEqual([]);
  });

  it("gives a product with no release an empty artifacts list, never a fabricated URL", async () => {
    const root = await completeRepo();
    const manifest = await buildReleaseManifest({ repoRoot: root, repository: "owner/name" });

    for (const product of manifest.products) {
      expect(product.artifacts).toEqual([]);
      expect(product.links.release).toBeUndefined();
    }
  });

  it("attaches a release only to the product it belongs to", async () => {
    const root = await completeRepo();
    const manifest = await buildReleaseManifest({
      repoRoot: root,
      repository: "owner/name",
      releases: [
        {
          productId: "vscode-extension",
          tag: "openspec-ui-vscode@1.0.0",
          url: "https://github.com/owner/name/releases/tag/openspec-ui-vscode@1.0.0",
          artifacts: [{ kind: "vsix", url: "https://example.invalid/x.vsix", size_bytes: 42 }],
        },
      ],
    });

    const extension = manifest.products.find((p) => p.id === "vscode-extension");
    expect(extension?.tag).toBe("openspec-ui-vscode@1.0.0");
    expect(extension?.artifacts).toEqual([{ kind: "vsix", url: "https://example.invalid/x.vsix", size_bytes: 42 }]);
    expect(manifest.products.filter((p) => p.artifacts.length > 0)).toHaveLength(1);
  });

  it("refuses to build when a package.json cannot be read", async () => {
    // A manifest missing a product would read to the site as that
    // product having been withdrawn, so a partial document is never
    // produced.
    const root = await fixtureRepo({ "packages/core": { version: "1.0.0" } });
    await expect(buildReleaseManifest({ repoRoot: root, repository: "owner/name" })).rejects.toBeInstanceOf(
      ReleaseManifestError,
    );
  });

  it("refuses to build when a package.json carries no version", async () => {
    const root = await completeRepo();
    await writeFile(path.join(root, "packages", "core", "package.json"), JSON.stringify({ name: "x" }), "utf8");
    await expect(buildReleaseManifest({ repoRoot: root, repository: "owner/name" })).rejects.toBeInstanceOf(
      ReleaseManifestError,
    );
  });

  it("carries the non-public products rather than omitting them", async () => {
    const root = await completeRepo();
    const manifest = await buildReleaseManifest({ repoRoot: root, repository: "owner/name" });

    // The site's schema has the flag and applies it; deciding visibility
    // here as well would put the decision in two places.
    expect(manifest.products.filter((p) => !p.public).map((p) => p.id)).toEqual(["shared-ui", "ci-cli"]);
    expect(manifest.products).toHaveLength(5);
  });

  it("stamps released_at with the moment of generation", async () => {
    const root = await completeRepo();
    const generatedAt = new Date("2026-09-04T09:00:00.000Z");
    const manifest = await buildReleaseManifest({ repoRoot: root, repository: "owner/name", generatedAt });

    expect(manifest.generated_at).toBe("2026-09-04T09:00:00.000Z");
    for (const product of manifest.products) expect(product.released_at).toBe("2026-09-04T09:00:00.000Z");
  });
});

describe("versionFingerprint", () => {
  it("changes with a version and not with the generation time or commit", async () => {
    const root = await completeRepo("1.0.0");
    const first = await buildReleaseManifest({
      repoRoot: root,
      repository: "owner/name",
      commit: "aaaaaaa",
      generatedAt: new Date("2026-09-04T09:00:00.000Z"),
    });
    const second = await buildReleaseManifest({
      repoRoot: root,
      repository: "owner/name",
      commit: "bbbbbbb",
      generatedAt: new Date("2026-09-05T10:00:00.000Z"),
    });

    // This is what stops a push that released nothing from adding a
    // commit to the manifest branch.
    expect(versionFingerprint(second)).toBe(versionFingerprint(first));

    const bumped = await completeRepo("1.0.1");
    const third = await buildReleaseManifest({ repoRoot: bumped, repository: "owner/name" });
    expect(versionFingerprint(third)).not.toBe(versionFingerprint(first));
  });
});

describe("this repository's own manifest", () => {
  it("builds from the real packages, so the fixtures above cannot drift from them", async () => {
    // Runs against the checkout rather than a fixture: a package renamed
    // or moved under `packages/` fails here, which is the whole reason
    // the site should stop reading the layout itself.
    const repoRoot = path.resolve(__dirname, "..", "..", "..");
    const manifest = await buildReleaseManifest({ repoRoot, repository: "VeryComplexAndLongName/OpenSpec-UI" });

    expect(manifest.products.map((p) => p.id)).toEqual([
      "vscode-extension",
      "standalone-app",
      "core",
      "shared-ui",
      "ci-cli",
    ]);
    for (const product of manifest.products) {
      expect(product.version, `${product.id} has no version`).toMatch(/^\d+\.\d+\.\d+/);
      expect(product.package, `${product.id} has no package name`).toBeTruthy();
    }
  });
});

// These three build fixture repositories of five packages on disk and
// dynamically import the CLI's own module graph, so they are heavier than
// the pure-function cases above. Measured 2026-09-04: ~2 s each when the
// machine is idle — already 40% of vitest's 5 s default — and over it
// under a deliberate co-load, where two of them timed out. The ceiling is
// sized for that load rather than for an idle machine; see
// load-sensitive-test-timeouts for the same reasoning applied elsewhere.
describe("the release-manifest command", () => {
  async function run(argv: string[], deps: Record<string, unknown> = {}) {
    const { runMain } = await import("./main.js");
    const out: string[] = [];
    const err: string[] = [];
    const code = await runMain(argv, { stdout: (l) => out.push(l), stderr: (l) => err.push(l), ...deps });
    return { code, out: out.join("\n"), err: err.join("\n") };
  }

  it("prints a manifest built from the repository", async () => {
    const root = await completeRepo("2.0.0");
    const { code, out } = await run(["release-manifest", "--cwd", root, "--repository", "owner/name"]);

    expect(code).toBe(0);
    const parsed = JSON.parse(out) as { products: { id: string; version: string }[] };
    expect(parsed.products.map((p) => p.version)).toEqual(["2.0.0", "2.0.0", "2.0.0", "2.0.0", "2.0.0"]);
  });

  it("prints only the fingerprint when asked, and reads one back from a published manifest", async () => {
    const root = await completeRepo("3.1.4");
    const built = await run(["release-manifest", "--cwd", root, "--fingerprint"]);
    expect(built.code).toBe(0);
    expect(built.out).toContain("core@3.1.4");

    // The same code computes both sides of the comparison the publish
    // step makes; a second implementation in YAML would be free to drift.
    const manifest = await buildReleaseManifest({ repoRoot: root, repository: "owner/name" });
    const readBack = await run(["release-manifest", "--from", "published.json", "--fingerprint"], {
      readReleasesFile: async () => JSON.stringify(manifest),
    });
    expect(readBack.code).toBe(0);
    expect(readBack.out).toBe(built.out);
  });

  it("exits 2 and prints nothing when the manifest cannot be built", async () => {
    const root = await fixtureRepo({ "packages/core": { version: "1.0.0" } });
    const { code, out, err } = await run(["release-manifest", "--cwd", root]);

    // A manifest missing a product would read to the site as that
    // product having been withdrawn, so a partial document is never
    // printed.
    expect(code).toBe(2);
    expect(out).toBe("");
    expect(err).toContain("could not build the release manifest");
  });
}, 30_000);

