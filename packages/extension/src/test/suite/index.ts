// Mocha-раннер для живого прогона внутри реального VS Code Extension
// Development Host (см. tasks.md 4.1/4.2). Точка входа, которую вызывает
// `@vscode/test-electron` (см. src/test/run.mjs).

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
