import { describe, expect, it, vi } from "vitest";
import { applyTemplateToChange, resolveRunWithHarnessDispatch } from "./run-with-harness-dispatch.js";

/** Answers per route. A single `mockResolvedValue` cannot serve both
 * calls this makes: a `Response` body reads once, so the second caller
 * gets a stream error and the recommendation would go missing for a
 * reason the test never intended (run-dialog-actually-advises). */
function fakeRequest(config: unknown, timeline?: unknown) {
  return vi.fn().mockImplementation((pathname: string) => {
    if (pathname === "/api/change-timeline") {
      return Promise.resolve(timeline === undefined
        ? new Response(JSON.stringify({ error: "no timeline" }), { status: 500 })
        : new Response(JSON.stringify(timeline), { status: 200 }));
    }
    return Promise.resolve(new Response(JSON.stringify(config), { status: 200 }));
  });
}

const ASSISTED = { stepAgents: {}, autonomyLevel: "assisted", reviewGate: { mode: "human-required" } };

describe("resolveRunWithHarnessDispatch", () => {
  it("targets the picker for assisted, and computes the change's directory", async () => {
    const request = fakeRequest({ stepAgents: {}, autonomyLevel: "assisted", reviewGate: { mode: "human-required" } });

    const result = await resolveRunWithHarnessDispatch(request, "/repo", "demo");

    expect(result).toMatchObject({ target: "picker", changeDir: "/repo/openspec/changes/demo" });
    // one-way-in-to-run: the dispatch now also carries what the entry
    // will say before it starts anything. Resolving and acting without
    // showing what was read is what made this button look like it only
    // changed tabs.
    expect(result.plan.resolved).toBe("single-stage");
    expect(result.plan.because).toContain('autonomyLevel is "assisted"');
    // No VS Code Chat in this host, so that path is not offered — the
    // same rule as a ceiling that cannot act.
    expect(result.plan.offered.map((path) => path.id)).not.toContain("vscode-agent");
    // No timeline in this fixture, so nothing to reason from — and
    // absent rather than a recommendation drawn from a guessed zero.
    expect(result.plan.advice).toBeUndefined();
    expect(request.mock.calls[0]?.[0]).toBe("/api/harness-config/resolve");
    expect(JSON.parse((request.mock.calls[0]?.[1] as RequestInit).body as string)).toEqual({
      cwd: "/repo",
      changeName: "demo",
    });
  });

  it("targets a chain for semi-autonomous", async () => {
    const request = fakeRequest({ stepAgents: {}, autonomyLevel: "semi-autonomous", reviewGate: { mode: "human-required" } });

    const result = await resolveRunWithHarnessDispatch(request, "/repo", "demo");

    expect(result.target).toBe("chain");
  });

  it("targets a chain for autonomous", async () => {
    const request = fakeRequest({ stepAgents: {}, autonomyLevel: "autonomous", reviewGate: { mode: "human-required" } });

    const result = await resolveRunWithHarnessDispatch(request, "/repo", "demo");

    expect(result.target).toBe("chain");
  });

  it("uses backslash separators for a Windows-style cwd", async () => {
    const request = fakeRequest({ stepAgents: {}, autonomyLevel: "assisted", reviewGate: { mode: "human-required" } });

    const result = await resolveRunWithHarnessDispatch(request, "C:\\repo", "demo");

    expect(result.changeDir).toBe("C:\\repo\\openspec\\changes\\demo");
  });

  it("propagates a resolution error instead of swallowing it", async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Invalid harness config: ..." }), { status: 422 }),
    );

    await expect(resolveRunWithHarnessDispatch(request, "/repo", "demo")).rejects.toThrow("Invalid harness config");
  });
});

describe("resolveRunWithHarnessDispatch — what it advises", () => {
  // The recommendation was left out of this host on the recorded ground
  // that the shell "can read neither the task list nor the audit log".
  // Half of that was never checked: `/api/change-timeline` returns every
  // task with its `done` state.

  function timelineWith(open: number, done: number) {
    return {
      changeName: "demo",
      archived: false,
      createdDate: null,
      archivedDate: null,
      proposal: "",
      design: "",
      specs: [],
      tasks: [
        ...Array.from({ length: open }, (_, index) => ({ text: `open ${index}`, done: false, lineNumber: index })),
        ...Array.from({ length: done }, (_, index) => ({ text: `done ${index}`, done: true, lineNumber: open + index })),
      ],
    };
  }

  it("recommends from the change's open task count, naming it", async () => {
    const request = fakeRequest(ASSISTED, timelineWith(20, 3));

    const result = await resolveRunWithHarnessDispatch(request, "/repo", "demo");

    expect(result.plan.advice?.template?.id).toBe("balanced");
    expect(result.plan.advice?.grounds.join(" ")).toContain("20 tasks still open");
    // The audit log is genuinely not served here, and the recommendation
    // is built to say so rather than imply it looked.
    expect(result.plan.advice?.grounds.join(" ")).toContain("no previous run to go on");
  });

  it("counts only the tasks that are still open", async () => {
    const request = fakeRequest(ASSISTED, timelineWith(2, 30));

    const result = await resolveRunWithHarnessDispatch(request, "/repo", "demo");

    expect(result.plan.advice?.grounds.join(" ")).toContain("2 tasks still open");
    expect(result.plan.advice?.template?.id).toBe("min-cost");
  });

  it("gives no recommendation when the timeline cannot be read", async () => {
    // Absent is honest; zero is a claim, and it happens to be the claim
    // that produces the thriftiest answer.
    const request = fakeRequest(ASSISTED);

    const result = await resolveRunWithHarnessDispatch(request, "/repo", "demo");

    expect(result.plan.advice).toBeUndefined();
  });
});

describe("applyTemplateToChange", () => {
  // applying-a-template-keeps-the-rest. The writer replaces the file, so
  // writing the template alone deleted every key the change had that the
  // template does not set. Third occurrence of this defect here, and the
  // first introduced rather than inherited.

  function routedRequest(existing: unknown, options: { readFails?: boolean } = {}) {
    return vi.fn().mockImplementation((pathname: string) => {
      if (pathname === "/api/harness-config/read-change-override") {
        return Promise.resolve(options.readFails
          ? new Response(JSON.stringify({ error: "not valid JSON" }), { status: 500 })
          : new Response(JSON.stringify({ override: existing }), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
    });
  }

  function writtenBy(request: ReturnType<typeof vi.fn>) {
    const call = request.mock.calls.find(([pathname]) => pathname === "/api/harness-config/write");
    if (!call) throw new Error("no write was made");
    return JSON.parse((call[1] as RequestInit).body as string) as { config: Record<string, unknown> };
  }

  it("keeps every key the applied configuration does not mention", async () => {
    // `gitStageAllowlist` named specifically: it says which paths a chain
    // may stage, no template mentions it, and someone reaching for a
    // cheaper run has not asked for it to be removed.
    const request = routedRequest({
      gitStageAllowlist: ["openspec/**"],
      timeout: { maxRunSeconds: 900 },
      maxStageAttempts: 5,
    });

    await applyTemplateToChange(request, "/repo", "demo", { maxStageAttempts: 2 });

    expect(writtenBy(request).config).toEqual({
      gitStageAllowlist: ["openspec/**"],
      timeout: { maxRunSeconds: 900 },
      // The applied configuration's own key wins.
      maxStageAttempts: 2,
    });
  });

  it("writes the configuration alone when the change has none yet", async () => {
    const request = routedRequest(null);

    await applyTemplateToChange(request, "/repo", "demo", { maxStageAttempts: 2 });

    expect(writtenBy(request).config).toEqual({ maxStageAttempts: 2 });
  });

  it("writes nothing when the existing configuration cannot be read", async () => {
    // Losing a key because a read failed is the same harm arriving by a
    // different route.
    const request = routedRequest(null, { readFails: true });

    await expect(applyTemplateToChange(request, "/repo", "demo", { maxStageAttempts: 2 })).rejects.toThrow();
    expect(request.mock.calls.some(([pathname]) => pathname === "/api/harness-config/write")).toBe(false);
  });
});
