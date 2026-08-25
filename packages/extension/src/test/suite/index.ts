// Mocha runner for a live run inside a real VS Code Extension Development
// Host (see tasks.md 4.1/4.2). The entry point invoked by
// `@vscode/test-electron` (see src/test/run.mjs).

import path from "node:path";
import Mocha from "mocha";
import { glob } from "glob";

export async function run(): Promise<void> {
  const mocha = new Mocha({ ui: "tdd", color: false, timeout: 120_000 });
  const testsRoot = path.resolve(__dirname);

  const files = await glob("**/*.test.js", { cwd: testsRoot });
  for (const file of files) {
    mocha.addFile(path.resolve(testsRoot, file));
  }

  return new Promise((resolve, reject) => {
    mocha.run((failures) => {
      if (failures > 0) {
        reject(new Error(`${failures} integration test(s) failed.`));
      } else {
        resolve();
      }
    });
  });
}
