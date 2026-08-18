import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { getCoreVersion } from "./version-info.js";

describe("getCoreVersion", () => {
  it("matches the package's own package.json version", () => {
    const pkg = createRequire(import.meta.url)("../package.json") as { version: string };
    expect(getCoreVersion()).toBe(pkg.version);
  });

  it("is idempotent (cached, not re-read on every call)", () => {
    expect(getCoreVersion()).toBe(getCoreVersion());
  });
});
