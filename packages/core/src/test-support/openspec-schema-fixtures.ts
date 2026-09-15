// Real OpenSpec custom schemas, copied from intent-driven-dev/openspec-schemas
// (MIT), for tests to install into a temporary project rather than writing a
// schema of their own invention. See ../fixtures/openspec-schemas/README.md.

import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type SchemaFixture =
  | "spec-driven-with-adr"
  | "event-driven"
  | "minimalist"
  /** `spec-driven-with-adr` as it was from 2026-05-11 to 2026-06-22, with
   * `adr` declared as `../../../adr/*.md`. */
  | "spec-driven-with-adr-f04aaa2";

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "openspec-schemas");

/** Copies a fixture schema to `<projectRoot>/openspec/schemas/<name>/schema.yaml`,
 * under the name the schema itself declares, and returns that name. */
export async function installSchemaFixture(projectRoot: string, fixture: SchemaFixture): Promise<string> {
  const name = fixture.replace(/-f04aaa2$/u, "");
  const target = path.join(projectRoot, "openspec", "schemas", name);
  await mkdir(target, { recursive: true });
  await copyFile(path.join(FIXTURES, fixture, "schema.yaml"), path.join(target, "schema.yaml"));
  return name;
}
