import { describe, expect, it } from "vitest";
import { scopeSummary } from "./change-scope.js";

const json = (paths: string[]) => JSON.stringify({ paths });
const summary = (paths: string[], changed: string[]) => scopeSummary("demo", json(paths), json(paths), changed).join("\n");

describe("declared change scope", () => {
  it("uses exact files, case-sensitive directory boundaries and only the selected change's planning path", () => {
    const value = summary(["src/auth/", "tests/auth.test.ts"], ["src/auth/login.ts", "src/authentication.ts", "src/Auth/login.ts", "tests/auth.test.ts", "tests/auth.test.ts.old", "openspec/changes/demo/proposal.md", "openspec/changes/other/proposal.md"]);
    expect(value).toContain("Outside declared scope: 4 paths");
    expect(value).toContain("src/authentication.ts");
    expect(value).toContain("src/Auth/login.ts");
    expect(value).toContain("tests/auth.test.ts.old");
    expect(value).toContain("openspec/changes/other/proposal.md");
    expect(value).not.toContain("` src/auth/login.ts `");
    expect(value).not.toContain("` openspec/changes/demo/proposal.md `");
  });

  it("considers old and new paths of a boundary-crossing rename", () => {
    expect(summary(["src/"], ["outside/old.ts", "src/new.ts"])).toContain("` outside/old.ts `");
    expect(summary(["src/"], ["src/old.ts", "outside/new.ts"])).toContain("` outside/new.ts `");
  });

  it.each(["", "/root", "C:/root", "a\\b", "../a", "a/../b", "./a", "a//b", "a//", "src/*", "a?", "a[b]", "a{b}", "a\nb"])("refuses unsafe declaration %j", (value) => {
    expect(summary([value], [])).toContain("Declared scope is unknown");
    expect(summary([value], [])).not.toContain("Outside declared scope: 0");
  });

  it("distinguishes absent, invalid, duplicate and oversized declarations from zero outside paths", () => {
    for (const raw of [undefined, "{", '{"paths":[],"extra":true}', json(["src/", "src/"]), json(Array.from({ length: 257 }, (_, i) => String(i))), json(["x".repeat(501)]), " ".repeat(65537)]) {
      const result = scopeSummary("demo", raw, raw, []).join("\n");
      expect(result).toContain("scope is unknown");
      expect(result).not.toContain("Outside declared scope: 0");
    }
  });

  it("permits only its planning files with an explicit empty scope and qualifies changed declarations", () => {
    expect(summary([], ["openspec/changes/demo/change-scope.json"])).toContain("Outside declared scope: 0 paths");
    expect(summary([], ["README.md"])).toContain("Outside declared scope: 1 path");
    const changed = scopeSummary("demo", json(["src/"]), undefined, []).join("\n");
    expect(changed).toContain("Review its diff before treating these paths as agreed scope");
    expect(changed).toContain("Outside declared scope: 0 paths");
    expect(summary(["src/"], [])).not.toContain("Review its diff");
  });

  it("does not report zero outside paths without a comparison", () => {
    const result = scopeSummary("demo", json([]), json([]), undefined).join("\n");
    expect(result).toContain("comparison is unavailable");
    expect(result).not.toContain("Outside declared scope: 0");
  });

  it("bounds displayed paths and keeps unusual names inside code", () => {
    const result = summary([], ["a`[link](https://example.com)\nnext", ...Array.from({ length: 35 }, (_, i) => `file-${i}`)]);
    expect(result).toContain("Outside declared scope: 36 paths");
    expect(result).toContain("`` a`[link](https://example.com) next ``");
    expect(result).toContain("6 more outside paths");
    expect(result).not.toContain("` file-34 `");
  });
});
