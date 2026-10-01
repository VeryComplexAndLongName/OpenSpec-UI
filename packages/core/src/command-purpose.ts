// What each command in the command list does, in the words the list
// shows beside it (a-done-change-carries-on). Browser-safe: the web UI
// imports it.

import type { CommandKind } from "./protocol.js";

export const COMMAND_PURPOSES: Readonly<Partial<Record<CommandKind, string>>> = {
  status: "where the change stands; reads only",
  list: "the changes in this workspace; reads only",
  show: "the change's files; reads only",
  validate: "checks the change's files; reads only",
  plan: "drafts a plan without changing code; the propose stage sends this",
  implement: "implements the tasks in tasks.md",
  review: "reviews the proposal, before it is implemented",
};
