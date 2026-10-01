// What each command in the command list does, in the words the list
// shows beside it (a-done-change-carries-on). Browser-safe: the web UI
// imports it. Keyed by command kind; the list shows each one under its
// `commandLabel`, so `plan` reads "propose" and says what it is sent as.

import type { CommandKind } from "./protocol.js";

export const COMMAND_PURPOSES: Readonly<Partial<Record<CommandKind, string>>> = {
  status: "where the change stands; reads only",
  list: "the changes in this workspace; reads only",
  show: "the change's files; reads only",
  validate: "checks the change's files; reads only",
  plan: "writes the change's missing planning artifacts; sent as plan",
  review: "reviews the proposal, before it is implemented",
  implement: "implements the tasks in tasks.md; sent as implement",
  verify: "checks the implementation against tasks.md and the specs",
};
