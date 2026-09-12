import { defineConfig } from "@playwright/test";

/** Takes the editor pictures, and nothing else.
 *
 * Deliberately NOT part of `npm run test`: it downloads and launches an
 * editor, and the ordinary suite has to stay something a person runs
 * between edits. Its own command, beside the standalone browser suite —
 * see an-editor-picture-is-taken-too. */
export default defineConfig({
  testDir: "./e2e",
  // One editor at a time. Two would fight over the same picture files,
  // and the machine.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  reporter: [["list"]],
  outputDir: "test-results",
  // Launching an editor and waiting for an extension host to activate is
  // slow in a way a page load is not.
  timeout: 240_000,
  expect: { timeout: 60_000 },
});
