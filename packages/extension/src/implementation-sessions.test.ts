import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WorkbenchProcessScheduler } from "@openspec-ui/core";
import { ImplementationSessionManager } from "./implementation-sessions.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("ImplementationSessionManager", () => {
  it("captures an implementation delta and rolls it back", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "openspec-session-"));
    roots.push(root);
    const filePath = path.join(root, "code.ts");
    await writeFile(filePath, "before");
    const scheduler = new WorkbenchProcessScheduler();
    const manager = new ImplementationSessionManager(scheduler);

    const processId = await manager.start(root, "demo");
    await writeFile(filePath, "after");
    expect(manager.finish(processId)).toBe(true);
    await new Promise<void>((resolve) => {
      const unsubscribe = scheduler.onDidChange((processes) => {
        if (processes.find((process) => process.id === processId)?.state === "completed") {
          unsubscribe();
          resolve();
        }
      });
    });

    expect(manager.getDelta(processId)).toEqual([
      expect.objectContaining({ path: "code.ts", kind: "modified" }),
    ]);
    expect((await manager.rollback(processId)).conflicts).toEqual([]);
    expect(await readFile(filePath, "utf8")).toBe("before");
  });
});
