// Writes the harness JSON Schemas the editor validates harness files
// against, from core (the-harness-schemas-know-every-key). The extension's
// tests fail when the checked-in files differ from this output.
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { harnessConfigJsonSchema } from "../../core/src/harness-config-schema.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const files = [
  ["agent-harness.schema.json", "global"],
  ["change-harness.schema.json", "change"],
] as const;
for (const [name, scope] of files) {
  const target = path.join(here, "..", "schemas", name);
  await writeFile(target, JSON.stringify(harnessConfigJsonSchema(scope), null, 2) + String.fromCharCode(10), "utf8");
  console.log(`wrote ${path.relative(process.cwd(), target)}`);
}
