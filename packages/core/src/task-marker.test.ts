import { describe, expect, it } from "vitest";
import type { TaskChecklistItem } from "./task-checklist.js";
import { readTaskMarker, taskInHand } from "./task-marker.js";

// a-run-says-which-task-it-is-on 2.1-2.2 and 4.1. A marker is the agent's
// claim about the task in hand; anything that is not plainly one names no
// task, because a guess is what this exists to avoid.

describe("readTaskMarker", () => {
  it.each([
    ["a plain marker", "Starting task 1.2", "1.2"],
    ["a marker in bold", "**Starting task 2.3**", "2.3"],
    ["a marker in backticks", "`Starting task 2.3`", "2.3"],
    ["a marker after a quote mark", "> Starting task 4", "4"],
    ["a marker after a list mark and in bold", "- **Starting task 6.5**", "6.5"],
    ["a marker under a heading mark", "## Starting task 3.1", "3.1"],
    ["a marker with a title after a colon", "Starting task 2.3: read a marker", "2.3"],
    ["a bold marker whose colon is inside the bold", "**Starting task 2.3:** read a marker", "2.3"],
    ["a marker ending in a full stop", "Starting task 1.1.", "1.1"],
    ["a marker with surrounding whitespace", "   Starting task 10.12   ", "10.12"],
  ])("reads %s", (_name, line, number) => {
    expect(readTaskMarker(line)).toBe(number);
  });

  it.each([
    ["the phrase inside a sentence", "I am starting task 2.3"],
    ["the phrase with more words after the number", "Starting task 2.3 now"],
    ["a number with a letter in it", "Starting task 2.3a"],
    ["no number at all", "Starting task"],
    ["a number with an empty part", "Starting task 2..3"],
    ["a line that is not about a task", "Reading the file"],
  ])("names no task for %s", (_name, line) => {
    expect(readTaskMarker(line)).toBeUndefined();
  });
});

function item(text: string): TaskChecklistItem {
  return { lineNumber: 0, text, done: false };
}

describe("taskInHand", () => {
  const items = [item("1.1 Write the reader"), item("1.2 Pair it with the list"), item("2.1 Say it")];

  it("pairs a recorded number with the list's task, text without its number", () => {
    expect(taskInHand({ number: "1.2", source: "agent", since: "t" }, items))
      .toEqual({ number: "1.2", text: "Pair it with the list", source: "agent" });
  });

  it("keeps the task's source", () => {
    expect(taskInHand({ number: "2.1", source: "command", since: "t" }, items)?.source).toBe("command");
  });

  it("names no task for a number the list does not have", () => {
    expect(taskInHand({ number: "9.9", source: "agent", since: "t" }, items)).toBeUndefined();
  });

  it("names no task for a record that names none", () => {
    expect(taskInHand(null, items)).toBeUndefined();
  });

  it("does not take a number that only begins another task's number", () => {
    expect(taskInHand({ number: "1", source: "agent", since: "t" }, items)).toBeUndefined();
  });
});
