import { expect, test } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { writeWebm } from "./fixtures/tour-recording.js";

test("reports an encoder failure instead of an unhandled broken pipe", async ({ page }) => {
  test.setTimeout(20000);
  const directory = await mkdtemp(path.join(os.tmpdir(), "openspec-tour-encoding-"));
  try {
    const jpeg = await page.screenshot({ type: "jpeg" });
    const photographs = [{ png: Buffer.alloc(0), jpeg, holdMs: 1000 }];
    // The bundled ffmpeg supports WebM output only. An unknown extension
    // makes it exit while frames are still being supplied to its stdin.
    await expect(writeWebm(photographs, path.join(directory, "tour.unsupported")))
      .rejects.toThrow(/ffmpeg exited with code .*:/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
