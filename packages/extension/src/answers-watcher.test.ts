import { describe, expect, it, vi } from "vitest";
import type { ConversationMessage } from "@openspec-ui/core";
import { AnswerWatcher, describeAnswer, type AnswerWatcherDeps } from "./answers-watcher.js";

function answer(over: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    version: 1,
    messageId: "a-1",
    kind: "answer",
    to: "key-ada",
    toKind: "person",
    author: "run",
    words: "on 4.6, and the checks pass",
    answers: "q-1",
    stage: "verify",
    runId: "run-9",
    sentAt: "2026-09-19T10:00:00.000Z",
    machine: "ada-laptop",
    ...over,
  };
}

function watcherOver(messages: ConversationMessage[], over: Partial<AnswerWatcherDeps> = {}) {
  const shown: ConversationMessage[] = [];
  const forgotten: string[] = [];
  const watcher = new AnswerWatcher({
    myKeyId: async () => "key-ada",
    messageDirectory: async () => "/messages",
    roster: async () => new Map(),
    readMessages: async () => messages.map((message) => ({ state: "act" as const, message })),
    forget: async (unused: string, messageId: string) => { forgotten.push(messageId); },
    show: (message) => { shown.push(message); },
    ...over,
  });
  return { watcher, shown, forgotten };
}

describe("AnswerWatcher", () => {
  it("shows an answer addressed to this person once, and forgets it", async () => {
    const { watcher, shown, forgotten } = watcherOver([answer()]);

    await watcher.readOnce();
    await watcher.readOnce();

    expect(shown).toHaveLength(1);
    expect(shown[0]?.words).toBe("on 4.6, and the checks pass");
    expect(forgotten).toEqual(["a-1"]);
  });

  it("leaves a note or a question alone: those are addressed to a run", async () => {
    const { watcher, shown } = watcherOver([answer({ kind: "note", words: "do not touch the manifest" })]);

    await watcher.readOnce();

    expect(shown).toEqual([]);
  });

  it("reads nothing where this machine has no key", async () => {
    const readMessages = vi.fn();
    const { watcher } = watcherOver([answer()], { myKeyId: async () => undefined, readMessages });

    await watcher.readOnce();

    expect(readMessages).not.toHaveBeenCalled();
  });

  it("never raises when the channel cannot be read", async () => {
    const { watcher, shown } = watcherOver([answer()], {
      readMessages: async () => { throw new Error("the directory is gone"); },
    });

    await expect(watcher.readOnce()).resolves.toBeUndefined();
    expect(shown).toEqual([]);
  });
});

describe("describeAnswer", () => {
  it("names the stage and the run, because the words are that stage's own", () => {
    expect(describeAnswer(answer())).toBe("OpenSpec UI: a run answered (verify, run run-9): on 4.6, and the checks pass");
  });

  it("says the words alone where the answer names neither", () => {
    expect(describeAnswer(answer({ stage: undefined, runId: undefined })))
      .toBe("OpenSpec UI: a run answered: on 4.6, and the checks pass");
  });
});
