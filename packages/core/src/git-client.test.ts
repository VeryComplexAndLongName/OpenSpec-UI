import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { openGit } from "./git-client.js";

// simple-git-4: simple-git 4 strips guarded variables from the git it runs.
// What a person set up to reach a remote must still reach git; what could
// make git run something nobody asked for must not. Real git, so in the
// single-fork project (vitest.workspace.ts). Sized like git.push.test.ts:
// a real git start costs seconds under a loaded Windows machine.
vi.setConfig({ testTimeout: 45_000 });

/** Runs `body` with `name` set in this process's environment, as a person's
 * shell or VS Code would have set it, and puts it back after. */
async function withAmbient<T>(name: string, value: string, body: () => Promise<T>): Promise<T> {
  const before = process.env[name];
  process.env[name] = value;
  try {
    return await body();
  } finally {
    if (before === undefined) delete process.env[name];
    else process.env[name] = before;
  }
}

describe("openGit", () => {
  it("lets the person's SSH command reach git", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "openspec-git-client-"));
    try {
      const marker = path.join(root, "ssh-ran");
      const script = path.join(root, "fake-ssh.mjs");
      // Stands in for ssh: leaves a mark and fails, so nothing is reached.
      await writeFile(script, `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(marker)}, "ran");\nprocess.exit(1);\n`, "utf8");
      const command = `"${process.execPath.replaceAll("\\", "/")}" "${script.replaceAll("\\", "/")}"`;

      await withAmbient("GIT_SSH_COMMAND", command, async () => {
        await expect(openGit(root).raw(["ls-remote", "ssh://example.invalid/repo.git"])).rejects.toThrow();
      });

      expect(existsSync(marker)).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps an ambient editor from git", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "openspec-git-client-"));
    try {
      await openGit(root).init();
      const editor = await withAmbient("GIT_EDITOR", "an-editor-nobody-asked-for", () => openGit(root).raw(["var", "GIT_EDITOR"]));

      expect(editor.trim()).not.toBe("an-editor-nobody-asked-for");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
