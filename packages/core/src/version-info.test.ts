import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { CORE_VERSION } from "./version-info.js";

describe("CORE_VERSION", () => {
  it("matches the package's own package.json version", () => {
    const pkg = createRequire(import.meta.url)("../package.json") as { version: string };
    expect(CORE_VERSION).toBe(pkg.version);
  });
});
